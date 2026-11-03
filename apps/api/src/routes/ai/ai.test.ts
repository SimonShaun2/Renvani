import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

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
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: vi.fn()
  },
  agreementsQueue: {
    add: vi.fn()
  },
  importsQueue: {
    add: vi.fn()
  },
  invoicesQueue: {
    add: vi.fn()
  },
  notificationsQueue: {
    add: vi.fn()
  },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  },
  webhooksQueue: {
    add: vi.fn()
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let app: AppInstance;
let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  resetRedisStore();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createAuthContext(role: "owner" | "admin" | "technician" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: `acme-${role}`,
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@example.com`,
    firstName: "Ava",
    lastName: "Stone",
    role
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return {
    company,
    user,
    authorization: `Bearer ${accessToken}`
  };
}

function seedRevenueGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    phone: "555-0100"
  });
  const property = fakeDb.seedProperty({
    companyId,
    customerId: customer.id,
    addressLine1: "101 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103"
  });
  const asset = fakeDb.seedAsset({
    companyId,
    customerId: customer.id,
    propertyId: property.id,
    name: "Main HVAC",
    assetType: "hvac",
    installDate: "2011-01-01"
  });
  const job = fakeDb.seedJob({
    companyId,
    customerId: customer.id,
    propertyId: property.id,
    assetId: asset.id,
    title: "Spring Tune-Up"
  });
  const estimate = fakeDb.seedEstimate({
    companyId,
    customerId: customer.id,
    jobId: job.id,
    estimateNumber: "EST-1001",
    total: "900.00",
    subtotal: "900.00",
    status: "sent"
  });
  const invoice = fakeDb.seedInvoice({
    companyId,
    customerId: customer.id,
    invoiceNumber: "INV-1001",
    total: "450.00",
    balanceDue: "225.00",
    status: "overdue"
  });

  return { customer, asset, job, estimate, invoice };
}

describe("ai routes", () => {
  it("GET /ai/revenue-summary returns 200 for owner and 403 for technician", async () => {
    const owner = createAuthContext("owner");
    const technician = createAuthContext("technician");
    const { customer } = seedRevenueGraph(owner.company.id);

    fakeDb.seedAiRecommendation({
      companyId: owner.company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "300.00",
      urgencyScore: 80,
      headline: "Dormant customer",
      body: "Reach out"
    });

    const successResponse = await request(app.server)
      .get("/api/v1/ai/revenue-summary")
      .set("Authorization", owner.authorization);
    const forbiddenResponse = await request(app.server)
      .get("/api/v1/ai/revenue-summary")
      .set("Authorization", technician.authorization);

    expect(successResponse.status).toBe(200);
    expect(successResponse.body).toMatchObject({
      dormantCustomers: {
        count: 1,
        estimatedRevenue: "300.00"
      },
      totalOpportunityValue: "300.00",
      fromCache: false
    });
    expect(forbiddenResponse.status).toBe(403);
  });

  it("GET /ai/recommendations returns paginated results and filters by type", async () => {
    const auth = createAuthContext("owner");
    const { customer, asset } = seedRevenueGraph(auth.company.id);

    fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "reactivation",
      customerId: customer.id,
      assetId: asset.id,
      estimatedRevenue: "350.00",
      urgencyScore: 90,
      headline: "Call back this customer",
      body: "Reach out today"
    });
    fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "unpaid_invoice",
      customerId: customer.id,
      estimatedRevenue: "225.00",
      urgencyScore: 70,
      headline: "Collect invoice",
      body: "Invoice overdue"
    });

    const response = await request(app.server)
      .get("/api/v1/ai/recommendations?type=reactivation&page=1&limit=10")
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].type).toBe("reactivation");
  });

  it("GET /ai/recommendations/:id returns recommendation detail for an in-tenant record", async () => {
    const auth = createAuthContext("owner");
    const { customer, asset, job, estimate, invoice } = seedRevenueGraph(auth.company.id);
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "unpaid_invoice",
      customerId: customer.id,
      assetId: asset.id,
      jobId: job.id,
      estimateId: estimate.id,
      invoiceId: invoice.id,
      estimatedRevenue: "225.00",
      urgencyScore: 88,
      confidenceScore: 72,
      headline: "Collect this overdue invoice",
      body: "Payment is still outstanding",
      suggestedAction: "Send reminder",
      suggestedMessage: "Your invoice is overdue."
    });

    const response = await request(app.server)
      .get(`/api/v1/ai/recommendations/${recommendation.id}`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.recommendation).toMatchObject({
      id: recommendation.id,
      type: "unpaid_invoice",
      status: "pending",
      headline: "Collect this overdue invoice",
      body: "Payment is still outstanding",
      suggestedAction: "Send reminder",
      suggestedMessage: "Your invoice is overdue.",
      estimatedRevenue: "225.00",
      urgencyScore: 88,
      confidenceScore: 72,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone
      },
      asset: {
        id: asset.id,
        name: asset.name,
        assetType: asset.assetType,
        installDate: asset.installDate
      },
      job: {
        id: job.id,
        jobNumber: job.jobNumber
      },
      estimate: {
        id: estimate.id,
        estimateNumber: estimate.estimateNumber,
        total: estimate.total
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        balanceDue: invoice.balanceDue
      },
      actionedAt: null,
      dismissedAt: null,
      snoozedUntil: null
    });
    expect(typeof response.body.recommendation.createdAt).toBe("string");
  });

  it("GET /ai/recommendations/:id returns 404 for an unknown recommendation id", async () => {
    const auth = createAuthContext("owner");

    const response = await request(app.server)
      .get(`/api/v1/ai/recommendations/${randomUUID()}`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("GET /ai/recommendations/:id returns 404 for a cross-tenant recommendation id", async () => {
    const auth = createAuthContext("owner");
    const otherTenant = createAuthContext("owner");
    const { customer } = seedRevenueGraph(otherTenant.company.id);
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: otherTenant.company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "300.00",
      urgencyScore: 80,
      headline: "Other tenant recommendation",
      body: "Should not be visible"
    });

    const response = await request(app.server)
      .get(`/api/v1/ai/recommendations/${recommendation.id}`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("POST /ai/recommendations/:id/action preserves unsupported actions and rejects proposal-supported types", async () => {
    const auth = createAuthContext("owner");
    const { customer } = seedRevenueGraph(auth.company.id);
    const pendingRecommendation = fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "aging_asset",
      customerId: customer.id,
      estimatedRevenue: "300.00",
      urgencyScore: 85,
      headline: "Action this",
      body: "Action body"
    });
    const actionedRecommendation = fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "aging_asset",
      customerId: customer.id,
      status: "actioned",
      actionedAt: new Date("2026-04-28T12:00:00.000Z"),
      estimatedRevenue: "250.00",
      urgencyScore: 60,
      headline: "Already actioned",
      body: "Actioned body"
    });
    const proposalSupported = fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "reactivation",
      customerId: customer.id,
      estimatedRevenue: "400.00",
      urgencyScore: 90,
      headline: "Proposal required",
      body: "Must go through approval"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/ai/recommendations/${pendingRecommendation.id}/action`)
      .set("Authorization", auth.authorization)
      .send({
        actionTaken: "called_customer"
      });
    const conflictResponse = await request(app.server)
      .post(`/api/v1/ai/recommendations/${actionedRecommendation.id}/action`)
      .set("Authorization", auth.authorization)
      .send({
        actionTaken: "called_customer"
      });
    const proposalRequiredResponse = await request(app.server)
      .post(`/api/v1/ai/recommendations/${proposalSupported.id}/action`)
      .set("Authorization", auth.authorization)
      .send({
        actionTaken: "called_customer"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.recommendation.status).toBe("actioned");
    expect(conflictResponse.status).toBe(409);
    expect(proposalRequiredResponse.status).toBe(409);
    expect(proposalRequiredResponse.body.message).toBe(
      "This recommendation requires a Revenue Agent proposal and operator approval"
    );
    expect(fakeDb.getTestState().aiRecommendations.find((row) => row.id === proposalSupported.id)?.status).toBe("pending");
  });

  it("POST /ai/recommendations/:id/dismiss succeeds", async () => {
    const auth = createAuthContext("owner");
    const { customer } = seedRevenueGraph(auth.company.id);
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "aging_asset",
      customerId: customer.id,
      estimatedRevenue: "1500.00",
      urgencyScore: 75,
      headline: "Dismiss this recommendation",
      body: "Dismiss body"
    });

    const response = await request(app.server)
      .post(`/api/v1/ai/recommendations/${recommendation.id}/dismiss`)
      .set("Authorization", auth.authorization)
      .send({
        reason: "Not needed"
      });

    expect(response.status).toBe(200);
    expect(response.body.recommendation.status).toBe("dismissed");
  });

  it("POST /ai/recommendations/:id/snooze succeeds and rejects past dates", async () => {
    const auth = createAuthContext("owner");
    const { customer } = seedRevenueGraph(auth.company.id);
    const futureSnoozeDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const pastSnoozeDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const recommendation = fakeDb.seedAiRecommendation({
      companyId: auth.company.id,
      type: "maintenance_plan_offer",
      customerId: customer.id,
      estimatedRevenue: "400.00",
      urgencyScore: 55,
      headline: "Snooze this recommendation",
      body: "Snooze body"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/ai/recommendations/${recommendation.id}/snooze`)
      .set("Authorization", auth.authorization)
      .send({
        snoozedUntil: futureSnoozeDate
      });
    const validationResponse = await request(app.server)
      .post(`/api/v1/ai/recommendations/${recommendation.id}/snooze`)
      .set("Authorization", auth.authorization)
      .send({
        snoozedUntil: pastSnoozeDate
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.recommendation.status).toBe("snoozed");
    expect(validationResponse.status).toBe(400);
  });
});
