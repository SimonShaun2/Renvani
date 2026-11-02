import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";
import { usePinnedTestSystemTime } from "../test-support/pinned-test-time.js";

setupTestEnv();
usePinnedTestSystemTime();

const {
  redisDelMock,
  redisGetMock,
  redisSetMock,
  resetRedisStore
} = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    redisDelMock: vi.fn(async (key: string) => {
      const deleted = store.delete(key);
      return deleted ? 1 : 0;
    }),
    redisGetMock: vi.fn(async (key: string) => store.get(key) ?? null),
    redisSetMock: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    resetRedisStore: () => {
      store.clear();
    }
  };
});

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  }
}));

type AiRevenueServiceModule = typeof import("./ai-revenue.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let aiRevenueService: AiRevenueServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  aiRevenueService = await import("./ai-revenue.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  resetRedisStore();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
});

function seedRevenueGraph() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: "Chris",
    lastName: "Pine",
    phone: "555-0100"
  });
  const asset = fakeDb.seedAsset({
    companyId: company.id,
    customerId: customer.id,
    propertyId: fakeDb.seedProperty({
      companyId: company.id,
      customerId: customer.id,
      addressLine1: "101 Main St",
      city: "Tulsa",
      state: "OK",
      zip: "74103"
    }).id,
    name: "Main HVAC",
    assetType: "hvac",
    installDate: "2011-01-01"
  });
  const job = fakeDb.seedJob({
    companyId: company.id,
    customerId: customer.id,
    assetId: asset.id,
    title: "Spring Tune-Up"
  });
  const estimate = fakeDb.seedEstimate({
    companyId: company.id,
    customerId: customer.id,
    jobId: job.id,
    estimateNumber: "EST-1001",
    total: "1000.00",
    subtotal: "1000.00",
    status: "sent"
  });
  const invoice = fakeDb.seedInvoice({
    companyId: company.id,
    customerId: customer.id,
    invoiceNumber: "INV-1001",
    total: "450.00",
    balanceDue: "200.00",
    status: "overdue"
  });

  return { company, actor, customer, asset, job, estimate, invoice };
}

