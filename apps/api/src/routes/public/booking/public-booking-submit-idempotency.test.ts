import { randomUUID } from "node:crypto";

import request from "supertest";
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

function seedPublicSubmitFixture() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });

  fakeDb.seedBookingSettings({
    companyId: company.id,
    bookingSlug: "acme-hvac",
    isEnabled: true,
    autoConfirm: false
  });

  fakeDb.seedTechnician({
    companyId: company.id,
    firstName: "Taylor",
    lastName: "Tech",
    phone: "555-0101",
    serviceZipCodes: ["74103"]
  });

  return company;
}

function submitBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jamie",
    lastName: "Stone",
    phone: "555-0200",
    email: "jamie@example.com",
    addressLine1: "500 Oak Ave",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    urgency: "this_week",
    preferredWindow: "afternoon",
    smsConsentAppointments: false,
    smsConsentMarketing: false,
    ...overrides
  };
}

beforeAll(async () => {
  buildAppModule = await import("../../../app.js");
  fakeDb = await import("../../../test-support/fake-db.js");
});

beforeEach(async () => {
  vi.clearAllMocks();
  fakeDb.resetTestState();
  resetPublicBookingRateLimitStateForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-28T14:00:00.000Z"));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

describe("public booking submit idempotency (FS-38)", () => {
  it("replays the same Idempotency-Key with 200 and the same reference number", async () => {
    seedPublicSubmitFixture();
    const idempotencyKey = randomUUID();
    const body = submitBody();

    const first = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/submit?src=google")
      .set("Idempotency-Key", idempotencyKey)
      .send(body);

    const second = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/submit?src=google")
      .set("Idempotency-Key", idempotencyKey)
      .send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.bookingRequest.referenceNumber).toBe(first.body.bookingRequest.referenceNumber);
  });

  it("returns 409 when the same Idempotency-Key is reused with a different payload", async () => {
    seedPublicSubmitFixture();
    const idempotencyKey = randomUUID();

    const first = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/submit")
      .set("Idempotency-Key", idempotencyKey)
      .send(submitBody());

    const mismatch = await request(app.server)
      .post("/api/v1/public/booking/acme-hvac/submit")
      .set("Idempotency-Key", idempotencyKey)
      .send(submitBody({ phone: "555-0999" }));

    expect(first.status).toBe(201);
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error).toBe("CONFLICT");
    expect(mismatch.body.message).toMatch(/different payload/i);
    expect(mismatch.body.fields).toEqual({ reason: "idempotency_payload_mismatch" });
  });
});

