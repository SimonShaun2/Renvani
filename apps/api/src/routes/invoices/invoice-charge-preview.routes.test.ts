/** GET /invoices/:id/charge-preview — 401, technician 403, cross-tenant 404, Flex/Flat bodies. */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("../../test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("../../test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) }
}));

let buildAppModule: typeof import("../../app.js");
let fakeDb: typeof import("../../test-support/fake-db.js");
let tokens: typeof import("../../lib/tokens.js");
let app: Awaited<ReturnType<typeof buildAppModule.buildApp>>;

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
  await closeTestApp(app);
});

function tenant(slug: string, planTier: "flex" | "flat") {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug, settings: { stripePlatformBilling: { planTier } } } as never);
  const auth = (role: string) => {
    const u = fakeDb.seedUser({ companyId: company.id, email: `${role}@${slug}.test`, firstName: role, lastName: "U", role } as never);
    return `Bearer ${tokens.generateAccessToken({ userId: u.id, companyId: company.id, role: role as never })}`;
  };
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Cu", lastName: "St" });
  const invoice = fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id, total: "250.00", balanceDue: "250.00" } as never);
  return { company, auth, invoice };
}

const url = (id: string) => `/api/v1/invoices/${id}/charge-preview`;

describe("GET /api/v1/invoices/:id/charge-preview", () => {
  it("401 without credentials", async () => {
    const a = tenant("cp-unauth", "flex");
    expect((await request(app.server).get(url(a.invoice.id))).status).toBe(401);
  });

  it("technician gets 403", async () => {
    const a = tenant("cp-tech", "flex");
    const res = await request(app.server).get(url(a.invoice.id)).set("Authorization", a.auth("technician"));
    expect(res.status).toBe(403);
  });

  it("another tenant's invoice id is 404 with no leaked data", async () => {
    const a = tenant("cp-a", "flex");
    const b = tenant("cp-b", "flex");
    const res = await request(app.server).get(url(b.invoice.id)).set("Authorization", a.auth("admin"));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(b.invoice.id);
  });

  it("Flex: success body carries invoice total, 2% Service Fee and total", async () => {
    const a = tenant("cp-flex", "flex");
    const res = await request(app.server).get(url(a.invoice.id)).set("Authorization", a.auth("office"));
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body).toMatchObject({
      invoiceId: a.invoice.id,
      invoiceTotal: "250.00",
      plan: "flex",
      subtotal: "250.00",
      serviceFeeAmount: "5.00",
      serviceFeeRateBps: 200,
      total: "255.00"
    });
    expect(body.serviceFeeLabel).toEqual(expect.any(String));
  });

  it("Flat: no Service Fee", async () => {
    const a = tenant("cp-flat", "flat");
    const res = await request(app.server).get(url(a.invoice.id)).set("Authorization", a.auth("owner"));
    expect(res.status).toBe(200);
    expect(res.body.data ?? res.body).toMatchObject({ plan: "flat", serviceFeeAmount: "0.00", serviceFeeRateBps: 0, serviceFeeLabel: null, total: "250.00" });
  });
});
