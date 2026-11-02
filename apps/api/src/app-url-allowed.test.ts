import { resetEnvCacheForTests } from "@fsm/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "./test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("./test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("./test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({ notificationsQueue: { add: vi.fn(async () => undefined) }, redisConnection: { del: vi.fn(async () => 0) } }));

const { buildApp } = await import("./app.js");
const { currentAppBaseUrl } = await import("./lib/app-origins.js");

const TESTER = "https://tester.renvani.test";
const EVIL = "https://evil.renvani.test";

function configure(tier: "staging" | "production" | undefined) {
  process.env.APP_URL_ALLOWED = `${TESTER}, https://*.vercel.app`;
  if (tier) process.env.RENVANI_DEPLOYMENT_TIER = tier;
  else delete process.env.RENVANI_DEPLOYMENT_TIER;
  resetEnvCacheForTests();
}

async function preflight(origin: string) {
  const app = await buildApp();
  app.get("/__origin-probe", async () => ({ base: currentAppBaseUrl() }));
  try {
    const cors = await app.inject({
      method: "OPTIONS",
      url: "/health/live",
      headers: { origin, "access-control-request-method": "GET" }
    });
    const probe = await app.inject({ method: "GET", url: "/__origin-probe", headers: { origin } });
    return { allowOrigin: cors.headers["access-control-allow-origin"], base: (probe.json() as { base: string }).base };
  } finally {
    await app.close();
  }
}

describe("APP_URL_ALLOWED wiring (CORS + Stripe return base URL)", () => {
  afterEach(() => {
    delete process.env.APP_URL_ALLOWED;
    delete process.env.RENVANI_DEPLOYMENT_TIER;
    resetEnvCacheForTests();
  });

  it("staging: an exact allowed origin passes CORS and becomes the request's app base URL", async () => {
    configure("staging");
    expect(await preflight(TESTER)).toEqual({ allowOrigin: TESTER, base: TESTER });
  });

  it("staging: unlisted or wildcard-looking origins are rejected and fall back to APP_URL", async () => {
    configure("staging");
    for (const origin of [EVIL, "https://foo.vercel.app", `${TESTER}.evil.test`]) {
      const result = await preflight(origin);
      expect(result.allowOrigin).toBeUndefined();
      expect(result.base).toBe("http://localhost:3000");
    }
  });

  it("primary APP_URL is always allowed", async () => {
    configure("staging");
    expect((await preflight("http://localhost:3000")).allowOrigin).toBe("http://localhost:3000");
  });

  it("non-staging tiers ignore APP_URL_ALLOWED", async () => {
    configure(undefined);
    expect(await preflight(TESTER)).toEqual({ allowOrigin: undefined, base: "http://localhost:3000" });
  });
});
