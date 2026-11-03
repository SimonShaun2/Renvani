import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@fsm/config";

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
const OFF_WINDOW_START = "2026-04-28T13:00:00.000Z";
const OFF_WINDOW_END = "2026-04-28T15:00:00.000Z";

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

describe("POST /public/booking/:slug/hold-token/inspect", () => {
  it("returns valid inspection for a matching hold token without claiming it", async () => {
    const { holdToken, referenceNumber } = seedPublicHoldFixture();

    const response = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/hold-token/inspect")
      .send({ holdToken });

    expect(response.status).toBe(200);
    expect(response.body.inspection).toMatchObject({
      status: "valid",
      referenceNumber,
      slugMatches: true
    });
  });

  it("does not consume the hold token jti so slot-hold still works after inspect (resume)", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();

    const inspectResponse = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/hold-token/inspect")
      .send({ holdToken });
    expect(inspectResponse.status).toBe(200);
    expect(inspectResponse.body.inspection.status).toBe("valid");

    const holdResponse = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(holdResponse.status).toBe(200);
    expect(holdResponse.body.hold.scheduledStart).toBe(AFTERNOON_START);
  });

  it("returns slugMatches false when the token belongs to another booking page", async () => {
    const otherCompany = fakeDb.seedCompany({
      name: "Other Co",
      slug: "other-co",
      timezone: "America/Chicago"
    });
    fakeDb.seedBookingSettings({
      companyId: otherCompany.id,
      bookingSlug: "other-co",
      isEnabled: true,
      availableDays: ["tue"],
      availableHoursStart: 8,
      availableHoursEnd: 17
    });
    const { holdToken, referenceNumber } = seedPublicHoldFixture();

    const response = await request(app.server)
      .post("/api/v1/public/booking/other-co/hold-token/inspect")
      .send({ holdToken });

    expect(response.status).toBe(200);
    expect(response.body.inspection).toMatchObject({
      status: "valid",
      referenceNumber,
      slugMatches: false
    });
  });

  it("returns expired inspection with reference for resume messaging", async () => {
    const { booking, referenceNumber } = seedPublicHoldFixture();
    const expiredToken = jwt.sign(
      {
        companyId: booking.companyId,
        bookingRequestId: booking.id,
        referenceNumber,
        jti: "550e8400-e29b-41d4-a716-446655440099",
        tokenType: "booking_hold"
      },
      env.BOOKING_HOLD_TOKEN_SECRET,
      { expiresIn: -60 }
    );

    const response = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/hold-token/inspect")
      .send({ holdToken: expiredToken });

    expect(response.status).toBe(200);
    expect(response.body.inspection).toMatchObject({
      status: "expired",
      referenceNumber,
      slugMatches: true
    });
    expect(response.body.inspection.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("returns invalid inspection without error for tampered tokens", async () => {
    const { holdToken } = seedPublicHoldFixture();
    const tampered =
      holdToken.slice(0, -1) + (holdToken.endsWith("a") ? "b" : "a");

    const response = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/hold-token/inspect")
      .send({ holdToken: tampered });

    expect(response.status).toBe(200);
    expect(response.body.inspection).toMatchObject({
      status: "invalid",
      referenceNumber: null,
      slugMatches: false
    });
  });
});

describe("public booking slot-hold security", () => {
  it("returns 400 when holdToken is missing", async () => {
    const { technician, referenceNumber } = seedPublicHoldFixture();

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 403 when hold token does not match booking reference", async () => {
    const { technician, booking, referenceNumber } = seedPublicHoldFixture();
    const wrongRefToken = generateBookingHoldToken({
      companyId: booking.companyId,
      bookingRequestId: booking.id,
      referenceNumber: "BK-OTHER-REFERENCE"
    });

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken: wrongRefToken,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(403);
  });

  it("returns 401 for an expired hold token", async () => {
    const { technician, booking, referenceNumber } = seedPublicHoldFixture();
    const expiredToken = jwt.sign(
      {
        companyId: booking.companyId,
        bookingRequestId: booking.id,
        referenceNumber,
        jti: "550e8400-e29b-41d4-a716-446655440099",
        tokenType: "booking_hold"
      },
      env.BOOKING_HOLD_TOKEN_SECRET,
      { expiresIn: -60 }
    );

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken: expiredToken,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(401);
  });

  it("returns 401 for a tampered hold token", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();
    const tampered =
      holdToken.slice(0, -1) + (holdToken.endsWith("a") ? "b" : "a");

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken: tampered,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(401);
  });

  it("returns 409 when the slot is outside published availability windows", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken,
        technicianId: technician.id,
        scheduledStart: OFF_WINDOW_START,
        scheduledEnd: OFF_WINDOW_END
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("CONFLICT");
  });

  it("returns 409 when booking zip is outside the service area", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();
    technician.serviceZipCodes = ["99999"];

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("CONFLICT");
  });

  it("returns 429 on the 16th slot-hold attempt for the same reference", async () => {
    vi.useRealTimers();
    const { referenceNumber } = seedPublicHoldFixture();
    const path = slotHoldPath("acme-hvac", referenceNumber);
    const payload = "{}";

    for (let attempt = 1; attempt <= 15; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: path,
        remoteAddress: `10.0.0.${attempt}`,
        headers: { "content-type": "application/json" },
        payload
      });
      expect(response.statusCode).not.toBe(429);
    }

    const limited = await app.inject({
      method: "POST",
      url: path,
      remoteAddress: "10.0.0.99",
      headers: { "content-type": "application/json" },
      payload
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toBe("RATE_LIMITED");
    expect(limited.json().message).toContain("booking reference");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T14:00:00.000Z"));
  });

  it("returns 409 when the same hold token is reused after a successful hold", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();
    const body = {
      holdToken,
      technicianId: technician.id,
      scheduledStart: AFTERNOON_START,
      scheduledEnd: AFTERNOON_END
    };

    const first = await request(app.server).post(slotHoldPath("acme-hvac", referenceNumber)).send(body);
    expect(first.status).toBe(200);

    const replay = await request(app.server).post(slotHoldPath("acme-hvac", referenceNumber)).send(body);
    expect(replay.status).toBe(409);
    expect(replay.body.message).toContain("already been used");
  });

  it("holds a slot when token, zip, and availability are valid", async () => {
    const { technician, holdToken, referenceNumber } = seedPublicHoldFixture();

    const response = await request(app.server)
      .post(slotHoldPath("acme-hvac", referenceNumber))
      .send({
        holdToken,
        technicianId: technician.id,
        scheduledStart: AFTERNOON_START,
        scheduledEnd: AFTERNOON_END
      });

    expect(response.status).toBe(200);
    expect(response.body.bookingRequest.status).toBe("pending");
    expect(response.body.hold.scheduledStart).toBe(AFTERNOON_START);
  });
});
