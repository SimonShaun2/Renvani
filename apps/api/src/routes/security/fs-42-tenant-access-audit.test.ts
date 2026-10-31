/**
 * FS-42 — Auth, membership, and server-derived tenant access (VIP + import + migrate wizard).
 * Synthetic tenants only; complements FS-92 and STACK-03 matrices.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";
import {
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

const FS42_VIP_UNAUTH_PATHS = [
  "/api/v1/vip/tiers",
  "/api/v1/vip/memberships",
  "/api/v1/vip/policy"
] as const;

const FS42_IMPORT_UNAUTH_PATHS = ["/api/v1/imports", "/api/v1/migrate/onboarding/sessions/active"] as const;

const FS42_VIP_ROLE_DENIED_PATHS = [
  "/api/v1/vip/tiers",
  "/api/v1/vip/memberships",
  "/api/v1/vip/policy"
] as const;

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

function technicianAuth(companyId: string, userId: string, role: "technician" | "dispatcher" | "owner" = "technician") {
  const accessToken = tokens.generateAccessToken({ userId, companyId, role });
  return `Bearer ${accessToken}`;
}

describe("FS-42 tenant access audit", () => {
  describe.each(FS42_VIP_UNAUTH_PATHS)("FS42-UNAUTH-VIP $path", (path) => {
    it("returns 401 without credentials", async () => {
      const response = await request(app.server).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("UNAUTHORIZED");
    });
  });

  describe.each(FS42_IMPORT_UNAUTH_PATHS)("FS42-UNAUTH-IMPORT $path", (path) => {
    it("returns 401 without credentials", async () => {
      const response = await request(app.server).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("UNAUTHORIZED");
    });
  });

  describe.each(FS42_VIP_ROLE_DENIED_PATHS)("FS42-ROLE-VIP $path", (path) => {
    it("returns 403 FORBIDDEN for technician role", async () => {
      const company = fakeDb.seedCompany({ name: "VIP Role Co", slug: "vip-role-co" });
      const technician = fakeDb.seedUser({
        companyId: company.id,
        email: "tech@vip-role.test",
        firstName: "Tech",
        lastName: "User",
        role: "technician"
      });

      const response = await request(app.server)
        .get(path)
        .set("Authorization", technicianAuth(company.id, technician.id));

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("FORBIDDEN");
    });
  });

  it("FS42-ROLE-IMPORT-01 technician cannot list imports", async () => {
    const company = fakeDb.seedCompany({ name: "Import Role Co", slug: "import-role-co" });
    const technician = fakeDb.seedUser({
      companyId: company.id,
      email: "tech@import-role.test",
      firstName: "Tech",
      lastName: "User",
      role: "technician"
    });

    const response = await request(app.server)
      .get("/api/v1/imports")
      .set("Authorization", technicianAuth(company.id, technician.id));

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("FORBIDDEN");
  });

  it("FS42-XT-IMPORT-01 cross-tenant import session read denied", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "fs42-import");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);

    const response = await request(app.server)
      .get(`/api/v1/imports/${bundleA.importSession.id}`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain(bundleA.importSession.fileName);
  });

  it("FS42-XT-VIP-01 VIP tier list excludes another tenant's tiers", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "fs42-vip");
    const tierA = fakeDb.seedVipMembershipTier({
      companyId: tenantA.company.id,
      name: "FS42-SECRET-VIP-TIER-A"
    });
    fakeDb.seedVipMembershipTier({
      companyId: tenantB.company.id,
      name: "FS42-VIP-TIER-B"
    });

    const response = await request(app.server)
      .get("/api/v1/vip/tiers")
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(tierA.id);
    expect(serialized).not.toContain("FS42-SECRET-VIP-TIER-A");
    expect(serialized).toContain("FS42-VIP-TIER-B");
  });

  it("FS42-XT-MIGRATE-01 cross-tenant migrate wizard session denied", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "fs42-migrate");
    const bundleA = fakeDb.seedImportBundle({
      companyId: tenantA.company.id,
      createdById: tenantA.owner.id,
      wizardStep: 2,
      stepState: { files: [], sourceSystem: "servicetitan" }
    });

    const response = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleA.id}`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain("servicetitan");
  });

  it("FS42-UNAUTH-JOBS-PREVIEW POST /jobs/preview returns 401 without credentials", async () => {
    const response = await request(app.server).post("/api/v1/jobs/preview").send({});
    expect(response.status).toBe(401);
  });

  it("FS42-ROLE-JOBS-PREVIEW technician cannot preview job create", async () => {
    const company = fakeDb.seedCompany({ name: "Preview Role Co", slug: "preview-role-co" });
    const technician = fakeDb.seedUser({
      companyId: company.id,
      email: "tech@preview-role.test",
      firstName: "Tech",
      lastName: "User",
      role: "technician"
    });
    const response = await request(app.server)
      .post("/api/v1/jobs/preview")
      .set("Authorization", technicianAuth(company.id, technician.id))
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("FORBIDDEN");
  });

  it("FS42-XT-JOBS-PREVIEW cross-tenant productCatalogId is rejected", async () => {
    const companyA = fakeDb.seedCompany({ name: "Preview A", slug: "preview-a" });
    const companyB = fakeDb.seedCompany({ name: "Preview B", slug: "preview-b" });
    const dispatcher = fakeDb.seedUser({
      companyId: companyA.id,
      email: "disp@preview-a.test",
      firstName: "Disp",
      lastName: "User",
      role: "dispatcher"
    });
    const foreign = fakeDb.seedProductCatalog({ companyId: companyB.id, name: "Foreign", unitPrice: "99.00" } as never);
    const response = await request(app.server)
      .post("/api/v1/jobs/preview")
      .set("Authorization", technicianAuth(companyA.id, dispatcher.id, "dispatcher"))
      .send({ products: [{ productCatalogId: foreign.id }] });
    expect(response.status).toBe(404);
  });

  it("FS42-UNAUTH-REVENUE-OUTCOMES GET /reporting/revenue-outcomes returns 401 without credentials", async () => {
    const response = await request(app.server)
      .get("/api/v1/reporting/revenue-outcomes")
      .query({ startDate: "2026-10-01", endDate: "2026-10-31" });
    expect(response.status).toBe(401);
  });

  it("FS42-ROLE-REVENUE-OUTCOMES technician and dispatcher cannot read revenue outcomes", async () => {
    const company = fakeDb.seedCompany({ name: "Outcomes Role Co", slug: "outcomes-role-co" });
    for (const role of ["technician", "dispatcher"] as const) {
      const user = fakeDb.seedUser({
        companyId: company.id,
        email: `${role}@outcomes-role.test`,
        firstName: "Field",
        lastName: "User",
        role
      });
      const response = await request(app.server)
        .get("/api/v1/reporting/revenue-outcomes")
        .query({ startDate: "2026-10-01", endDate: "2026-10-31" })
        .set("Authorization", technicianAuth(company.id, user.id, role));
      expect(response.status).toBe(403);
      expect(response.body.error).toBe("FORBIDDEN");
    }
  });

  it("FS42-XT-REVENUE-OUTCOMES owner sees only own tenant aggregates", async () => {
    const companyA = fakeDb.seedCompany({ name: "Outcomes A", slug: "outcomes-a" });
    const companyB = fakeDb.seedCompany({ name: "Outcomes B", slug: "outcomes-b" });
    const owner = fakeDb.seedUser({
      companyId: companyA.id,
      email: "owner@outcomes-a.test",
      firstName: "Owner",
      lastName: "A",
      role: "owner"
    });
    const foreignCustomer = fakeDb.seedCustomer({ companyId: companyB.id, firstName: "B", lastName: "Customer" });
    fakeDb.seedJob({
      companyId: companyB.id,
      customerId: foreignCustomer.id,
      status: "paid",
      scheduledStart: new Date("2026-10-10T15:00:00.000Z"),
      amountPaid: "750.00"
    } as never);
    const response = await request(app.server)
      .get("/api/v1/reporting/revenue-outcomes")
      .query({ startDate: "2026-10-01", endDate: "2026-10-31" })
      .set("Authorization", technicianAuth(companyA.id, owner.id, "owner"));
    expect(response.status).toBe(200);
    expect(response.body.revenue.completedRevenue).toBe("0.00");
    expect(response.body.funnel.every((stage: { count: number }) => stage.count === 0)).toBe(true);
  });

  it("FS42-UNAUTH-INVOICE-CHARGE-PREVIEW GET /invoices/:id/charge-preview returns 401 without credentials", async () => {
    const response = await request(app.server).get("/api/v1/invoices/00000000-0000-4000-8000-000000000001/charge-preview");
    expect(response.status).toBe(401);
  });

  it("FS42-ROLE-INVOICE-CHARGE-PREVIEW technician cannot read an invoice charge preview", async () => {
    const company = fakeDb.seedCompany({ name: "Charge Role Co", slug: "charge-role-co" });
    const technician = fakeDb.seedUser({
      companyId: company.id,
      email: "tech@charge-role.test",
      firstName: "Tech",
      lastName: "User",
      role: "technician"
    });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "C", lastName: "R" });
    const invoice = fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id });
    const response = await request(app.server)
      .get(`/api/v1/invoices/${invoice.id}/charge-preview`)
      .set("Authorization", technicianAuth(company.id, technician.id));
    expect(response.status).toBe(403);
  });

  it("FS42-XT-INVOICE-CHARGE-PREVIEW cross-tenant invoice id is 404", async () => {
    const companyA = fakeDb.seedCompany({ name: "Charge A", slug: "charge-a" });
    const companyB = fakeDb.seedCompany({ name: "Charge B", slug: "charge-b" });
    const office = fakeDb.seedUser({
      companyId: companyA.id,
      email: "office@charge-a.test",
      firstName: "Off",
      lastName: "User",
      role: "dispatcher"
    });
    const customerB = fakeDb.seedCustomer({ companyId: companyB.id, firstName: "B", lastName: "C" });
    const invoiceB = fakeDb.seedInvoice({ companyId: companyB.id, customerId: customerB.id });
    const response = await request(app.server)
      .get(`/api/v1/invoices/${invoiceB.id}/charge-preview`)
      .set("Authorization", technicianAuth(companyA.id, office.id, "dispatcher"));
    expect(response.status).toBe(404);
  });

  it("FS42-SPOOF-01 import list rejects client-supplied companyId query param", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "fs42-spoof");
    seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
    seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);

    const response = await request(app.server)
      .get(`/api/v1/imports?page=1&limit=50&companyId=${tenantA.company.id}`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
  });

  it("FS42-UNAUTH-CALL-TRACKING GET /growth/call-tracking/calls returns 401 without credentials", async () => {
    const response = await request(app.server).get("/api/v1/growth/call-tracking/calls");
    expect(response.status).toBe(401);
  });

  it("FS42-ROLE-CALL-TRACKING dispatcher cannot change call tracking settings", async () => {
    const company = fakeDb.seedCompany({ name: "Calls Role Co", slug: "calls-role-co" });
    const dispatcher = fakeDb.seedUser({
      companyId: company.id,
      email: "disp@calls-role.test",
      firstName: "Disp",
      lastName: "User",
      role: "dispatcher"
    });
    const response = await request(app.server)
      .put("/api/v1/growth/call-tracking/settings")
      .set("Authorization", technicianAuth(company.id, dispatcher.id, "dispatcher"))
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("FORBIDDEN");
  });

  it("FS42-XT-CALL-TRACKING cross-tenant tracking number id is 404 and unchanged", async () => {
    const companyA = fakeDb.seedCompany({ name: "Calls A", slug: "calls-a" });
    const companyB = fakeDb.seedCompany({ name: "Calls B", slug: "calls-b" });
    const ownerA = fakeDb.seedUser({ companyId: companyA.id, email: "owner@calls-a.test", firstName: "O", lastName: "A", role: "owner" });
    const numberB = fakeDb.seedCallTrackingNumber({ companyId: companyB.id, trackingNumber: "+15125550177", label: "B line" });
    const auth = `Bearer ${tokens.generateAccessToken({ userId: ownerA.id, companyId: companyA.id, role: "owner" })}`;
    const response = await request(app.server)
      .patch(`/api/v1/growth/call-tracking/numbers/${numberB.id}`)
      .set("Authorization", auth)
      .send({ expectedVersion: 1, label: "Taken" });
    expect(response.status).toBe(404);
    expect(fakeDb.getTestState().callTrackingNumbers.find((n) => n.id === numberB.id)?.label).toBe("B line");
  });

  it("FS42-XT-CALL-TRACKING-VERIFY number list shows only own numbers, each unverified on the disabled adapter", async () => {
    const companyA = fakeDb.seedCompany({ name: "Verify A", slug: "verify-a" });
    const companyB = fakeDb.seedCompany({ name: "Verify B", slug: "verify-b" });
    const ownerA = fakeDb.seedUser({ companyId: companyA.id, email: "owner@verify-a.test", firstName: "O", lastName: "A", role: "owner" });
    const numberA = fakeDb.seedCallTrackingNumber({ companyId: companyA.id, trackingNumber: "+15125550188", label: "A line" });
    fakeDb.seedCallTrackingNumber({ companyId: companyB.id, trackingNumber: "+15125550199", label: "B line" });
    const auth = `Bearer ${tokens.generateAccessToken({ userId: ownerA.id, companyId: companyA.id, role: "owner" })}`;
    const response = await request(app.server).get("/api/v1/growth/call-tracking/numbers").set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body.numbers).toHaveLength(1);
    expect(response.body.numbers[0]).toMatchObject({ id: numberA.id, verificationStatus: "unverified", canReceiveCalls: false });
  });

  it("FS42-UNAUTH-GROWTH-FINDING-REVIEW POST /growth-check/findings/:id/reviews returns 401 without credentials", async () => {
    const response = await request(app.server)
      .post("/api/v1/growth-check/findings/00000000-0000-4000-8000-000000000001/reviews")
      .send({});
    expect(response.status).toBe(401);
  });

  it("FS42-ROLE-GROWTH-FINDING-REVIEW dispatcher cannot review growth check findings", async () => {
    const company = fakeDb.seedCompany({ name: "Review Role Co", slug: "review-role-co" });
    const dispatcher = fakeDb.seedUser({
      companyId: company.id,
      email: "disp@review-role.test",
      firstName: "Disp",
      lastName: "User",
      role: "dispatcher"
    });
    const response = await request(app.server)
      .post("/api/v1/growth-check/findings/00000000-0000-4000-8000-000000000001/reviews")
      .set("Authorization", technicianAuth(company.id, dispatcher.id, "dispatcher"))
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("FORBIDDEN");
  });

  it("FS42-XT-GROWTH-FINDING-REVIEW cross-tenant finding id is 404 and writes no history", async () => {
    const companyA = fakeDb.seedCompany({ name: "Review A", slug: "review-a" });
    const companyB = fakeDb.seedCompany({ name: "Review B", slug: "review-b" });
    const ownerA = fakeDb.seedUser({ companyId: companyA.id, email: "owner@review-a.test", firstName: "O", lastName: "A", role: "owner" });
    const scanB = fakeDb.seedGrowthCheckScan({ companyId: companyB.id });
    const findingB = fakeDb.seedGrowthCheckFinding({ companyId: companyB.id, scanId: scanB.id });
    const auth = `Bearer ${tokens.generateAccessToken({ userId: ownerA.id, companyId: companyA.id, role: "owner" })}`;
    const read = await request(app.server).get(`/api/v1/growth-check/findings/${findingB.id}`).set("Authorization", auth);
    expect(read.status).toBe(404);
    const response = await request(app.server)
      .post(`/api/v1/growth-check/findings/${findingB.id}/reviews`)
      .set("Authorization", auth)
      .send({ action: "dismiss", reason: "Not relevant", expectedRevision: 0, idempotencyKey: "fs42-xt-key-01" });
    expect(response.status).toBe(404);
    expect(fakeDb.getGrowthCheckFindingRevisions()).toHaveLength(0);
  });

  it("FS42-UNAUTH-GROWTH-REPORT-DRAFT POST /growth-check/scans/:id/report-draft returns 401 without credentials", async () => {
    const response = await request(app.server)
      .post("/api/v1/growth-check/scans/00000000-0000-4000-8000-000000000001/report-draft")
      .send({});
    expect(response.status).toBe(401);
  });

  it("FS42-ROLE-GROWTH-REPORT-DRAFT dispatcher cannot create, edit or share growth check reports", async () => {
    const company = fakeDb.seedCompany({ name: "Report Role Co", slug: "report-role-co" });
    const dispatcher = fakeDb.seedUser({
      companyId: company.id,
      email: "disp@report-role.test",
      firstName: "Disp",
      lastName: "User",
      role: "dispatcher"
    });
    const auth = technicianAuth(company.id, dispatcher.id, "dispatcher");
    const id = "00000000-0000-4000-8000-000000000001";
    for (const [method, path] of [
      ["post", `/api/v1/growth-check/scans/${id}/report-draft`],
      ["patch", `/api/v1/growth-check/report-drafts/${id}`],
      ["post", `/api/v1/growth-check/report-drafts/${id}/shares`]
    ] as const) {
      const response = await request(app.server)[method](path).set("Authorization", auth).send({});
      expect(response.status).toBe(403);
      expect(response.body.error).toBe("FORBIDDEN");
    }
  });

  it("FS42-XT-GROWTH-REPORT-DRAFT cross-tenant scan, draft and share ids are 404 and write nothing", async () => {
    const companyA = fakeDb.seedCompany({ name: "Report A", slug: "report-a" });
    const companyB = fakeDb.seedCompany({ name: "Report B", slug: "report-b" });
    const ownerA = fakeDb.seedUser({ companyId: companyA.id, email: "owner@report-a.test", firstName: "O", lastName: "A", role: "owner" });
    const ownerB = fakeDb.seedUser({ companyId: companyB.id, email: "owner@report-b.test", firstName: "O", lastName: "B", role: "owner" });
    const scanB = fakeDb.seedGrowthCheckScan({ companyId: companyB.id });
    const authA = `Bearer ${tokens.generateAccessToken({ userId: ownerA.id, companyId: companyA.id, role: "owner" })}`;
    const authB = `Bearer ${tokens.generateAccessToken({ userId: ownerB.id, companyId: companyB.id, role: "owner" })}`;
    const created = await request(app.server)
      .post(`/api/v1/growth-check/scans/${scanB.id}/report-draft`)
      .set("Authorization", authB)
      .send({ idempotencyKey: "fs42-report-b-01" });
    expect(created.status).toBe(201);
    const draftId = created.body.draft.id as string;
    await request(app.server).post(`/api/v1/growth-check/report-drafts/${draftId}/approve`).set("Authorization", authB).send({ expectedVersion: 1, idempotencyKey: "fs42-report-b-02" });
    const share = await request(app.server).post(`/api/v1/growth-check/report-drafts/${draftId}/shares`).set("Authorization", authB).send({ expectedVersion: 2, idempotencyKey: "fs42-report-b-03" });
    expect(share.status).toBe(201);
    const revisionsBefore = fakeDb.getGrowthCheckReportDraftRevisions().length;

    expect((await request(app.server).post(`/api/v1/growth-check/scans/${scanB.id}/report-draft`).set("Authorization", authA).send({ idempotencyKey: "fs42-report-a-01" })).status).toBe(404);
    expect((await request(app.server).get(`/api/v1/growth-check/report-drafts/${draftId}`).set("Authorization", authA)).status).toBe(404);
    expect((await request(app.server).get(`/api/v1/growth-check/report-drafts/${draftId}/preview`).set("Authorization", authA)).status).toBe(404);
    expect((await request(app.server).get(`/api/v1/growth-check/report-drafts/${draftId}/export`).set("Authorization", authA)).status).toBe(404);
    expect((await request(app.server).patch(`/api/v1/growth-check/report-drafts/${draftId}`).set("Authorization", authA).send({ expectedVersion: 2, idempotencyKey: "fs42-report-a-02", title: "Taken" })).status).toBe(404);
    expect((await request(app.server).post(`/api/v1/growth-check/report-shares/${share.body.share.id}/revoke`).set("Authorization", authA).send({})).status).toBe(404);
    expect(fakeDb.getGrowthCheckReportDraftRevisions()).toHaveLength(revisionsBefore);
    expect(fakeDb.getGrowthCheckReportShares()[0]?.revokedAt).toBeNull();
  });
});
