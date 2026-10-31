import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1)
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type HashModule = typeof import("../../services/growth/call-tracking-caller-hash.js");
type SourcesModule = typeof import("../../services/command-center/command-center-sources.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let hash: HashModule;
let sourcesLib: SourcesModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
  hash = await import("../../services/growth/call-tracking-caller-hash.js");
  sourcesLib = await import("../../services/command-center/command-center-sources.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

const PATH = "/api/v1/command-center/brief";
const QUERY = { date: "2026-10-15", timeZone: "America/Chicago" };
const OCT = (day: number, hour = 15) => new Date(`2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`);
const SEP = (day: number) => new Date(`2026-09-${String(day).padStart(2, "0")}T15:00:00.000Z`);
const SECRET_NAME = "Zebulon";
const SECRET_PHONE = "5125550199";

function seedTenant(slug: string, role: "owner" | "admin" | "dispatcher" | "technician" = "owner") {
  const company = fakeDb.seedCompany({ name: `${slug} HVAC`, slug });
  const user = fakeDb.seedUser({ companyId: company.id, email: `${role}@${slug}.test`, firstName: "Pat", lastName: "Owner", role });
  const token = tokens.generateAccessToken({ userId: user.id, companyId: company.id, role: user.role });
  return { company, user, auth: `Bearer ${token}` };
}

function seedCustomer(companyId: string) {
  return fakeDb.seedCustomer({ companyId, firstName: SECRET_NAME, lastName: "Quixote", phone: SECRET_PHONE, email: "zeb@private.test" } as never);
}

function seedBooking(companyId: string, values: Record<string, unknown> = {}) {
  return fakeDb.seedBookingRequest({
    companyId,
    firstName: SECRET_NAME,
    lastName: "Quixote",
    phone: SECRET_PHONE,
    addressLine1: "1 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    createdAt: OCT(10),
    ...values
  } as never);
}

function seedCall(companyId: string, startedAt: Date, callerE164: string | null) {
  const number = fakeDb.seedCallTrackingNumber({ companyId, trackingNumber: `+1512555${String(Math.floor(Math.random() * 9000) + 1000)}` });
  return fakeDb.seedCallRecord({
    companyId,
    trackingNumberId: number.id,
    providerCallId: `call-${Math.random()}`,
    startedAt,
    callerHash: callerE164 ? hash.hashCallerNumber(companyId, callerE164) : null
  } as never);
}

function getBrief(auth: string, query: Record<string, string> = QUERY) {
  return request(app.server).get(PATH).query(query).set("Authorization", auth);
}

function kpi(body: { kpis: Array<{ key: string }> }, key: string) {
  return body.kpis.find((k) => k.key === key) as unknown as Record<string, unknown> & { sources: Array<{ kind: string; id: string; label: string; route: string }> };
}

describe("GET /api/v1/command-center/brief — auth and validation", () => {
  it("FS29-01 requires auth; dispatcher and technician get 403 before query validation; admin allowed", async () => {
    await request(app.server).get(PATH).query(QUERY).expect(401);
    const dispatcher = seedTenant("disp-co", "dispatcher");
    await getBrief(dispatcher.auth).expect(403);
    // Invalid query still 403: role runs in onRequest before preValidation.
    await getBrief(dispatcher.auth, { period: "last_30_days", bogus: "1" }).expect(403);
    const tech = seedTenant("tech-co", "technician");
    await getBrief(tech.auth).expect(403);
    const admin = seedTenant("admin-co", "admin");
    await getBrief(admin.auth).expect(200);
  });

  it("FS29-02 rejects invalid dates, time zones, unknown keys and non-month periods for owners", async () => {
    const { auth } = seedTenant("val-co");
    await getBrief(auth, { date: "2026-13-40" }).expect(400);
    await getBrief(auth, { timeZone: "Mars/Olympus" }).expect(400);
    await getBrief(auth, { period: "last_30_days" }).expect(400);
    await getBrief(auth, { companyId: "00000000-0000-0000-0000-000000000000" }).expect(400);
    const ok = await getBrief(auth, { ...QUERY, period: "month" }).expect(200);
    expect(ok.body.period).toMatchObject({
      date: "2026-10-15",
      period: "month",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      compareStartDate: "2026-09-01",
      compareEndDate: "2026-09-30",
      timeZone: "America/Chicago"
    });
  });
});

describe("GET /api/v1/command-center/brief — composition", () => {
  it("FS29-03 returns a fully shaped empty state for a tenant with no data", async () => {
    const { auth } = seedTenant("empty-co");
    const response = await getBrief(auth).expect(200);
    const body = response.body;
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(body.kpis.map((k: { key: string }) => k.key)).toEqual(["direct_inquiries", "inquiry_to_booked", "first_to_recurring", "marketing_revenue"]);
    expect(kpi(body, "direct_inquiries")).toMatchObject({ value: 0, previousValue: 0, sources: [] });
    expect(kpi(body, "inquiry_to_booked")).toMatchObject({ value: null, denominator: 0 });
    expect(kpi(body, "first_to_recurring")).toMatchObject({ value: null, denominator: 0 });
    expect(kpi(body, "marketing_revenue")).toMatchObject({ value: "0.00", previousValue: "0.00", detail: "0 rebookings · 0 campaigns" });
    expect(body.loop.map((s: { stage: string; count: number }) => [s.stage, s.count])).toEqual([["discover", 0], ["book", 0], ["complete", 0], ["rebook", 0]]);
    expect(body.needsYou).toEqual({ counts: { approvals: 0, exceptions: 0 }, items: [], truncated: false });
    expect(body.header).toEqual({ approvalsWaiting: 0, exceptions: 0 });
    expect(body.crewsToday).toEqual([]);
    expect(body.today).toEqual({ jobsToday: 0, sources: [] });
    expect(body.emptyStates).toEqual({ hasAnyData: false, missing: ["inquiries", "jobs", "agent_actions", "crews"] });
    for (const k of body.kpis) expect(typeof k.definition).toBe("string");
  });

  it("FS29-04 counts direct inquiries and dedupes a tracked call against a booking from the same caller within 24h", async () => {
    const { company, auth } = seedTenant("dedupe-co");
    const booking = seedBooking(company.id, { createdAt: OCT(10, 15), referenceNumber: "BR-1001" });
    const duplicateCall = seedCall(company.id, OCT(10, 20), "+15125550199"); // same caller, 5h later -> deduped
    const lateCall = seedCall(company.id, OCT(12, 16), "+15125550199"); // same caller, >24h -> counted
    const otherCall = seedCall(company.id, OCT(11), "+15125550111"); // different caller -> counted
    seedCall(company.id, SEP(20), null); // previous month
    const { body } = await getBrief(auth).expect(200);
    const direct = kpi(body, "direct_inquiries");
    expect(direct).toMatchObject({ value: 3, previousValue: 1, detail: "1 booking requests · 2 tracked calls" });
    const ids = direct.sources.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([booking.id, lateCall.id, otherCall.id]));
    expect(ids).not.toContain(duplicateCall.id);
    expect(direct.sources.find((s) => s.id === booking.id)).toMatchObject({ kind: "booking_request", label: "BR-1001", route: `/booking-requests?id=${encodeURIComponent(booking.id)}` });
    expect(direct.sources.find((s) => s.id === otherCall.id)?.route).toBe(`/growth/call-tracking?call=${encodeURIComponent(otherCall.id)}`);
    expect(body.loop[0]).toMatchObject({ stage: "discover", count: 3 });
  });

  it("FS29-05 inquiry → booked cites the booking and the booked job", async () => {
    const { company, auth } = seedTenant("conv-co");
    const customer = seedCustomer(company.id);
    const booked = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, status: "scheduled", jobNumber: "J-4519", createdAt: OCT(11) } as never);
    const lead = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, status: "lead", createdAt: OCT(11) } as never);
    const b1 = seedBooking(company.id, { jobId: booked.id });
    seedBooking(company.id, { jobId: lead.id, phone: "5125550000" });
    const { body } = await getBrief(auth).expect(200);
    expect(kpi(body, "inquiry_to_booked")).toMatchObject({ value: 50, numerator: 1, denominator: 2 });
    const src = kpi(body, "inquiry_to_booked").sources;
    expect(src.map((s) => s.id).sort()).toEqual([b1.id, booked.id].sort());
    expect(src.find((s) => s.id === booked.id)).toMatchObject({ kind: "job", label: "J-4519", route: `/jobs/${booked.id}` });
    expect(body.loop[1]).toMatchObject({ stage: "book", count: 1 });
  });

  it("FS29-06 first → recurring counts an active plan or a later booked job", async () => {
    const { company, auth } = seedTenant("recur-co");
    const withPlan = seedCustomer(company.id);
    const withRepeat = seedCustomer(company.id);
    const oneOff = seedCustomer(company.id);
    const lapsed = seedCustomer(company.id);
    fakeDb.seedJob({ companyId: company.id, customerId: withPlan.id, status: "completed", createdAt: OCT(2) } as never);
    const plan = fakeDb.seedMaintenancePlan({ companyId: company.id, customerId: withPlan.id, status: "active" } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: withRepeat.id, status: "completed", createdAt: OCT(3) } as never);
    const repeat = fakeDb.seedJob({ companyId: company.id, customerId: withRepeat.id, status: "scheduled", createdAt: OCT(20) } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: oneOff.id, status: "completed", createdAt: OCT(4) } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: lapsed.id, status: "completed", createdAt: OCT(5) } as never);
    fakeDb.seedMaintenancePlan({ companyId: company.id, customerId: lapsed.id, status: "cancelled" } as never);
    const { body } = await getBrief(auth).expect(200);
    expect(kpi(body, "first_to_recurring")).toMatchObject({ value: 50, numerator: 2, denominator: 4 });
    const src = kpi(body, "first_to_recurring").sources;
    expect(src.map((s) => s.id)).toEqual(expect.arrayContaining([withPlan.id, plan.id, withRepeat.id, repeat.id]));
    expect(src.find((s) => s.id === plan.id)?.route).toBe(`/service-agreements/${plan.id}`);
    expect(src.find((s) => s.id === withPlan.id)?.label).toMatch(/^CUST-/u);
  });

  it("FS29-07 marketing revenue sums paid rebooking and campaign invoices in cents", async () => {
    const { company, auth } = seedTenant("rev-co");
    const customer = seedCustomer(company.id);
    const plan = fakeDb.seedMaintenancePlan({ companyId: company.id, customerId: customer.id, status: "active" } as never);
    const first = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, status: "paid", createdAt: SEP(1) } as never);
    const planJob = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, status: "paid", maintenancePlanId: plan.id, createdAt: OCT(2) } as never);
    const other = seedCustomer(company.id);
    const campaignJob = fakeDb.seedJob({ companyId: company.id, customerId: other.id, status: "paid", leadAttribution: { utm_campaign: "fall-tuneup" }, createdAt: OCT(3) } as never);
    const inv1 = fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id, jobId: planJob.id, status: "paid", amountPaid: "100.10", paidAt: OCT(5), invoiceNumber: "INV-1" } as never);
    fakeDb.seedInvoice({ companyId: company.id, customerId: other.id, jobId: campaignJob.id, status: "paid", amountPaid: "0.20", paidAt: OCT(6), invoiceNumber: "INV-2" } as never);
    fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id, jobId: first.id, status: "paid", amountPaid: "999.00", paidAt: OCT(7) } as never); // first job: not marketing
    fakeDb.seedInvoice({ companyId: company.id, customerId: other.id, jobId: campaignJob.id, status: "sent", amountPaid: "50.00", paidAt: null } as never);
    const { body } = await getBrief(auth).expect(200);
    expect(kpi(body, "marketing_revenue")).toMatchObject({ value: "100.30", previousValue: "0.00", detail: "1 rebookings · 1 campaigns" });
    expect(kpi(body, "marketing_revenue").sources.find((s) => s.id === inv1.id)).toMatchObject({ kind: "invoice", label: "INV-1", route: `/invoices/${inv1.id}` });
  });

  it("FS29-08 needs-you separates suggestions from facts and counts approvals vs exceptions", async () => {
    const { company, auth } = seedTenant("needs-co");
    const customer = seedCustomer(company.id);
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, status: "scheduled", jobNumber: "J-77" } as never);
    const target = { entityType: "job", entityId: job.id };
    const awaiting = fakeDb.seedAgentAction({ companyId: company.id, state: "awaiting_approval", target } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "failed", target } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "escalated", target } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "succeeded", target, executionReceipt: { deliveryState: "failed" } } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "succeeded", target, executionReceipt: { deliveryState: "delivered" } } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "cancelled", target } as never);
    const { body } = await getBrief(auth).expect(200);
    expect(body.needsYou.counts).toEqual({ approvals: 1, exceptions: 3 });
    expect(body.header).toEqual({ approvalsWaiting: 1, exceptions: 3 });
    const states = body.needsYou.items.map((i: { state: string; kind: string }) => `${i.state}:${i.kind}`).sort();
    expect(states).toEqual(["awaiting_approval:suggestion", "delivery_failed:fact", "escalated:fact", "execution_failed:fact"]);
    const item = body.needsYou.items.find((i: { actionId: string }) => i.actionId === awaiting.id);
    expect(item).toMatchObject({ primaryAction: "approve", version: awaiting.updatedAt.getTime() });
    expect(item.sources).toEqual([
      expect.objectContaining({ kind: "agent_action", route: `/command-center/approvals?id=${encodeURIComponent(awaiting.id)}` }),
      expect.objectContaining({ kind: "job", label: "J-77", route: `/jobs/${job.id}` })
    ]);
  });

  it("FS29-09 crews today reports job counts and on-route / exception / off / scheduled status", async () => {
    const { company, auth } = seedTenant("crew-co");
    const customer = seedCustomer(company.id);
    const now = new Date();
    const alpha = fakeDb.seedCrew({ companyId: company.id, name: "Alpha" });
    const bravo = fakeDb.seedCrew({ companyId: company.id, name: "Bravo" });
    const charlie = fakeDb.seedCrew({ companyId: company.id, name: "Charlie" });
    const delta = fakeDb.seedCrew({ companyId: company.id, name: "Delta" });
    fakeDb.seedCrew({ companyId: company.id, name: "Retired", isActive: false });
    fakeDb.seedJob({ companyId: company.id, customerId: customer.id, crewId: alpha.id, status: "dispatched", scheduledStart: now } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: customer.id, crewId: alpha.id, status: "scheduled", scheduledStart: now } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: customer.id, crewId: bravo.id, status: "on_hold", scheduledStart: now } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: customer.id, crewId: delta.id, status: "scheduled", scheduledStart: now } as never);
    fakeDb.seedJob({ companyId: company.id, customerId: customer.id, crewId: delta.id, status: "cancelled", scheduledStart: now } as never);
    const { body } = await getBrief(auth, { timeZone: "America/Chicago" }).expect(200);
    expect(body.crewsToday.map((c: { name: string; status: string; jobCount: number }) => [c.name, c.status, c.jobCount])).toEqual([
      ["Alpha", "on_route", 2],
      ["Bravo", "exception", 1],
      ["Charlie", "off", 0],
      ["Delta", "scheduled", 1]
    ]);
    expect(body.crewsToday[2].sources[0]).toMatchObject({ kind: "crew", id: charlie.id, route: `/dispatch?crew=${encodeURIComponent(charlie.id)}` });
    expect(body.today.jobsToday).toBe(4);
  });

  it("FS29-10 is tenant-isolated and never exposes customer names, phones or emails", async () => {
    const mine = seedTenant("mine-co");
    const theirs = seedTenant("theirs-co");
    const theirCustomer = seedCustomer(theirs.company.id);
    seedBooking(theirs.company.id);
    seedCall(theirs.company.id, OCT(11), "+15125550111");
    fakeDb.seedJob({ companyId: theirs.company.id, customerId: theirCustomer.id, status: "scheduled", createdAt: OCT(3) } as never);
    fakeDb.seedAgentAction({ companyId: theirs.company.id, state: "awaiting_approval" } as never);
    fakeDb.seedCrew({ companyId: theirs.company.id, name: "Their crew" });

    const myCustomer = seedCustomer(mine.company.id);
    const myBooking = seedBooking(mine.company.id, { referenceNumber: null });
    fakeDb.seedJob({ companyId: mine.company.id, customerId: myCustomer.id, status: "scheduled", createdAt: OCT(3) } as never);

    const { body } = await getBrief(mine.auth).expect(200);
    expect(kpi(body, "direct_inquiries").value).toBe(1);
    expect(kpi(body, "direct_inquiries").sources[0]).toMatchObject({ id: myBooking.id, label: `INQ-${sourcesLib.shortId(myBooking.id)}` });
    expect(kpi(body, "first_to_recurring")).toMatchObject({ denominator: 1 });
    expect(body.needsYou.counts.approvals).toBe(0);
    expect(body.crewsToday).toEqual([]);
    const json = JSON.stringify(body);
    expect(json).not.toContain(SECRET_NAME);
    expect(json).not.toContain("Quixote");
    expect(json).not.toContain(SECRET_PHONE);
    expect(json).not.toContain("private.test");
    expect(json).not.toContain(theirs.company.id);
  });
});

