import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@fsm/jobs", () => ({ aiQueue: { add: vi.fn() } }));

type FakeDb = typeof import("../../../test-support/fake-db.js");
type PortalToken = typeof import("../../../lib/customer-portal-token.js");
let fakeDb: FakeDb;
let portalToken: PortalToken;
let app: Awaited<ReturnType<(typeof import("../../../app.js"))["buildApp"]>>;

beforeAll(async () => {
  fakeDb = await import("../../../test-support/fake-db.js");
  portalToken = await import("../../../lib/customer-portal-token.js");
});
beforeEach(async () => {
  fakeDb.resetTestState();
  app = await (await import("../../../app.js")).buildApp();
  await app.ready();
});
afterEach(async () => {
  await app.close();
});

const base = "/api/v1/public/customer-portal/me";
const SECRET_MARKERS = ["INTERNAL-NOTE", "TECH-NOTE", "cost", "margin", "internalNotes", "techNotes", "stripe_sub_secret"];

function seedTenant(slug: string, tag: string, bookingEnabled = true) {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug });
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: `${tag}First`,
    lastName: "Pine",
    email: `${tag}@example.com`,
    notes: "INTERNAL-NOTE"
  } as never);
  const id = { companyId: company.id, customerId: customer.id };
  fakeDb.seedProperty({ ...id, addressLine1: "1 Main", city: "Austin", state: "TX", zip: `${tag}-787`, isPrimary: true } as never);
  fakeDb.seedJob({ ...id, title: `${tag} past clean`, status: "completed", actualEnd: new Date(Date.now() - 5 * 86_400_000), internalNotes: "TECH-NOTE" } as never);
  fakeDb.seedJob({ ...id, title: `${tag} upcoming`, status: "scheduled", scheduledStart: new Date(Date.now() + 86_400_000) } as never);
  fakeDb.seedInvoice({ ...id, status: "sent", total: "50.00", balanceDue: "50.00", paymentToken: `${tag}-pay`, notes: "INTERNAL-NOTE" } as never);
  fakeDb.seedInvoice({ ...id, status: "paid", total: "20.00", balanceDue: "0.00", paymentToken: `${tag}-paid` } as never);
  fakeDb.seedInvoice({ ...id, status: "draft", total: "9.00", balanceDue: "9.00", paymentToken: `${tag}-draft` } as never);
  fakeDb.seedMaintenancePlan({
    ...id,
    name: `${tag} Gold Plan`,
    status: "active",
    frequency: "quarterly",
    price: "29.00",
    startDate: "2026-01-01",
    includedServices: ["Tune-up"],
    notes: "INTERNAL-NOTE",
    stripeSubscriptionId: "stripe_sub_secret"
  } as never);
  fakeDb.seedBookingSettings({ companyId: company.id, isEnabled: bookingEnabled, bookingSlug: `${slug}-book` } as never);
  const { token } = portalToken.generateCustomerPortalToken(id);
  return { company, customer, token };
}

const get = (path: string, token?: string) => {
  const req = request(app.server).get(path);
  return token ? req.set("x-customer-portal-token", token) : req;
};