describe("ai-revenue.service", () => {
  it("getRevenueSummary returns correct counts and sums, caches on first call, and excludes snoozed recommendations", async () => {
    const { company, customer, asset, estimate, invoice } = seedRevenueGraph();
    const futureSnoozeDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "300.00",
      urgencyScore: 90,
      headline: "Dormant customer",
      body: "Reach back out"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "unsold_estimate",
      customerId: customer.id,
      estimateId: estimate.id,
      estimatedRevenue: "999.00",
      urgencyScore: 80,
      headline: "Unsold estimate",
      body: "Follow up"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "unpaid_invoice",
      customerId: customer.id,
      invoiceId: invoice.id,
      estimatedRevenue: "999.00",
      urgencyScore: 70,
      headline: "Unpaid invoice",
      body: "Collect payment"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "aging_asset",
      customerId: customer.id,
      assetId: asset.id,
      estimatedRevenue: "1500.00",
      urgencyScore: 85,
      headline: "Aging asset",
      body: "Replacement opportunity"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "maintenance_plan_offer",
      customerId: customer.id,
      estimatedRevenue: "400.00",
      urgencyScore: 60,
      headline: "Offer a plan",
      body: "Maintenance plan opportunity"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "9000.00",
      urgencyScore: 95,
      headline: "Snoozed dormant customer",
      body: "Ignore until later",
      snoozedUntil: futureSnoozeDate
    });

    const firstSummary = await aiRevenueService.getRevenueSummary(company.id);

    expect(firstSummary.fromCache).toBe(false);
    expect(firstSummary.dormantCustomers.count).toBe(1);
    expect(firstSummary.dormantCustomers.estimatedRevenue).toBe("300.00");
    expect(firstSummary.unsoldEstimates.count).toBe(1);
    expect(firstSummary.unsoldEstimates.totalValue).toBe("1000.00");
    expect(firstSummary.unpaidInvoices.totalValue).toBe("200.00");
    expect(firstSummary.agingAssets.estimatedRevenue).toBe("1500.00");
    expect(firstSummary.maintenancePlanOpportunities.estimatedRevenue).toBe("400.00");
    expect(firstSummary.totalOpportunityValue).toBe("3400.00");
    expect(redisSetMock).toHaveBeenCalledTimes(1);

    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "111.00",
      urgencyScore: 10,
      headline: "Later add",
      body: "Should not appear from cache"
    });

    const cachedSummary = await aiRevenueService.getRevenueSummary(company.id);

    expect(cachedSummary.fromCache).toBe(true);
    expect(cachedSummary.dormantCustomers.count).toBe(1);
    expect(redisGetMock).toHaveBeenCalledTimes(2);
  });

  it("listRecommendations filters by type, excludes snoozed, and sorts urgency descending by default", async () => {
    const { company, customer, asset } = seedRevenueGraph();

    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      assetId: asset.id,
      estimatedRevenue: "300.00",
      urgencyScore: 45,
      headline: "Lower urgency",
      body: "Lower urgency body"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "350.00",
      urgencyScore: 90,
      headline: "Highest urgency",
      body: "Higher urgency body"
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "450.00",
      urgencyScore: 95,
      headline: "Snoozed item",
      body: "Snoozed",
      snoozedUntil: new Date("2026-05-10T12:00:00.000Z")
    });
    fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "aging_asset",
      customerId: customer.id,
      estimatedRevenue: "1200.00",
      urgencyScore: 80,
      headline: "Different type",
      body: "Different type body"
    });

    const result = await aiRevenueService.listRecommendations(company.id, {
      type: "reactivation"
    });

    expect(result.total).toBe(2);
    expect(result.data[0]?.headline).toBe("Highest urgency");
    expect(result.data[1]?.headline).toBe("Lower urgency");
    expect(result.data.every((row) => row.status !== "snoozed")).toBe(true);
  });

  it("actionRecommendation preserves unsupported direct actions and requires proposals for supported types", async () => {
    const { company, actor, customer } = seedRevenueGraph();
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "aging_asset",
      customerId: customer.id,
      estimatedRevenue: "300.00",
      urgencyScore: 80,
      headline: "Action me",
      body: "Take action"
    });

    const actioned = await aiRevenueService.actionRecommendation(
      company.id,
      actor.id,
      recommendation.id,
      {
        actionTaken: "called_customer"
      }
    );

    expect(actioned.status).toBe("actioned");
    expect(redisDelMock).toHaveBeenCalledWith(fakeDb.buildRevenueSummaryCacheKey(company.id));
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("ai.recommendation_actioned");

    const alreadyActioned = fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "aging_asset",
      customerId: customer.id,
      status: "actioned",
      actionedAt: new Date("2026-04-28T12:00:00.000Z"),
      estimatedRevenue: "200.00",
      urgencyScore: 50,
      headline: "Already done",
      body: "Already actioned"
    });

    await expect(
      aiRevenueService.actionRecommendation(company.id, actor.id, alreadyActioned.id, {
        actionTaken: "called_customer"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });

    const proposalSupported = fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "400.00",
      urgencyScore: 90,
      headline: "Proposal required",
      body: "Must go through approval"
    });
    await expect(
      aiRevenueService.actionRecommendation(company.id, actor.id, proposalSupported.id, {
        actionTaken: "called_customer"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      message: "This recommendation requires a Revenue Agent proposal and operator approval"
    });
    expect(fakeDb.getTestState().aiRecommendations.find((row) => row.id === proposalSupported.id)?.status).toBe("pending");
  });

  it("dismissRecommendation transitions status and invalidates cache", async () => {
    const { company, actor, customer } = seedRevenueGraph();
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "aging_asset",
      customerId: customer.id,
      estimatedRevenue: "1500.00",
      urgencyScore: 75,
      headline: "Dismiss me",
      body: "Dismiss this"
    });

    const dismissed = await aiRevenueService.dismissRecommendation(
      company.id,
      actor.id,
      recommendation.id,
      "Not relevant"
    );

    expect(dismissed.status).toBe("dismissed");
    expect(redisDelMock).toHaveBeenCalledWith(fakeDb.buildRevenueSummaryCacheKey(company.id));
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("ai.recommendation_dismissed");
  });

  it("snoozeRecommendation sets snoozedUntil and excludes the recommendation from the revenue summary", async () => {
    const { company, actor, customer } = seedRevenueGraph();
    const futureSnoozeDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: company.id,
      type: "maintenance_plan_offer",
      customerId: customer.id,
      estimatedRevenue: "400.00",
      urgencyScore: 55,
      headline: "Snooze me",
      body: "Snooze body"
    });

    const snoozed = await aiRevenueService.snoozeRecommendation(
      company.id,
      actor.id,
      recommendation.id,
      futureSnoozeDate.toISOString()
    );

    expect(snoozed.status).toBe("snoozed");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("ai.recommendation_snoozed");

    const summary = await aiRevenueService.getRevenueSummary(company.id);
    expect(summary.maintenancePlanOpportunities.count).toBe(0);
  });

  it("getRecommendation throws NOT_FOUND for unknown ids", async () => {
    const { company } = seedRevenueGraph();

    await expect(aiRevenueService.getRecommendation(company.id, randomUUID())).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });
});
