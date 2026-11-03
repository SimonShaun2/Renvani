import { afterEach, describe, expect, it } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const mod = await import("./webhook-dedupe.js");

/** Fake Redis honouring SET NX EX, GET and the two token-checked Lua scripts. */
function fakeRedis(clock: () => number) {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const live = (k: string) => {
    const e = store.get(k);
    if (e && e.expiresAt <= clock()) store.delete(k);
    return store.get(k);
  };
  return {
    store,
    client: {
      async set(key: string, value: string, _ex: "EX", seconds: number, _nx: "NX") {
        if (live(key)) return null;
        store.set(key, { value, expiresAt: clock() + seconds * 1000 });
        return "OK";
      },
      async get(key: string) {
        return live(key)?.value ?? null;
      },
      async eval(script: string, _n: number, key: string, token: string | number, ttl?: string | number) {
        const e = live(key);
        if (!e || e.value !== token) return 0;
        if (script.includes("'done'")) store.set(key, { value: "done", expiresAt: clock() + Number(ttl) * 1000 });
        else store.delete(key);
        return 1;
      }
    }
  };
}

const failing = {
  set: async () => {
    throw new Error("down");
  },
  get: async () => {
    throw new Error("down");
  },
  eval: async () => {
    throw new Error("down");
  }
};

describe.each(["redis", "memory"] as const)("FS-158 webhook dedupe (%s store)", (store) => {
  let t = 1_000_000;
  const setup = () => {
    t = 1_000_000;
    mod.setWebhookDedupeNowForTests(() => t);
    const fake = fakeRedis(() => t);
    mod.setWebhookDedupeRedisClientForTests(store === "redis" ? fake.client : null);
    return fake;
  };
  afterEach(() => mod.resetWebhookDedupeForTests());

  it("duplicate delivery after success is acked as duplicate", async () => {
    setup();
    const c = await mod.claimWebhookMessage("clerk", "m1");
    expect(c).toMatchObject({ status: "claimed", store });
    await mod.completeWebhookMessage("clerk", "m1", c.token!);
    expect((await mod.claimWebhookMessage("clerk", "m1")).status).toBe("duplicate");
  });

  it("concurrent duplicates: exactly one claim wins, others see in_progress", async () => {
    setup();
    const results = await Promise.all([1, 2, 3, 4].map(() => mod.claimWebhookMessage("clerk", "m2")));
    expect(results.filter((r) => r.status === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r.status === "in_progress")).toHaveLength(3);
  });

  it("failure releases the claim so a retry is processed", async () => {
    setup();
    const c = await mod.claimWebhookMessage("clerk", "m3");
    await mod.releaseWebhookMessage("clerk", "m3", c.token!);
    expect((await mod.claimWebhookMessage("clerk", "m3")).status).toBe("claimed");
  });

  it("a crash (no complete/release) only blocks retries for the short processing lease, not 24h", async () => {
    setup();
    await mod.claimWebhookMessage("clerk", "m4");
    expect((await mod.claimWebhookMessage("clerk", "m4")).status).toBe("in_progress");
    t += (mod.PROCESSING_TTL_SECONDS + 1) * 1000;
    expect((await mod.claimWebhookMessage("clerk", "m4")).status).toBe("claimed");
  });

  it("done marker lasts 24h then expires", async () => {
    setup();
    const c = await mod.claimWebhookMessage("clerk", "m5");
    await mod.completeWebhookMessage("clerk", "m5", c.token!);
    t += (mod.DONE_TTL_SECONDS - 10) * 1000;
    expect((await mod.claimWebhookMessage("clerk", "m5")).status).toBe("duplicate");
    t += 20_000;
    expect((await mod.claimWebhookMessage("clerk", "m5")).status).toBe("claimed");
  });

  it("a stale holder cannot release or complete someone else's newer claim", async () => {
    setup();
    const stale = await mod.claimWebhookMessage("clerk", "m6");
    t += (mod.PROCESSING_TTL_SECONDS + 1) * 1000;
    const fresh = await mod.claimWebhookMessage("clerk", "m6");
    expect(fresh.status).toBe("claimed");
    await mod.releaseWebhookMessage("clerk", "m6", stale.token!);
    await mod.completeWebhookMessage("clerk", "m6", stale.token!);
    expect((await mod.claimWebhookMessage("clerk", "m6")).status).toBe("in_progress");
  });

  it("distinct ids and sources are independent", async () => {
    setup();
    expect((await mod.claimWebhookMessage("clerk", "a")).status).toBe("claimed");
    expect((await mod.claimWebhookMessage("clerk", "b")).status).toBe("claimed");
    expect((await mod.claimWebhookMessage("other", "a")).status).toBe("claimed");
  });
});

describe("FS-158 Redis-down fallback", () => {
  afterEach(() => mod.resetWebhookDedupeForTests());

  it("falls back to the per-instance memory store with the same semantics", async () => {
    mod.setWebhookDedupeRedisClientForTests(failing);
    const c = await mod.claimWebhookMessage("clerk", "x1");
    expect(c).toMatchObject({ status: "claimed", store: "memory" });
    expect((await mod.claimWebhookMessage("clerk", "x1")).status).toBe("in_progress");
    await mod.releaseWebhookMessage("clerk", "x1", c.token!);
    const again = await mod.claimWebhookMessage("clerk", "x1");
    expect(again.status).toBe("claimed");
    await mod.completeWebhookMessage("clerk", "x1", again.token!);
    expect((await mod.claimWebhookMessage("clerk", "x1")).status).toBe("duplicate");
  });

  it("falls back when Redis hangs past the timeout", async () => {
    const hanging = { set: () => new Promise<never>(() => {}), get: failing.get, eval: failing.eval };
    mod.setWebhookDedupeRedisClientForTests(hanging);
    expect(await mod.claimWebhookMessage("clerk", "x2")).toMatchObject({ status: "claimed", store: "memory" });
  });
});
