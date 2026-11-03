import { resetEnvCacheForTests } from "@fsm/config";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetPublicBookingRateLimitStateForTests } from "../../../lib/public-booking-rate-limit.js";
import { setupTestEnv } from "../../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: { add: vi.fn(async () => undefined) },
  redisConnection: { del: vi.fn(async () => 0) }
}));

type AppInstance = Awaited<ReturnType<(typeof import("../../../app.js"))["buildApp"]>>;

let buildApp: (typeof import("../../../app.js"))["buildApp"];
let fakeDb: typeof import("../../../test-support/fake-db.js");
let app: AppInstance;

const holdPath = (slug: string, ref: string) => `/api/v1/public/booking/${slug}/requests/${ref}/slot-hold`;

async function hold(slug: string, ref: string, ip: string) {
  return app.inject({
    method: "POST",
    url: holdPath(slug, ref),
    remoteAddress: ip,
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({})
  });
}

describe("FS-66 public slot-hold IP/company rate limit", () => {
  beforeAll(async () => {
    ({ buildApp } = await import("../../../app.js"));
    fakeDb = await import("../../../test-support/fake-db.js");
  });

  beforeEach(async () => {
    fakeDb.resetTestState();
    resetPublicBookingRateLimitStateForTests();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.PUBLIC_SLOT_HOLD_IP_RATE_LIMIT_MAX;
    delete process.env.PUBLIC_SLOT_HOLD_COMPANY_RATE_LIMIT_MAX;
    resetEnvCacheForTests();
  });

  it("under the per-IP limit passes the limiter; the next request gets 429 with Retry-After", async () => {
    process.env.PUBLIC_SLOT_HOLD_IP_RATE_LIMIT_MAX = "3";
    resetEnvCacheForTests();
    app = await buildApp();
    await app.ready();

    for (let i = 0; i < 3; i += 1) {
      const res = await hold("acme-hvac", `BK-REF-${i}`, "203.0.113.10");
      expect(res.statusCode).not.toBe(429);
    }
    const limited = await hold("acme-hvac", "BK-REF-9", "203.0.113.10");
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toBe("RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);

    // A different IP is unaffected.
    expect((await hold("acme-hvac", "BK-REF-0", "203.0.113.11")).statusCode).not.toBe(429);
  });

  it("trips the per-company limit across IPs and leaves other companies alone", async () => {
    process.env.PUBLIC_SLOT_HOLD_COMPANY_RATE_LIMIT_MAX = "2";
    resetEnvCacheForTests();
    app = await buildApp();
    await app.ready();

    expect((await hold("acme-hvac", "BK-1", "198.51.100.1")).statusCode).not.toBe(429);
    expect((await hold("acme-hvac", "BK-2", "198.51.100.2")).statusCode).not.toBe(429);
    const limited = await hold("acme-hvac", "BK-3", "198.51.100.3");
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();

    expect((await hold("other-co", "BK-1", "198.51.100.4")).statusCode).not.toBe(429);
  });

  it("applies to the confirm endpoint too", async () => {
    process.env.PUBLIC_SLOT_HOLD_IP_RATE_LIMIT_MAX = "1";
    resetEnvCacheForTests();
    app = await buildApp();
    await app.ready();

    const confirm = (ref: string) =>
      app.inject({
        method: "POST",
        url: `/api/v1/public/booking/acme-hvac/requests/${ref}/confirm`,
        remoteAddress: "192.0.2.50",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({})
      });
    expect((await confirm("BK-A")).statusCode).not.toBe(429);
    expect((await confirm("BK-B")).statusCode).toBe(429);
  });
});
