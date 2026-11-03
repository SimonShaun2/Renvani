import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_BOOKING_IP_RATE_LIMIT,
  resetPublicBookingRateLimitStateForTests
} from "../../../lib/public-booking-rate-limit.js";
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
  notificationsQueue: {
    add: vi.fn(async () => undefined)
  },
  redisConnection: {
    del: vi.fn(async () => 0)
  }
}));

type BuildAppModule = typeof import("../../../app.js");
type FakeDbModule = typeof import("../../../test-support/fake-db.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let app: AppInstance;

describe("public booking IP rate limit (FS-58)", () => {
  beforeAll(async () => {
    buildAppModule = await import("../../../app.js");
    fakeDb = await import("../../../test-support/fake-db.js");
  });

  beforeEach(async () => {
    fakeDb.resetTestState();
    resetPublicBookingRateLimitStateForTests();

    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac",
      timezone: "America/Chicago"
    });
    fakeDb.seedBookingSettings({
      companyId: company.id,
      bookingSlug: "acme-hvac",
      isEnabled: true,
      availableDays: ["mon", "tue", "wed", "thu", "fri"],
      availableHoursStart: 8,
      availableHoursEnd: 17
    });

    app = await buildAppModule.buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it(`returns 429 on the ${PUBLIC_BOOKING_IP_RATE_LIMIT + 1}th POST from the same IP`, async () => {
    const path = "/api/v1/public/booking/acme-hvac/check-zip";
    const payload = JSON.stringify({ zip: "74103" });

    for (let attempt = 1; attempt <= PUBLIC_BOOKING_IP_RATE_LIMIT; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: path,
        remoteAddress: "203.0.113.44",
        headers: { "content-type": "application/json" },
        payload
      });
      expect(response.statusCode).not.toBe(429);
    }

    const limited = await app.inject({
      method: "POST",
      url: path,
      remoteAddress: "203.0.113.44",
      headers: { "content-type": "application/json" },
      payload
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toBe("RATE_LIMITED");
    expect(limited.json().message).toContain("booking submissions");
  });
});
