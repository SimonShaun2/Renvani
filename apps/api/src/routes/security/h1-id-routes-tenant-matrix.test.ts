/**
 * H1 PR 2 — two-tenant matrix for the riskiest :id routes (invoices, estimates, jobs, payments).
 * Tenant B's token against tenant A's ids must get 404 NOT_FOUND (never 403: no existence oracle),
 * leak nothing, and leave every tenant A row untouched.
 */
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
type Bundle = ReturnType<typeof seedTenantIsolationBundle>;

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

type Method = "get" | "post" | "patch" | "delete";
interface Case {
  id: string;
  method: Method;
  path: (a: Bundle, itemIds: { invoiceItemId: string; estimateItemId: string }) => string;
  body?: Record<string, unknown>;
}

const CASES: Case[] = [
  // invoices
  { id: "H1-INV-01", method: "get", path: (a) => `/api/v1/invoices/${a.invoice.id}` },
  { id: "H1-INV-02", method: "patch", path: (a) => `/api/v1/invoices/${a.invoice.id}`, body: { title: "pwned" } },
  { id: "H1-INV-03", method: "post", path: (a) => `/api/v1/invoices/${a.invoice.id}/send`, body: {} },
  { id: "H1-INV-04", method: "post", path: (a) => `/api/v1/invoices/${a.invoice.id}/void`, body: { reason: "pwned" } },
  { id: "H1-INV-05", method: "post", path: (a) => `/api/v1/invoices/${a.invoice.id}/items`, body: { name: "x", quantity: 1, unitPrice: 1 } },
  { id: "H1-INV-06", method: "patch", path: (a, i) => `/api/v1/invoices/${a.invoice.id}/items/${i.invoiceItemId}`, body: { name: "pwned" } },
  { id: "H1-INV-07", method: "delete", path: (a, i) => `/api/v1/invoices/${a.invoice.id}/items/${i.invoiceItemId}` },
  // payments (by invoice id)
  { id: "H1-PAY-01", method: "get", path: (a) => `/api/v1/invoices/${a.invoice.id}/payments` },
  { id: "H1-PAY-02", method: "post", path: (a) => `/api/v1/invoices/${a.invoice.id}/record-payment`, body: { amount: 1, method: "cash" } },
  // estimates
  { id: "H1-EST-01", method: "get", path: (a) => `/api/v1/estimates/${a.estimate.id}` },
  { id: "H1-EST-02", method: "patch", path: (a) => `/api/v1/estimates/${a.estimate.id}`, body: { title: "pwned" } },
  { id: "H1-EST-03", method: "delete", path: (a) => `/api/v1/estimates/${a.estimate.id}` },
  { id: "H1-EST-04", method: "get", path: (a) => `/api/v1/estimates/${a.estimate.id}/items` },
  { id: "H1-EST-05", method: "patch", path: (a, i) => `/api/v1/estimates/${a.estimate.id}/items/${i.estimateItemId}`, body: { name: "pwned" } },
  { id: "H1-EST-06", method: "delete", path: (a, i) => `/api/v1/estimates/${a.estimate.id}/items/${i.estimateItemId}` },
  // jobs
  { id: "H1-JOB-01", method: "get", path: (a) => `/api/v1/jobs/${a.job.id}` },
  { id: "H1-JOB-02", method: "patch", path: (a) => `/api/v1/jobs/${a.job.id}`, body: { title: "pwned" } },
  { id: "H1-JOB-03", method: "post", path: (a) => `/api/v1/jobs/${a.job.id}/notes`, body: { content: "pwned" } },
  { id: "H1-JOB-04", method: "get", path: (a) => `/api/v1/jobs/${a.job.id}/notes` }
];

function snapshotTenantA(companyId: string) {
  const state = fakeDb.getTestState();
  const pick = <T extends { companyId: string }>(rows: T[]) => JSON.stringify(rows.filter((r) => r.companyId === companyId));
  return {
    invoices: pick(state.invoices),
    invoiceItems: pick(state.invoiceItems),
    estimates: pick(state.estimates),
    estimateItems: pick(state.estimateItems),
    jobs: pick(state.jobs),
    jobNotes: pick(state.jobNotes),
    payments: pick(state.payments)
  };
}

describe("H1 two-tenant :id route matrix (invoices, estimates, jobs, payments)", () => {
  it.each(CASES)("$id $method -> 404 NOT_FOUND, no leak, tenant A unchanged", async ({ method, path, body }) => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "h1");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
    seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);
    const invoiceItem = fakeDb.seedInvoiceItem({
      companyId: tenantA.company.id,
      invoiceId: bundleA.invoice.id,
      name: "A item",
      quantity: "1.000",
      unitPrice: "10.00",
      total: "10.00"
    } as Parameters<typeof fakeDb.seedInvoiceItem>[0]);
    const estimateItem = fakeDb.seedEstimateItem({
      companyId: tenantA.company.id,
      estimateId: bundleA.estimate.id,
      name: "A item",
      quantity: "1.000",
      unitPrice: "10.00",
      total: "10.00"
    } as Parameters<typeof fakeDb.seedEstimateItem>[0]);

    const before = snapshotTenantA(tenantA.company.id);
    let req = request(app.server)[method](path(bundleA, { invoiceItemId: invoiceItem.id, estimateItemId: estimateItem.id }))
      .set("Authorization", tenantB.authorization);
    if (body) req = req.send(body);
    const response = await req;

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    const serialized = JSON.stringify(response.body);
    for (const id of [...orgASecretIds(bundleA), invoiceItem.id, estimateItem.id]) {
      expect(serialized).not.toContain(id);
    }
    expect(snapshotTenantA(tenantA.company.id)).toEqual(before);
  });

  it("H1-PAY-03 GET /payments for tenant B never lists tenant A payments", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "h1");
    const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
    seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);
    const response = await request(app.server).get("/api/v1/payments").set("Authorization", tenantB.authorization);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(bundleA.payment.id);
  });
});