describe("customer portal sections", () => {
  it("lists the built-in registered sections", async () => {
    const a = seedTenant("tenant-a", "aa");
    const res = await get(`${base}/sections`, a.token);
    expect(res.status).toBe(200);
    expect(res.body.sections).toEqual(expect.arrayContaining(["history", "invoices", "memberships", "rebook"]));
  });

  it("history: past jobs only, own customer", async () => {
    const a = seedTenant("tenant-a", "aa");
    const res = await get(`${base}/history`, a.token);
    expect(res.status).toBe(200);
    expect(res.body.key).toBe("history");
    expect(res.body.data.entries.map((e: { title: string }) => e.title)).toEqual(["aa past clean"]);
  });

  it("open invoices: only payable invoices with a pay-by-token link", async () => {
    const a = seedTenant("tenant-a", "aa");
    const res = await get(`${base}/open-invoices`, a.token);
    expect(res.status).toBe(200);
    expect(res.body.data.open).toHaveLength(1);
    expect(res.body.data.open[0].payUrl).toMatch(/\/pay\/aa-pay$/);
    expect(res.body.data.totalBalanceDue).toBe("50.00");
  });

  it("memberships: lists agreements (no id-bearing manage link)", async () => {
    const a = seedTenant("tenant-a", "aa");
    const res = await get(`${base}/memberships`, a.token);
    expect(res.status).toBe(200);
    expect(res.body.data.memberships).toHaveLength(1);
    expect(res.body.data.memberships[0]).toMatchObject({ name: "aa Gold Plan", status: "active", frequency: "quarterly", price: "29.00" });
    expect(res.body.data.memberships[0]).not.toHaveProperty("manageUrl");
  });

  it("rebook: booking-flow link plus prefill; unavailable when booking disabled", async () => {
    const a = seedTenant("tenant-a", "aa");
    const res = await get(`${base}/rebook`, a.token);
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.bookingUrl).toMatch(/\/book\/tenant-a-book\?src=portal_rebook$/);
    expect(res.body.data.prefill).toMatchObject({ firstName: "aaFirst", zip: "aa-787", lastServiceTitle: "aa past clean" });

    const b = seedTenant("tenant-b", "bb", false);
    const off = await get(`${base}/sections/rebook`, b.token);
    expect(off.body.data).toMatchObject({ available: false, bookingUrl: null });
  });

  it("rejects missing, invalid, expired and foreign-customer tokens (401)", async () => {
    const a = seedTenant("tenant-a", "aa");
    const b = seedTenant("tenant-b", "bb");
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign(
      { companyId: a.company.id, customerId: a.customer.id, jti: crypto.randomUUID(), tokenType: "customer_portal", exp: Math.floor(Date.now() / 1000) - 60 },
      "booking_hold_token_secret"
    );
    // Valid signature but the customer belongs to another company → fail closed.
    const wrongCustomer = portalToken.generateCustomerPortalToken({ companyId: a.company.id, customerId: b.customer.id }).token;
    for (const path of ["/sections", "/history", "/open-invoices", "/memberships", "/rebook", "/sections/nope"]) {
      expect((await get(`${base}${path}`)).status).toBe(401);
      for (const t of ["x".repeat(20), expired, wrongCustomer]) {
        expect((await get(`${base}${path}`, t)).status).toBe(401);
      }
    }
  });

  it("isolates tenants and sibling customers", async () => {
    const a = seedTenant("tenant-a", "aa");
    seedTenant("tenant-b", "bb");
    const sib = fakeDb.seedCustomer({ companyId: a.company.id, firstName: "Sib", lastName: "Ling" });
    fakeDb.seedInvoice({ companyId: a.company.id, customerId: sib.id, status: "sent", total: "1.00", balanceDue: "1.00", paymentToken: "sib-pay" } as never);
    fakeDb.seedMaintenancePlan({ companyId: a.company.id, customerId: sib.id, name: "sib plan", status: "active", frequency: "annual", startDate: "2026-01-01" } as never);
    const bodies = [];
    for (const key of ["history", "invoices", "memberships", "rebook"]) {
      const res = await get(`${base}/sections/${key}`, a.token);
      expect(res.status).toBe(200);
      bodies.push(res.body);
    }
    const all = JSON.stringify(bodies);
    expect(all).not.toMatch(/bb-|bbFirst|sib|tenant-b/i);
  });

  it("allowlist: no internal ids, notes, cost/margin or stripe ids leak", async () => {
    const a = seedTenant("tenant-a", "aa");
    const bodies = [];
    for (const key of ["history", "invoices", "memberships", "rebook"]) {
      bodies.push((await get(`${base}/sections/${key}`, a.token)).body);
    }
    const all = JSON.stringify(bodies);
    for (const marker of SECRET_MARKERS) expect(all).not.toContain(marker);
    expect(all).not.toContain(a.company.id);
    expect(all).not.toContain(a.customer.id);
    expect(all).not.toMatch(/"(id|companyId|customerId)"/);
  });

  it("unknown section key → 404 (after token check)", async () => {
    const a = seedTenant("tenant-a", "aa");
    expect((await get(`${base}/sections/does-not-exist`, a.token)).status).toBe(404);
  });
});
