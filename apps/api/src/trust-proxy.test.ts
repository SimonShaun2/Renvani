import { resetEnvCacheForTests } from "@fsm/config";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "./test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("./test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("./test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({ notificationsQueue: { add: vi.fn(async () => undefined) }, redisConnection: { del: vi.fn(async () => 0) } }));

const { buildApp, resolveTrustProxySetting } = await import("./app.js");
const { env } = await import("@fsm/config");

async function seenIp(trustProxy: false | number, xff?: string): Promise<string> {
  const app = Fastify({ trustProxy });
  app.get("/ip", async (request) => ({ ip: request.ip }));
  const res = await app.inject({
    method: "GET",
    url: "/ip",
    remoteAddress: "10.0.0.5",
    headers: xff ? { "x-forwarded-for": xff } : {}
  });
  await app.close();
  return res.json().ip as string;
}

describe("FS-66 TRUST_PROXY_HOPS", () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY_HOPS;
    resetEnvCacheForTests();
  });

  it("defaults to 0 (trust none)", () => {
    resetEnvCacheForTests();
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(resolveTrustProxySetting(0)).toBe(false);
  });

  it("parses positive integers", () => {
    process.env.TRUST_PROXY_HOPS = "3";
    resetEnvCacheForTests();
    expect(env.TRUST_PROXY_HOPS).toBe(3);
    expect(resolveTrustProxySetting(3)).toBe(3);
  });

  it("accepts the upper bound 10", () => {
    process.env.TRUST_PROXY_HOPS = "10";
    resetEnvCacheForTests();
    expect(env.TRUST_PROXY_HOPS).toBe(10);
  });

  it.each(["-1", "1.5", "abc", "11", "1000000"])("rejects invalid value %s", (value) => {
    process.env.TRUST_PROXY_HOPS = value;
    resetEnvCacheForTests();
    expect(() => env.TRUST_PROXY_HOPS).toThrow();
  });

  it("hops=0 ignores X-Forwarded-For (socket peer)", async () => {
    expect(await seenIp(resolveTrustProxySetting(0), "203.0.113.9")).toBe("10.0.0.5");
  });

  it("hops=1 uses the X-Forwarded-For client added by the proxy", async () => {
    expect(await seenIp(resolveTrustProxySetting(1), "203.0.113.9")).toBe("203.0.113.9");
  });

  it("hops=1 takes the rightmost entry, so a spoofed leftmost XFF is ignored", async () => {
    expect(await seenIp(resolveTrustProxySetting(1), "6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
  });

  it("buildApp wires TRUST_PROXY_HOPS into request.ip", async () => {
    process.env.TRUST_PROXY_HOPS = "1";
    resetEnvCacheForTests();
    const app = await buildApp();
    app.get("/__ip-probe", async (request) => ({ ip: request.ip }));
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/__ip-probe", remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": "198.51.100.77" } });
    expect(res.json().ip).toBe("198.51.100.77");
    await app.close();
  });
});