describe("GET /api/v1/command-center/brief — determinism", () => {
  it("FS29-12 is reproducible for the same data and params and writes nothing", async () => {
    const { company, auth } = seedTenant("det-co");
    const customer = seedCustomer(company.id);
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, status: "scheduled", createdAt: OCT(3) } as never);
    seedBooking(company.id, { jobId: job.id });
    fakeDb.seedAgentAction({ companyId: company.id, state: "awaiting_approval" } as never);
    const before = JSON.stringify(fakeDb.getTestState());
    const first = (await getBrief(auth).expect(200)).body;
    const second = (await getBrief(auth).expect(200)).body;
    delete first.generatedAt;
    delete second.generatedAt;
    expect(second).toEqual(first);
    expect(JSON.stringify(fakeDb.getTestState())).toBe(before);
  });
});

describe("command-center source helpers", () => {
  it("FS29-11 labels fall back to prefixed short ids when a record number is unsafe, and phones normalize to E.164", () => {
    expect(sourcesLib.commandCenterSourceLabel("job", "abc-def-123456789", "J-1")).toBe("J-1");
    expect(sourcesLib.commandCenterSourceLabel("booking_request", "abcd1234-ef", "Jane Doe")).toBe("INQ-abcd1234");
    expect(sourcesLib.commandCenterSourceLabel("customer", "11112222-3333")).toBe("CUST-11112222");
    expect(sourcesLib.normalizeBookingPhoneE164("(512) 555-0199")).toBe("+15125550199");
    expect(sourcesLib.normalizeBookingPhoneE164("1-512-555-0199")).toBe("+15125550199");
    expect(sourcesLib.normalizeBookingPhoneE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(sourcesLib.normalizeBookingPhoneE164("12")).toBeNull();
    const capped = sourcesLib.capSources(
      Array.from({ length: 25 }, (_, i) => ({ kind: "job" as const, id: `j${i}`, label: `J-${i}`, route: `/jobs/j${i}`, occurredAt: new Date(2026, 0, i + 1).toISOString() })),
      20
    );
    expect(capped.sources).toHaveLength(20);
    expect(capped.truncated).toBe(true);
    expect(capped.sources[0]!.id).toBe("j24");
  });
});