describe("public inquiry-only intake (FS-229)", () => {
  function seedInquiryOnlyFixture(options: { coveredZip?: string; offeredServices?: Array<Record<string, unknown>> } = {}) {
    const company = fakeDb.seedCompany({ name: "New Plumbing", slug: "new-plumbing" });
    fakeDb.seedBookingSettings({
      companyId: company.id,
      bookingSlug: "new-plumbing",
      isEnabled: true,
      autoConfirm: true,
      notifyOnNewBooking: true,
      offeredServices: options.offeredServices ?? []
    });
    if (options.coveredZip) {
      fakeDb.seedServiceArea({ companyId: company.id, name: "Service area", zips: [options.coveredZip] });
    }
    return company;
  }

  it("captures an unqualified pending inquiry with no booking effects when coverage is unknown", async () => {
    const company = seedInquiryOnlyFixture();
    const body = submitBody({ serviceDetail: "Kitchen drain is slow", smsConsentAppointments: true });
    const key = randomUUID();
    const first = await request(app.server)
      .post("/api/v1/public/booking/new-plumbing/submit?src=direct")
      .set("Idempotency-Key", key)
      .send(body);
    const replay = await request(app.server)
      .post("/api/v1/public/booking/new-plumbing/submit?src=direct")
      .set("Idempotency-Key", key)
      .send(body);

    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      kind: "inquiry_only",
      bookingRequest: { id: expect.any(String), referenceNumber: expect.any(String), status: "pending" },
      serviceability: "unknown"
    });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    const state = fakeDb.getTestState();
    expect(state.bookingRequests).toHaveLength(1);
    expect(state.bookingRequests[0]).toMatchObject({ companyId: company.id, status: "pending", serviceDetail: "Kitchen drain is slow", smsConsentAppointments: true, smsConsentMarketing: false });
    expect(state.jobs).toHaveLength(0);
    expect(state.activityEvents.some((event) => event.eventType === "revenue.inquiry_received" && event.companyId === company.id)).toBe(true);
    const { notificationsQueue } = await import("@fsm/jobs");
    expect(notificationsQueue.add).not.toHaveBeenCalled();
  });

  it("captures inquiry-only for known in-area coverage without creating a job", async () => {
    const company = seedInquiryOnlyFixture({ coveredZip: "74103" });
    const response = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit").send(submitBody());
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ kind: "inquiry_only", serviceability: "in_area", bookingRequest: { status: "pending" } });
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(1);
    expect(fakeDb.getTestState().bookingRequests[0]?.companyId).toBe(company.id);
    expect(fakeDb.getTestState().jobs).toHaveLength(0);
  });

  it("denies known out-of-area and preserves zero write effects", async () => {
    seedInquiryOnlyFixture({ coveredZip: "74104" });
    const response = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit").send(submitBody());
    expect(response.status).toBe(409);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
    expect(fakeDb.getTestState().jobs).toHaveLength(0);
  });

  it("does not capture an unknown-coverage request when a service is configured", async () => {
    seedInquiryOnlyFixture({ offeredServices: [{ id: "drain-cleaning", name: "Drain cleaning" }] });
    const response = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit").send(submitBody());
    expect(response.status).toBe(409);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
  });

  it("rejects a changed idempotency payload and an unrelated tenant slug", async () => {
    const company = seedInquiryOnlyFixture();
    const other = fakeDb.seedCompany({ name: "Other Shop", slug: "other-shop" });
    fakeDb.seedBookingSettings({ companyId: other.id, bookingSlug: "other-shop", isEnabled: true });
    const key = randomUUID();
    const first = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit").set("Idempotency-Key", key).send(submitBody());
    const mismatch = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit").set("Idempotency-Key", key).send(submitBody({ phone: "555-0999" }));
    const otherResponse = await request(app.server).post("/api/v1/public/booking/missing-shop/submit").send(submitBody());
    expect(first.status).toBe(201);
    expect(mismatch.status).toBe(409);
    expect(otherResponse.status).toBe(404);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(1);
    expect(fakeDb.getTestState().bookingRequests[0]?.companyId).toBe(company.id);
  });

  it("keeps the same key separate for each tenant", async () => {
    const firstCompany = seedInquiryOnlyFixture();
    const secondCompany = fakeDb.seedCompany({ name: "Other Plumbing", slug: "other-plumbing" });
    fakeDb.seedBookingSettings({
      companyId: secondCompany.id,
      bookingSlug: "other-plumbing",
      isEnabled: true,
      offeredServices: []
    });
    const key = randomUUID();
    const first = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit")
      .set("Idempotency-Key", key).send(submitBody());
    const second = await request(app.server).post("/api/v1/public/booking/other-plumbing/submit")
      .set("Idempotency-Key", key).send(submitBody());

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(second.body.bookingRequest.id).not.toBe(first.body.bookingRequest.id);
    expect(fakeDb.getTestState().bookingRequests.map((row) => row.companyId).sort())
      .toEqual([firstCompany.id, secondCompany.id].sort());
    expect(fakeDb.getTestState().inquirySubmitIdempotency).toHaveLength(2);
    expect(fakeDb.getTestState().jobs).toHaveLength(0);
    const { notificationsQueue } = await import("@fsm/jobs");
    expect(notificationsQueue.add).not.toHaveBeenCalled();
  });

  it("rolls back every inquiry effect when the idempotency insert fails, then permits a retry", async () => {
    seedInquiryOnlyFixture();
    const key = randomUUID();
    const insert = fakeDb.db.insert.bind(fakeDb.db);
    const failInsert = vi.spyOn(fakeDb.db, "insert").mockImplementation((table) => {
      if (table === fakeDb.inquirySubmitIdempotency) {
        throw new Error("Simulated idempotency insert failure");
      }
      return insert(table);
    });

    try {
      const failed = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit")
        .set("Idempotency-Key", key).send(submitBody());
      expect(failed.status).toBe(500);
      const state = fakeDb.getTestState();
      expect(state.bookingRequests).toHaveLength(0);
      expect(state.customers).toHaveLength(0);
      expect(state.properties).toHaveLength(0);
      expect(state.activityEvents).toHaveLength(0);
      expect(state.inquirySubmitIdempotency).toHaveLength(0);
      expect(state.jobs).toHaveLength(0);
      const { notificationsQueue } = await import("@fsm/jobs");
      expect(notificationsQueue.add).not.toHaveBeenCalled();
    } finally {
      failInsert.mockRestore();
    }

    const retry = await request(app.server).post("/api/v1/public/booking/new-plumbing/submit")
      .set("Idempotency-Key", key).send(submitBody());
    expect(retry.status).toBe(201);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(1);
    expect(fakeDb.getTestState().inquirySubmitIdempotency).toHaveLength(1);
    expect(fakeDb.getTestState().activityEvents.filter((event) =>
      event.eventType === "booking.requested" || event.eventType === "revenue.inquiry_received"
    )).toHaveLength(2);
  });
});
