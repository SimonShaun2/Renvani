import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
type TokensModule = typeof import("../../../lib/tokens.js");
let tokens: TokensModule;

const AFTERNOON_START = "2026-04-28T12:00:00.000Z";
const AFTERNOON_END = "2026-04-28T17:00:00.000Z";

function seedTenant(slug: string) {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug, timezone: "America/Chicago" });
  fakeDb.seedBookingSettings({
    companyId: company.id,
    bookingSlug: slug,
    isEnabled: true,
    autoConfirm: false,
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
  return { company, technician };
}

function bearer(companyId: string, role: "owner" | "admin" | "dispatcher" | "technician") {
  const user = fakeDb.seedUser({
    companyId,
    email: `${role}-${companyId.slice(0, 8)}@lead.test`,
    firstName: "Test",
    lastName: role,
    role
  });
  return `Bearer ${tokens.generateAccessToken({ userId: user.id, companyId, role: user.role })}`;
}

const submitBody = {
  firstName: "Jamie",
  lastName: "Stone",
  phone: "555-0200",
  addressLine1: "500 Oak Ave",
  city: "Tulsa",
  state: "OK",
  zip: "74103",
  urgency: "this_week",
  preferredWindow: "afternoon"
};

async function bookAndConfirm(slug: string, companyId: string, leadAttribution?: unknown) {
  // Each call simulates a separate visitor (public submit is IP rate-limited).
  resetPublicBookingRateLimitStateForTests();
  // One technician per booking so confirmed slots never conflict.
  const technicianId = fakeDb.seedTechnician({
    companyId,
    firstName: "Slot",
    lastName: "Tech",
    phone: "555-0102",
    serviceZipCodes: ["74103"]
  }).id;
  const submit = await request(app.server)
    .post(`/api/v1/public/booking/${slug}/submit?src=google`)
    .send(leadAttribution === undefined ? submitBody : { ...submitBody, leadAttribution });
  expect(submit.status).toBe(201);
  const ref = submit.body.bookingRequest.referenceNumber as string;
  const slot = { technicianId, scheduledStart: AFTERNOON_START, scheduledEnd: AFTERNOON_END };
  const hold = await request(app.server)
    .post(`/api/v1/public/booking/${slug}/requests/${ref}/slot-hold`)
    .send({ holdToken: submit.body.holdToken, ...slot });
  expect(hold.status).toBe(200);
  const confirm = await request(app.server)
    .post(`/api/v1/public/booking/${slug}/requests/${ref}/confirm`)
    .send(slot);
  expect(confirm.status).toBe(200);
  return { bookingRequestId: submit.body.bookingRequest.id as string, jobId: confirm.body.jobId as string };
}

beforeAll(async () => {
  buildAppModule = await import("../../../app.js");
  fakeDb = await import("../../../test-support/fake-db.js");
  tokens = await import("../../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  resetPublicBookingRateLimitStateForTests();
  resetBookingHoldTokenJtiStateForTests();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-04-28T14:00:00.000Z"));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

describe("Growth lead attribution: public booking -> job -> paid invoice -> direct demand", () => {
  it("stores only whitelisted, sanitized attribution and carries it to the job", async () => {
    const { company } = seedTenant("acme-hvac");
    const { bookingRequestId, jobId } = await bookAndConfirm("acme-hvac", company.id, {
      utm_source: "  Google ",
      utm_medium: "cpc",
      utm_campaign: "jamie@example.com",
      referrer_host: "https://www.Example.com/path?q=1",
      ad_id: "12345",
      evil: "drop-me"
    });

    const state = fakeDb.getTestState();
    const expected = { utm_source: "google", utm_medium: "cpc", referrer_host: "example.com", ad_id: "12345" };
    expect(state.bookingRequests.find((row) => row.id === bookingRequestId)?.leadAttribution).toEqual(expected);
    expect(state.jobs.find((row) => row.id === jobId)?.leadAttribution).toEqual(expected);
  });

  it("keeps submit working with no or junk attribution (stored as null)", async () => {
    const { company } = seedTenant("acme-hvac");
    const { jobId } = await bookAndConfirm("acme-hvac", company.id, "not-an-object");
    expect(fakeDb.getTestState().jobs.find((row) => row.id === jobId)?.leadAttribution).toBeNull();
  });

  it("reports direct demand job counts and paid revenue by source, tenant-scoped and role-gated", async () => {
    const a = seedTenant("tenant-a");
    const b = seedTenant("tenant-b");
    const first = await bookAndConfirm("tenant-a", a.company.id, { utm_source: "google" });
    const second = await bookAndConfirm("tenant-a", a.company.id, { utm_source: "google" });
    await bookAndConfirm("tenant-a", a.company.id, { referrer_host: "nextdoor.com" });
    await bookAndConfirm("tenant-a", a.company.id);
    const other = await bookAndConfirm("tenant-b", b.company.id, { utm_source: "google" });

    const state = fakeDb.getTestState();
    const customerFor = (jobId: string) => state.jobs.find((row) => row.id === jobId)!.customerId;
    fakeDb.seedInvoice({ companyId: a.company.id, customerId: customerFor(first.jobId), jobId: first.jobId, status: "paid", total: "200.00" });
    fakeDb.seedInvoice({ companyId: a.company.id, customerId: customerFor(second.jobId), jobId: second.jobId, status: "sent", total: "999.00" });
    fakeDb.seedInvoice({ companyId: b.company.id, customerId: customerFor(other.jobId), jobId: other.jobId, status: "paid", total: "500.00" });

    const query = { startDate: "2026-04-01", endDate: "2026-04-30" };
    for (const role of ["owner", "admin", "dispatcher"] as const) {
      const response = await request(app.server)
        .get("/api/v1/reporting/direct-demand")
        .query(query)
        .set("Authorization", bearer(a.company.id, role));
      expect(response.status).toBe(200);
      expect(response.body.totals).toEqual({ jobCount: 3, paidRevenue: "200.00" });
      expect(response.body.sources).toEqual([
        { source: "google", jobCount: 2, paidRevenue: "200.00" },
        { source: "nextdoor.com", jobCount: 1, paidRevenue: "0.00" }
      ]);
    }

    const tenantB = await request(app.server)
      .get("/api/v1/reporting/direct-demand")
      .query(query)
      .set("Authorization", bearer(b.company.id, "owner"));
    expect(tenantB.body.totals).toEqual({ jobCount: 1, paidRevenue: "500.00" });

    await request(app.server)
      .get("/api/v1/reporting/direct-demand")
      .query(query)
      .set("Authorization", bearer(a.company.id, "technician"))
      .expect(403);
    await request(app.server).get("/api/v1/reporting/direct-demand").query(query).expect(401);
  });
});
