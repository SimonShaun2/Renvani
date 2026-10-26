import { resetEnvCacheForTests } from "@fsm/config";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { default: globalRateLimitPlugin, isGlobalRateLimitExcluded, resolveGlobalRateLimitConfig } = await import(
  "./global-rate-limit.js"
);
const { resetFixedWindowRateLimitStateForTests, setRateLimitRedisClientForTests } = await import(
  "../lib/fixed-window-rate-limit.js"
);

async function buildTestApp(max = 3) {
  const app = Fastify();
  await app.register(globalRateLimitPlugin, { enabled: true, max, windowMs: 60_000 });
  app.get("/api/v1/customers", async () => ({ ok: true }));
  app.get("/health", async () => ({ ok: true }));
  app.get("/health/ready", async () => ({ ok: true }));
  app.post("/api/v1/webhooks/clerk", async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("FS-66 global rate limit plugin", () => {
  afterEach(() => resetFixedWindowRateLimitStateForTests());

  it("allows up to max per IP, then 429 with Retry-After", async () => {
    const app = await buildTestApp(3);
    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "203.0.113.1" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-ratelimit-limit"]).toBe("3");
    }
    const limited = await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "203.0.113.1" });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: "RATE_LIMITED" });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);

    const otherIp = await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "203.0.113.2" });
    expect(otherIp.statusCode).toBe(200);
    await app.close();
  });

  it("never throttles health checks, webhooks, or CORS preflight", async () => {
    const app = await buildTestApp(1);
    for (let i = 0; i < 5; i += 1) {
      expect((await app.inject({ method: "GET", url: "/health", remoteAddress: "198.51.100.9" })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/health/ready", remoteAddress: "198.51.100.9" })).statusCode).toBe(200);
      expect(
        (await app.inject({ method: "POST", url: "/api/v1/webhooks/clerk", remoteAddress: "198.51.100.9", payload: {} })).statusCode
      ).toBe(200);
    }
    expect(isGlobalRateLimitExcluded({ method: "OPTIONS", url: "/api/v1/customers" })).toBe(true);
    expect(isGlobalRateLimitExcluded({ method: "GET", url: "/healthz-not-really" })).toBe(false);
    expect(isGlobalRateLimitExcluded({ method: "GET", url: "/api/v1/customers?x=/health" })).toBe(false);
    // Excluded hits did not consume the budget.
    expect((await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "198.51.100.9" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "198.51.100.9" })).statusCode).toBe(429);
    await app.close();
  });

  it("still enforces the limit when Redis is down (memory fallback)", async () => {
    setRateLimitRedisClientForTests({
      eval: async () => {
        throw new Error("redis down");
      }
    });
    const app = await buildTestApp(1);
    expect((await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "192.0.2.7" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/customers", remoteAddress: "192.0.2.7" })).statusCode).toBe(429);
    await app.close();
  });

  it("is off by default, on only when GLOBAL_RATE_LIMIT_ENABLED=true, and a no-op when disabled", async () => {
    expect(resolveGlobalRateLimitConfig()).toMatchObject({ enabled: false, max: 600, windowMs: 60_000 });
    process.env.GLOBAL_RATE_LIMIT_ENABLED = "true";
    resetEnvCacheForTests();
    expect(resolveGlobalRateLimitConfig().enabled).toBe(true);
    process.env.GLOBAL_RATE_LIMIT_ENABLED = "false";
    resetEnvCacheForTests();
    expect(resolveGlobalRateLimitConfig().enabled).toBe(false);
    delete process.env.GLOBAL_RATE_LIMIT_ENABLED;
    resetEnvCacheForTests();
    const app = Fastify();
    await app.register(globalRateLimitPlugin, { enabled: false, max: 1 });
    app.get("/x", async () => ({ ok: true }));
    for (let i = 0; i < 3; i += 1) {
      expect((await app.inject({ method: "GET", url: "/x" })).statusCode).toBe(200);
    }
    await app.close();
  });
});
