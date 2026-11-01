/**
 * FS-92 — API-level negative tests for unauthenticated access and cross-tenant isolation.
 * Synthetic tenants only. Direct DB/network isolation is gated on FS-80 / FS-93 (see matrix doc).
 */
import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";
import {
  orgASecretIds,
  seedSyntheticTenantPair,
  seedTenantIsolationBundle
} from "../../test-support/synthetic-tenant-fixtures.js";

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

vi.mock("../../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: vi.fn(),
  expireInvoiceCheckoutSession: vi.fn()
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

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

const UNAUTHENTICATED_READ_CASES: Array<{ id: string; method: "get"; path: string }> = [
  { id: "FS92-UNAUTH-01", method: "get", path: "/api/v1/customers" },
  { id: "FS92-UNAUTH-02", method: "get", path: "/api/v1/jobs" },
  { id: "FS92-UNAUTH-03", method: "get", path: "/api/v1/estimates" },
  { id: "FS92-UNAUTH-04", method: "get", path: "/api/v1/invoices" },
  { id: "FS92-UNAUTH-05", method: "get", path: "/api/v1/technicians" },
  { id: "FS92-UNAUTH-06", method: "get", path: "/api/v1/products" },
  { id: "FS92-UNAUTH-07", method: "get", path: "/api/v1/dispatch?date=2026-10-15" },
  { id: "FS92-UNAUTH-08", method: "get", path: "/api/v1/reporting/job-sources?startDate=2026-10-01&endDate=2026-10-31" },
  { id: "FS92-UNAUTH-09", method: "get", path: "/api/v1/company" },
  { id: "FS92-UNAUTH-10", method: "get", path: "/api/v1/ai/recommendations" },
  { id: "FS92-UNAUTH-11", method: "get", path: "/api/v1/campaigns" },
  { id: "FS92-UNAUTH-12", method: "get", path: "/api/v1/service-agreements" },
  { id: "FS92-UNAUTH-13", method: "get", path: "/api/v1/imports" },
  {
    id: "FS92-UNAUTH-14",
    method: "get",
    path: `/api/v1/attachments?entityType=job&entityId=${randomUUID()}`
  },
  { id: "FS92-UNAUTH-15", method: "get", path: "/api/v1/automation-rules" },
  { id: "FS92-UNAUTH-16", method: "get", path: "/api/v1/tenant-context" },
  { id: "FS92-UNAUTH-17", method: "get", path: "/api/v1/agent-actions" },
  { id: "FS92-UNAUTH-18", method: "get", path: "/api/v1/payments" },
  {
    id: "FS92-UNAUTH-19",
    method: "get",
    path: `/api/v1/activity-events?customerId=${randomUUID()}&page=1&limit=25`
  },
  {
    id: "FS92-UNAUTH-20",
    method: "get",
    path: `/api/v1/message-logs?customerId=${randomUUID()}&page=1&limit=25`
  },
  { id: "FS92-UNAUTH-21", method: "get", path: "/api/v1/message-logs/conversations?page=1&limit=25" },
  { id: "FS92-UNAUTH-22", method: "get", path: "/api/v1/booking-requests?page=1&limit=25" },
  { id: "FS92-UNAUTH-23", method: "get", path: "/api/v1/booking-settings" },
  { id: "FS92-UNAUTH-24", method: "get", path: "/api/v1/review-requests?page=1&limit=25" },
  { id: "FS92-UNAUTH-25", method: "get", path: "/api/v1/stripe/connect/status" },
  { id: "FS92-UNAUTH-26", method: "get", path: "/api/v1/dispatch/workload?date=2026-10-15" },
  { id: "FS92-UNAUTH-27", method: "get", path: "/api/v1/jobs/unscheduled" },
  { id: "FS92-UNAUTH-28", method: "get", path: "/api/v1/estimates/approved-unconverted" },
  { id: "FS92-UNAUTH-29", method: "get", path: "/api/v1/service-agreements/templates" },
  { id: "FS92-UNAUTH-30", method: "get", path: "/api/v1/ai/revenue-summary" }
];

const COLLECTION_LIST_LEAK_CASES: Array<{ id: string; path: string }> = [
  { id: "FS92-XT-LIST-01", path: "/api/v1/customers?page=1&limit=50" },
  { id: "FS92-XT-LIST-02", path: "/api/v1/jobs?page=1&limit=50" },
  { id: "FS92-XT-LIST-03", path: "/api/v1/estimates?page=1&limit=50" },
  { id: "FS92-XT-LIST-04", path: "/api/v1/invoices?page=1&limit=50" },
  { id: "FS92-XT-LIST-05", path: "/api/v1/technicians?page=1&limit=50" },
  { id: "FS92-XT-LIST-06", path: "/api/v1/products?page=1&limit=50" },
  { id: "FS92-XT-LIST-07", path: "/api/v1/campaigns?page=1&limit=50" },
  { id: "FS92-XT-LIST-08", path: "/api/v1/imports?page=1&limit=50" },
  { id: "FS92-XT-LIST-09", path: "/api/v1/payments?page=1&limit=50" },
  { id: "FS92-XT-LIST-10", path: "/api/v1/agent-actions" },
  { id: "FS92-XT-LIST-11", path: "/api/v1/ai/recommendations?page=1&limit=50" },
  { id: "FS92-XT-LIST-12", path: "/api/v1/service-agreements?page=1&limit=50" },
  { id: "FS92-XT-LIST-13", path: "/api/v1/automation-rules" },
  { id: "FS92-XT-LIST-14", path: "/api/v1/booking-requests?page=1&limit=50" }
];

type IsolationResourceKey =
  | "customer"
  | "job"
  | "estimate"
  | "invoice"
  | "technician"
  | "product"
  | "aiRecommendation"
  | "campaign"
  | "maintenancePlan"
  | "importSession"
  | "bookingRequest";

const CROSS_TENANT_READ_CASES: Array<{
  id: string;
  resourceKey: IsolationResourceKey;
  buildPath: (resourceId: string) => string;
  expectedStatus: number;
  expectedError?: string;
}> = [
  {
    id: "FS92-XT-READ-01",
    resourceKey: "customer",
    buildPath: (id) => `/api/v1/customers/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-02",
    resourceKey: "job",
    buildPath: (id) => `/api/v1/jobs/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-03",
    resourceKey: "estimate",
    buildPath: (id) => `/api/v1/estimates/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-04",
    resourceKey: "invoice",
    buildPath: (id) => `/api/v1/invoices/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-05",
    resourceKey: "technician",
    buildPath: (id) => `/api/v1/technicians/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-06",
    resourceKey: "product",
    buildPath: (id) => `/api/v1/products/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-07",
    resourceKey: "aiRecommendation",
    buildPath: (id) => `/api/v1/ai/recommendations/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-08",
    resourceKey: "campaign",
    buildPath: (id) => `/api/v1/campaigns/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-09",
    resourceKey: "maintenancePlan",
    buildPath: (id) => `/api/v1/service-agreements/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-10",
    resourceKey: "importSession",
    buildPath: (id) => `/api/v1/imports/${id}/errors`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  },
  {
    id: "FS92-XT-READ-11",
    resourceKey: "job",
    buildPath: (id) => `/api/v1/attachments?entityType=job&entityId=${id}`,
    expectedStatus: 200
  },
  {
    id: "FS92-XT-READ-12",
    resourceKey: "bookingRequest",
    buildPath: (id) => `/api/v1/tenant-context/inquiries/${id}`,
    expectedStatus: 404,
    expectedError: "NOT_FOUND"
  }
];

function assertNoCrossTenantLeak(body: unknown, secretMarker: string) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(secretMarker);
  expect(serialized).not.toContain("fs-92-secret");
}

function assertBodyExcludesOrgAIds(body: unknown, bundleA: ReturnType<typeof seedTenantIsolationBundle>) {
  const serialized = JSON.stringify(body);
  for (const id of orgASecretIds(bundleA)) {
    expect(serialized).not.toContain(id);
  }
}

function assertListRowsScopedToCompany(
  body: { data?: Array<{ companyId?: string }>; items?: Array<{ companyId?: string }> },
  companyId: string
) {
  const rows = body.data ?? body.items ?? [];
  for (const row of rows) {
    if (row.companyId !== undefined) {
      expect(row.companyId).toBe(companyId);
    }
  }
}

describe("FS-92 tenant isolation (API boundary)", () => {
  describe.each(UNAUTHENTICATED_READ_CASES)("$id unauthenticated read denied", ({ method, path }) => {
    it("returns 401 UNAUTHORIZED without credentials", async () => {
      const response = await request(app.server)[method](path);
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("UNAUTHORIZED");
    });
  });

  it("FS92-UNAUTH-WRITE-01 POST /jobs without auth returns 401", async () => {
    const { tenantA } = seedSyntheticTenantPair(fakeDb, tokens, "write");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .post("/api/v1/jobs")
      .send({
        customerId: bundleA.customer.id,
        title: "Unauthenticated create"
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  describe.each(CROSS_TENANT_READ_CASES)(
    "$id cross-tenant read denied",
    ({ buildPath, resourceKey, expectedStatus, expectedError }) => {
      it("does not expose tenant A records to tenant B", async () => {
        const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "read");
        const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
        seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);

        const resourceId = pickResourceId(bundleA, resourceKey);
        const path = buildPath(resourceId);

        const response = await request(app.server).get(path).set("Authorization", tenantB.authorization);

        expect(response.status).toBe(expectedStatus);
        if (expectedError) {
          expect(response.body.error).toBe(expectedError);
        }
        if (resourceKey === "job" && path.includes("/attachments")) {
          expect(response.body.attachments ?? []).toHaveLength(0);
        }
        assertNoCrossTenantLeak(response.body, bundleA.fileAttachment.fileName);
        assertNoCrossTenantLeak(response.body, bundleA.aiRecommendation.headline);
      });
    }
  );

  it("FS92-XT-READ-13 cross-tenant automation rule patch denied", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "auto");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .patch(`/api/v1/automation-rules/${bundleA.automationRule.id}`)
      .set("Authorization", tenantB.authorization)
      .send({ isEnabled: true });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-XT-WRITE-01 PATCH customer in tenant A denied for tenant B", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "patch-cust");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .patch(`/api/v1/customers/${bundleA.customer.id}`)
      .set("Authorization", tenantB.authorization)
      .send({ displayName: "Stolen" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    assertNoCrossTenantLeak(response.body, "Stolen");
  });

  it("FS92-XT-WRITE-02 PATCH job in tenant A denied for tenant B", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "patch-job");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .patch(`/api/v1/jobs/${bundleA.job.id}`)
      .set("Authorization", tenantB.authorization)
      .send({ title: "Hijacked job" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-XT-WRITE-03 POST job referencing tenant A customer denied for tenant B", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "post-job");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .post("/api/v1/jobs")
      .set("Authorization", tenantB.authorization)
      .send({
        customerId: bundleA.customer.id,
        title: "Cross-tenant customer reference"
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-XT-WRITE-04 import rollback on tenant A session denied for tenant B", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "import");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .post(`/api/v1/imports/${bundleA.importSession.id}/rollback`)
      .set("Authorization", tenantB.authorization)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-XT-WRITE-05 DELETE attachment in tenant A denied for tenant B", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "attach");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .delete(`/api/v1/attachments/${bundleA.fileAttachment.id}`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-XT-WRITE-06 revenue inquiry draft on tenant A booking denied for tenant B", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "inquiry");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .post(`/api/v1/revenue/inquiries/${bundleA.bookingRequest.id}/response-draft`)
      .set("Authorization", tenantB.authorization)
      .send({ idempotencyKey: "fs92-cross-tenant-key" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-SAME-01 tenant B reads own customer while tenant A data exists", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "same");
    seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
    const bundleB = seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);

    const response = await request(app.server)
      .get(`/api/v1/customers/${bundleB.customer.id}`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(200);
    expect(response.body.customer.id).toBe(bundleB.customer.id);
    assertNoCrossTenantLeak(response.body, "FS-92 Synthetic Org A");
  });

  it("FS92-SPOOF-01 client-supplied companyId in body does not grant cross-tenant access", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "spoof");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .get(`/api/v1/customers/${bundleA.customer.id}`)
      .set("Authorization", tenantB.authorization)
      .send({ companyId: tenantA.company.id });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("FS92-INVALID-01 malformed bearer token is rejected", async () => {
    const response = await request(app.server)
      .get("/api/v1/customers")
      .set("Authorization", "Bearer not-a-valid-jwt");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  it("FS92-UNAUTH-31 POST /tenant-context/resolve without auth returns 401", async () => {
    const response = await request(app.server)
      .post("/api/v1/tenant-context/resolve")
      .send({
        entityType: "customer",
        entityId: randomUUID()
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  it("FS92-UNAUTH-32 PATCH /time/:entryId without auth returns 401", async () => {
    const response = await request(app.server)
      .patch(`/api/v1/time/${randomUUID()}`)
      .send({ endedAt: "2026-10-15T12:00:00.000Z" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  describe.each(COLLECTION_LIST_LEAK_CASES)("$id Org B list excludes Org A ids", ({ path }) => {
    it("does not return another tenant's record identifiers", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "list");
      const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
      seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);

      const response = await request(app.server).get(path).set("Authorization", tenantB.authorization);

      expect(response.status).toBe(200);
      assertBodyExcludesOrgAIds(response.body, bundleA);
      assertListRowsScopedToCompany(response.body, tenantB.company.id);
    });
  });

  it("FS92-XT-READ-14 cross-tenant GET invoice payments denied", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "pay-read");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .get(`/api/v1/invoices/${bundleA.invoice.id}/payments`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    assertBodyExcludesOrgAIds(response.body, bundleA);
  });

  it("FS92-XT-READ-15 cross-tenant payment id absent from Org B payment list", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "pay-list");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
    seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);

    const response = await request(app.server)
      .get("/api/v1/payments?page=1&limit=50")
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(bundleA.payment.id);
    expect(serialized).not.toContain(bundleA.invoice.id);
  });

  describe("FS92-XT agent-actions cross-tenant", () => {
    it("FS92-XT-AGENT-01 GET /agent-actions/:id returns NOT_FOUND", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "agent-get");
      const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

      const response = await request(app.server)
        .get(`/api/v1/agent-actions/${bundleA.agentAction.id}`)
        .set("Authorization", tenantB.authorization);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
      assertNoCrossTenantLeak(response.body, bundleA.agentAction.reason ?? "");
    });

    it("FS92-XT-AGENT-02 POST approve denied for Org A action", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "agent-approve");
      const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

      const response = await request(app.server)
        .post(`/api/v1/agent-actions/${bundleA.agentAction.id}/approve`)
        .set("Authorization", tenantB.authorization)
        .send({ expectedVersion: 0 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
    });

    it("FS92-XT-AGENT-03 POST reject denied for Org A action", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "agent-reject");
      const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

      const response = await request(app.server)
        .post(`/api/v1/agent-actions/${bundleA.agentAction.id}/reject`)
        .set("Authorization", tenantB.authorization)
        .send();

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
    });

    it("FS92-XT-AGENT-04 POST execute denied for Org A action", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "agent-exec");
      const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

      const response = await request(app.server)
        .post(`/api/v1/agent-actions/${bundleA.agentAction.id}/execute`)
        .set("Authorization", tenantB.authorization)
        .send({ expectedVersion: 0 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
    });
  });
});

function pickResourceId(
  bundle: ReturnType<typeof seedTenantIsolationBundle>,
  key: IsolationResourceKey
): string {
  switch (key) {
    case "customer":
      return bundle.customer.id;
    case "job":
      return bundle.job.id;
    case "estimate":
      return bundle.estimate.id;
    case "invoice":
      return bundle.invoice.id;
    case "technician":
      return bundle.technician.id;
    case "product":
      return bundle.product.id;
    case "aiRecommendation":
      return bundle.aiRecommendation.id;
    case "campaign":
      return bundle.campaign.id;
    case "maintenancePlan":
      return bundle.maintenancePlan.id;
    case "importSession":
      return bundle.importSession.id;
    case "bookingRequest":
      return bundle.bookingRequest.id;
    default:
      return randomUUID();
  }
}
