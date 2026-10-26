import { afterEach, describe, expect, it } from "vitest";

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
