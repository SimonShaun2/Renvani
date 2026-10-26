import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { generateBookingHoldToken } from "../../../lib/booking-hold-token.js";
import { resetBookingHoldTokenJtiStateForTests } from "../../../lib/booking-hold-token-store.js";
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

const AFTERNOON_START = "2026-04-28T12:00:00.000Z";
const AFTERNOON_END = "2026-04-28T17:00:00.000Z";

function seedPublicHoldFixture(referenceNumber = "BK-20260428-testref01") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  fakeDb.seedBookingSettings({
    companyId: company.id,
    bookingSlug: "acme-hvac",
    isEnabled: true,
    availableDays: ["tue"],
    availableHoursStart: 8,
    availableHoursEnd: 17
  });
  const technician = fakeDb.seedTechnician({
    companyId: company.id,
    firstName: "Taylor",
    lastName: "Tech",
    phone: "555-0101",
    serviceZipCodes: ["74103"]
  });
  const booking = fakeDb.seedBookingRequest({
    companyId: company.id,
    firstName: "Jamie",
    lastName: "Stone",
    phone: "555-0200",
    addressLine1: "500 Oak Ave",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    status: "pending",
    referenceNumber
  });

  const holdToken = generateBookingHoldToken({
    companyId: company.id,
    bookingRequestId: booking.id,
    referenceNumber
  });

  return { company, technician, booking, holdToken, referenceNumber };
}

function confirmPath(slug: string, ref: string): string {
  return `/api/v1/public/booking/${slug}/requests/${ref}/confirm`;
}

function slotHoldPath(slug: string, ref: string): string {
  return `/api/v1/public/booking/${slug}/requests/${ref}/slot-hold`;
}

beforeAll(async () => {
  buildAppModule = await import("../../../app.js");
  fakeDb = await import("../../../test-support/fake-db.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  resetPublicBookingRateLimitStateForTests();
  resetBookingHoldTokenJtiStateForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-28T14:00:00.000Z"));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

describe("POST /public/booking/:slug/requests/:ref/confirm", () => {
  it("returns 409 when no active slot hold exists", async () => {
    const { technician, referenceNumber } = seedPublicHoldFixture();

    const response = await request(app.server)
      .post(confirmPath("acme-hvac", referenceNumber))
      .send({
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("CONFLICT");
  });

  it("confirms booking and returns job linkage after a valid hold", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();

    const holdResponse = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });
    expect(holdResponse.status).toBe(200);

    const confirmResponse = await request(app.server)
      .post(confirmPath("acme-hvac", referenceNumber))
      .send({
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.bookingRequest.status).toBe("confirmed");
    expect(confirmResponse.body.jobId).toBe(confirmResponse.body.bookingRequest.jobId);
    expect(confirmResponse.body.recurringSchedule).toMatchObject({
      linked: false,
      scheduleKind: "none"
    });
  });
});
