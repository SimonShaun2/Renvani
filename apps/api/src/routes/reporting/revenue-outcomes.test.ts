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

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

const PATH = "/api/v1/reporting/revenue-outcomes";
const RANGE = { startDate: "2026-10-01", endDate: "2026-10-31" };
const IN_RANGE = new Date("2026-10-10T15:00:00.000Z");

function seedOwner(slug: string, role: "owner" | "admin" | "dispatcher" | "technician" = "owner") {
  const company = fakeDb.seedCompany({ name: `${slug} HVAC`, slug });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@${slug}.test`,
    firstName: "Pat",
    lastName: "Owner",
    role
  });
  const token = tokens.generateAccessToken({ userId: user.id, companyId: company.id, role: user.role });
  return { company, user, auth: `Bearer ${token}` };
}

function seedBooking(companyId: string, values: Record<string, unknown> = {}) {
  return fakeDb.seedBookingRequest({
    companyId,
    firstName: "Furnace",
    lastName: "Caller",
    phone: "5555550100",
    addressLine1: "1 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    createdAt: IN_RANGE,
    ...values
  } as never);
}

describe("GET /api/v1/reporting/revenue-outcomes", () => {
  it("returns a zeroed, fully-shaped summary when the tenant has no data", async () => {
    const { auth } = seedOwner("zero-co");
    const response = await request(app.server).get(PATH).query(RANGE).set("Authorization", auth).expect(200);

    expect(response.body.funnel.map((stage: { stage: string }) => stage.stage)).toEqual([
      "inquiries",
      "qualified",
      "estimates_sent",
      "estimates_approved",
      "jobs_confirmed",
      "jobs_completed",
      "repeat_jobs"
    ]);
    expect(response.body.funnel.every((stage: { count: number }) => stage.count === 0)).toBe(true);
    expect(response.body.revenue).toEqual({
      completedRevenue: "0.00",
      newCustomerRevenue: "0.00",
      repeatCustomerRevenue: "0.00",
      repeatRevenueSharePercent: 0
    });
    expect(response.body.profit.contributionProfitPerCompletedJob).toBeNull();
    expect(response.body.guardrails.acceptanceRatePercent).toBeNull();
    expect(response.body.segments.customerType).toHaveLength(2);
    expect(response.body.definitions.length).toBeGreaterThan(5);
    expect(JSON.stringify(response.body).toLowerCase()).not.toMatch(/restaurant|table|diner/);
  });

  it("computes funnel, new vs repeat, agent-assisted split, profit and guardrails", async () => {
    const { company, auth } = seedOwner("funnel-co", "admin");
    const repeatCustomer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Rae", lastName: "Peat", leadSource: "google" });
    const newCustomer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Nia", lastName: "New" });

    // Prior job before the period makes repeatCustomer a repeat customer.
    fakeDb.seedJob({
      companyId: company.id,
      customerId: repeatCustomer.id,
      status: "paid",
      scheduledStart: new Date("2026-06-01T15:00:00.000Z"),
      amountPaid: "500.00"
    } as never);
    const repeatJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: repeatCustomer.id,
      status: "paid",
      leadSource: "google",
      scheduledStart: IN_RANGE,
      amountPaid: "300.00"
    } as never);
    const newJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: newCustomer.id,
      status: "completed",
      scheduledStart: IN_RANGE,
      invoiceTotal: "200.00"
    } as never);
    fakeDb.seedJob({
      companyId: company.id,
      customerId: newCustomer.id,
      status: "scheduled",
      scheduledStart: new Date("2026-10-20T15:00:00.000Z"),
      createdAt: new Date("2026-10-15T15:00:00.000Z"),
      estimateTotal: "900.00"
    } as never);

    const product = fakeDb.seedProductCatalog({ companyId: company.id, name: "Capacitor", unitPrice: "80.00", cost: "25.00" } as never);
    const noCost = fakeDb.seedProductCatalog({ companyId: company.id, name: "Labor kit", unitPrice: "10.00" } as never);
    fakeDb.seedJobProduct({ companyId: company.id, jobId: repeatJob.id, productCatalogId: product.id, name: "Capacitor", quantity: "2", unitPrice: "80.00", total: "160.00" } as never);
    fakeDb.seedJobProduct({ companyId: company.id, jobId: newJob.id, productCatalogId: noCost.id, name: "Labor kit", quantity: "1", unitPrice: "10.00", total: "10.00" } as never);

    const booking = seedBooking(company.id, { jobId: newJob.id, confirmedAt: IN_RANGE, status: "confirmed" });
    seedBooking(company.id);
    seedBooking(company.id, { createdAt: new Date("2026-08-01T15:00:00.000Z") });

    fakeDb.seedActivityEvent({
      companyId: company.id,
      eventType: "revenue.inquiry_qualified",
      entityType: "booking_request",
      entityId: booking.id,
      summary: "qualified",
      occurredAt: IN_RANGE
    } as never);
    fakeDb.seedActivityEvent({
      companyId: company.id,
      eventType: "agent.proposal_edited",
      entityType: "agent_action",
      entityId: booking.id,
      summary: "edited",
      occurredAt: IN_RANGE
    } as never);

    fakeDb.seedAgentAction({
      companyId: company.id,
      state: "succeeded",
      createdAt: IN_RANGE,
      target: { entityType: "booking_request", entityId: booking.id, recordVersion: "rv1:1" }
    } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "cancelled", createdAt: IN_RANGE } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "failed", createdAt: IN_RANGE } as never);
    fakeDb.seedAgentAction({ companyId: company.id, state: "escalated", createdAt: IN_RANGE } as never);

    fakeDb.seedEstimate({ companyId: company.id, customerId: newCustomer.id, sentAt: IN_RANGE, approvedAt: IN_RANGE } as never);
    fakeDb.seedEstimate({ companyId: company.id, customerId: newCustomer.id, sentAt: IN_RANGE } as never);

    const response = await request(app.server).get(PATH).query(RANGE).set("Authorization", auth).expect(200);
    const counts = Object.fromEntries(
      response.body.funnel.map((stage: { stage: string; count: number }) => [stage.stage, stage.count])
    );

    expect(counts).toEqual({
      inquiries: 2,
      qualified: 1,
      estimates_sent: 2,
      estimates_approved: 1,
      jobs_confirmed: 3,
      jobs_completed: 2,
      repeat_jobs: 2
    });
    expect(response.body.revenue).toEqual({
      completedRevenue: "500.00",
      newCustomerRevenue: "200.00",
      repeatCustomerRevenue: "300.00",
      repeatRevenueSharePercent: 60
    });
    const customerType = Object.fromEntries(
      response.body.segments.customerType.map((s: { segment: string }) => [s.segment, s])
    );
    expect(customerType.new).toMatchObject({ confirmedJobs: 1, completedJobs: 1, completedRevenue: "200.00" });
    expect(customerType.repeat).toMatchObject({ confirmedJobs: 2, completedJobs: 1, completedRevenue: "300.00" });
    const assistance = Object.fromEntries(
      response.body.segments.agentAssistance.map((s: { segment: string }) => [s.segment, s])
    );
    expect(assistance.agent_assisted).toMatchObject({ confirmedJobs: 1, completedJobs: 1, completedRevenue: "200.00" });
    expect(assistance.manual).toMatchObject({ confirmedJobs: 2, completedJobs: 1, completedRevenue: "300.00" });
    expect(response.body.profit).toEqual({
      costBasis: "materials_only",
      completedJobCount: 2,
      completedRevenue: "500.00",
      materialCost: "50.00",
      contributionProfit: "450.00",
      contributionProfitPerCompletedJob: "225.00",
      jobsWithIncompleteCostData: 1
    });
    expect(response.body.guardrails).toEqual({
      agentProposals: 4,
      accepted: 1,
      rejected: 1,
      escalated: 1,
      failed: 1,
      edited: 1,
      acceptanceRatePercent: 25,
      overrideRatePercent: 50,
      errorRatePercent: 25
    });
    expect(response.body.attribution.unknownSourceJobCount).toBe(2);
    // No PII: contact fields never leave the endpoint.
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("5555550100");
    expect(serialized).not.toContain("Furnace");
    expect(serialized).not.toContain("Nia");
  });

  it("ignores another tenant's data", async () => {
    const { auth } = seedOwner("tenant-a");
    const other = seedOwner("tenant-b");
    const customer = fakeDb.seedCustomer({ companyId: other.company.id, firstName: "B", lastName: "Only" });
    fakeDb.seedJob({ companyId: other.company.id, customerId: customer.id, status: "paid", scheduledStart: IN_RANGE, amountPaid: "999.00" } as never);
    seedBooking(other.company.id);
    fakeDb.seedAgentAction({ companyId: other.company.id, state: "succeeded", createdAt: IN_RANGE } as never);

    const response = await request(app.server).get(PATH).query(RANGE).set("Authorization", auth).expect(200);
    expect(response.body.funnel.every((stage: { count: number }) => stage.count === 0)).toBe(true);
    expect(response.body.revenue.completedRevenue).toBe("0.00");
    expect(response.body.guardrails.agentProposals).toBe(0);
  });

  it("returns 401 without credentials and 403 for dispatcher/technician", async () => {
    await request(app.server).get(PATH).query(RANGE).expect(401);
    for (const role of ["dispatcher", "technician"] as const) {
      const { auth } = seedOwner(`role-${role}`, role);
      const response = await request(app.server).get(PATH).query(RANGE).set("Authorization", auth);
      expect(response.status).toBe(403);
    }
  });

  it("validates the date range", async () => {
    const { auth } = seedOwner("range-co");
    const cases = [
      {},
      { startDate: "2026-10-01" },
      { startDate: "not-a-date", endDate: "2026-10-31" },
      { startDate: "2026-10-31", endDate: "2026-10-01" },
      { startDate: "2025-01-01", endDate: "2026-10-31" },
      { ...RANGE, includeJobIds: "true" }
    ];
    for (const query of cases) {
      const response = await request(app.server).get(PATH).query(query).set("Authorization", auth);
      expect(response.status, JSON.stringify(query)).toBe(400);
    }
  });
});
