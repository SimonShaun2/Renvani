import { afterEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const mod = await import("./fixed-window-rate-limit.js");
const { FIXED_WINDOW_LUA, hitFixedWindowRateLimit, resetFixedWindowRateLimitStateForTests, setRateLimitRedisClientForTests } = mod;

/** Fake Redis that executes the Lua script's semantics atomically (single-threaded, like Redis). */
function fakeRedis() {
  const store = new Map<string, { count: number; expiresAt: number }>();
  const calls: Array<{ script: string; key: string; windowMs: number }> = [];
  return {
    calls,
    async eval(script: string, _numKeys: number, key: string | number, windowMs: string | number) {
      calls.push({ script, key: String(key), windowMs: Number(windowMs) });
      const now = Date.now();
      let entry = store.get(String(key));
      if (!entry || entry.expiresAt <= now) {
        entry = { count: 0, expiresAt: now + Number(windowMs) };
        store.set(String(key), entry);
      }
      entry.count += 1;
      return [entry.count, entry.expiresAt - now];
    }
  };
}

describe("FS-66 fixed-window rate limiter", () => {
  afterEach(() => resetFixedWindowRateLimitStateForTests());

  it("uses one atomic Lua INCR/PEXPIRE call per hit on Redis and blocks after the limit", async () => {
    const redis = fakeRedis();
    setRateLimitRedisClientForTests(redis);
    const input = { key: "fsm:test:k", limit: 2, windowMs: 60_000 };

    const results = await Promise.all([1, 2, 3].map(() => hitFixedWindowRateLimit(input)));
    expect(results.map((r) => r.allowed).sort()).toEqual([false, true, true]);
    expect(results.every((r) => r.store === "redis")).toBe(true);
    expect(redis.calls).toHaveLength(3);
    expect(redis.calls[0]?.script).toBe(FIXED_WINDOW_LUA);
    expect(FIXED_WINDOW_LUA).toContain("INCR");
    expect(FIXED_WINDOW_LUA).toContain("PEXPIRE");
    const blocked = results.find((r) => !r.allowed);
    expect(blocked?.retryAfterSeconds).toBeGreaterThanOrEqual(59);
  });

  it("falls back to the in-memory window when Redis errors", async () => {
    setRateLimitRedisClientForTests({
      eval: async () => {
        throw new Error("ECONNREFUSED");
      }
    });
    const input = { key: "fsm:test:down", limit: 1, windowMs: 1_000 };
    const first = await hitFixedWindowRateLimit(input);
    const second = await hitFixedWindowRateLimit(input);
    expect(first).toMatchObject({ allowed: true, store: "memory" });
    expect(second).toMatchObject({ allowed: false, store: "memory" });
    expect(second.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("falls back to memory when Redis hangs (timeout)", async () => {
    setRateLimitRedisClientForTests({ eval: () => new Promise(() => undefined) });
    const result = await hitFixedWindowRateLimit({ key: "fsm:test:hang", limit: 5, windowMs: 1_000 });
    expect(result).toMatchObject({ allowed: true, store: "memory" });
  });

  it("resets after the window elapses (memory)", async () => {
    setRateLimitRedisClientForTests(null);
    const input = { key: "fsm:test:window", limit: 1, windowMs: 20 };
    expect((await hitFixedWindowRateLimit(input)).allowed).toBe(true);
    expect((await hitFixedWindowRateLimit(input)).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect((await hitFixedWindowRateLimit(input)).allowed).toBe(true);
  });
});

describe("FS-66 normalizeRateLimitIp", () => {
  const n = mod.normalizeRateLimitIp;
  it("keeps IPv4 as-is and maps empty to unknown", () => {
    expect(n("203.0.113.7")).toBe("203.0.113.7");
    expect(n(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(n(undefined)).toBe("unknown");
    expect(n("  ")).toBe("unknown");
  });
  it("unmaps IPv4-mapped IPv6 (dotted and hex) to the IPv4 bucket", () => {
    expect(n("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(n("::FFFF:cb00:7107")).toBe("203.0.113.7");
    expect(n("0:0:0:0:0:ffff:203.0.113.7")).toBe("203.0.113.7");
  });
  it("lowercases, expands and buckets IPv6 by /64 in compressed form", () => {
    expect(n("2001:DB8:0:0:1:2:3:4")).toBe("2001:db8::/64");
    expect(n("2001:0db8:00aa:0001:ffff:ffff:ffff:ffff")).toBe("2001:db8:aa:1::/64");
    expect(n("::1")).toBe("::/64");
  });
  it("same /64 shares a bucket; different /64 does not", () => {
    expect(n("2001:db8:1:2::1")).toBe(n("2001:db8:1:2:dead:beef:0:9"));
    expect(n("2001:db8:1:2::1")).not.toBe(n("2001:db8:1:3::1"));
  });
  it("strips brackets, ports and zone ids", () => {
    expect(n("[2001:db8:1:2::5]")).toBe("2001:db8:1:2::/64");
    expect(n("[2001:db8:1:2::5]:8443")).toBe("2001:db8:1:2::/64");
    expect(n("fe80::1%eth0")).toBe("fe80::/64");
  });
  it.each(["not-an-ip", "1.2.3", "2001:db8::g", "1:2:3:4:5:6:7:8:9", "x".repeat(500), "[::1"])(
    "maps invalid input %s to the fallback bucket",
    (v) => {
      expect(n(v)).toBe("invalid");
    }
  );
});

describe("FS-66 memory store eviction", () => {
  afterEach(() => mod.resetFixedWindowRateLimitStateForTests());
  it("keeps active limits when the store fills (evicts oldest only, never clears all)", async () => {
    mod.setRateLimitRedisClientForTests(null);
    mod.setRateLimitMemoryMaxKeysForTests(5);
    const hit = (key: string) => mod.hitFixedWindowRateLimit({ key, limit: 2, windowMs: 60_000 });
    // Victim exhausts its limit.
    await hit("victim");
    await hit("victim");
    expect((await hit("victim")).allowed).toBe(false);
    for (let i = 0; i < 4; i += 1) await hit(`k${i}`);
    // Store is full; flooding new keys evicts only the oldest (the victim first) one at a time.
    await hit("flood-1");
    await hit("k1");
    // k1..k3 + flood-1 survive (k0 or victim evicted, not everything).
    expect((await hit("k1")).count).toBe(3);
    expect((await hit("k3")).count).toBe(2);
  });
  it("evicts expired windows before active ones", async () => {
    vi.useFakeTimers();
    try {
      mod.setRateLimitRedisClientForTests(null);
      mod.setRateLimitMemoryMaxKeysForTests(3);
      const hit = (key: string, windowMs: number) => mod.hitFixedWindowRateLimit({ key, limit: 1, windowMs });
      await hit("active-old", 60_000);
      await hit("short-a", 1_000);
      await hit("short-b", 1_000);
      vi.advanceTimersByTime(2_000);
      await hit("new", 60_000);
      // The oldest active entry survived because the expired ones were evicted instead.
      const r = await hit("active-old", 60_000);
      expect(r.count).toBe(2);
      expect(r.allowed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
