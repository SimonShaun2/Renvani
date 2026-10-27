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
  aiQueue: {
    add: vi.fn()
  }
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


type Role = "owner" | "admin" | "dispatcher" | "office" | "technician";

function createAuth(role: Role = "owner", slug = "acme-hvac") {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}-${slug}@example.com`,
    firstName: "Ava",
    lastName: "Stone",
    role
  });
  const accessToken = tokens.generateAccessToken({ userId: user.id, companyId: company.id, role: user.role });
  return { company, user, authorization: `Bearer ${accessToken}` };
}

function seedCustomer(companyId: string, firstName = "Chris") {
  return fakeDb.seedCustomer({ companyId, firstName, lastName: "Pine", email: `${firstName}@example.com` });
}

describe("POST /customers/:id/notes", () => {
  it("creates a note (201) and it is returned by GET notes", async () => {
    const auth = createAuth("office");
    const customer = seedCustomer(auth.company.id);

    const res = await request(app.server)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", auth.authorization)
      .send({ content: "  Gate code 1234  ", isInternal: true });

    expect(res.status).toBe(201);
    expect(res.body.note).toMatchObject({
      customerId: customer.id,
      companyId: auth.company.id,
      authorId: auth.user.id,
      content: "Gate code 1234",
      isInternal: true
    });

    const list = await request(app.server)
      .get(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", auth.authorization);
    expect(list.status).toBe(200);
    expect(list.body.notes.map((n: { id: string }) => n.id)).toContain(res.body.note.id);
  });

  it("validates body (400)", async () => {
    const auth = createAuth();
    const customer = seedCustomer(auth.company.id);
    for (const body of [{}, { content: "   " }, { content: "x", extra: 1 }, { content: "x", notedAt: "nope" }]) {
      const res = await request(app.server)
        .post(`/api/v1/customers/${customer.id}/notes`)
        .set("Authorization", auth.authorization)
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it("requires auth (401) and blocks technicians (403)", async () => {
    const tech = createAuth("technician");
    const customer = seedCustomer(tech.company.id);

    const anon = await request(app.server).post(`/api/v1/customers/${customer.id}/notes`).send({ content: "hi" });
    expect(anon.status).toBe(401);

    const res = await request(app.server)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", tech.authorization)
      .send({ content: "hi" });
    expect(res.status).toBe(403);
  });

  it("returns 404 for another tenant's customer and writes nothing", async () => {
    const a = createAuth("owner", "tenant-a");
    const b = createAuth("owner", "tenant-b");
    const foreign = seedCustomer(b.company.id, "Bea");

    const res = await request(app.server)
      .post(`/api/v1/customers/${foreign.id}/notes`)
      .set("Authorization", a.authorization)
      .send({ content: "should not land" });
    expect(res.status).toBe(404);

    const bList = await request(app.server)
      .get(`/api/v1/customers/${foreign.id}/notes`)
      .set("Authorization", b.authorization);
    expect(bList.body.notes).toHaveLength(0);
  });
});

describe("FS-168 customer portal", () => {
  async function issueLink(authorization: string, customerId: string) {
    return request(app.server).post(`/api/v1/customers/${customerId}/portal-link`).set("Authorization", authorization);
  }

  function seedPortalData(companyId: string, customerId: string, tag: string) {
    const future = new Date(Date.now() + 3 * 86_400_000);
    const pastDate = new Date(Date.now() - 10 * 86_400_000);
    fakeDb.seedJob({ companyId, customerId, title: `${tag} upcoming`, status: "scheduled", scheduledStart: future });
    fakeDb.seedJob({ companyId, customerId, title: `${tag} past`, status: "completed", scheduledStart: pastDate });
    fakeDb.seedEstimate({ companyId, customerId, title: `${tag} sent`, status: "sent", total: "100.00", subtotal: "100.00" });
    fakeDb.seedEstimate({ companyId, customerId, title: `${tag} draft`, status: "draft" });
    fakeDb.seedInvoice({ companyId, customerId, status: "sent", total: "50.00", balanceDue: "50.00", paymentToken: `${tag}-pay` });
    fakeDb.seedInvoice({ companyId, customerId, status: "draft", total: "9.00", balanceDue: "9.00" });
  }

  it("issues a link (staff, 201) and serves only the token's own customer data", async () => {
    const a = createAuth("dispatcher", "tenant-a");
    const b = createAuth("owner", "tenant-b");
    const mine = seedCustomer(a.company.id, "Mine");
    const sibling = seedCustomer(a.company.id, "Sibling");
    const foreign = seedCustomer(b.company.id, "Foreign");
    seedPortalData(a.company.id, mine.id, "mine");
    seedPortalData(a.company.id, sibling.id, "sibling");
    seedPortalData(b.company.id, foreign.id, "foreign");

    const linkRes = await issueLink(a.authorization, mine.id);
    expect(linkRes.status).toBe(201);
    const { token, url, expiresAt } = linkRes.body.link;
    expect(typeof token).toBe("string");
    expect(url).toContain(`/portal#token=`);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    const base = `/api/v1/public/customer-portal/me`;
    const get = (path: string) => request(app.server).get(path).set("x-customer-portal-token", token);
    const account = await get(base);
    expect(account.status).toBe(200);
    expect(account.body.account.customer.id).toBe(mine.id);
    expect(account.body.account.customer).not.toHaveProperty("internalNotes");

    const visits = await get(`${base}/visits`);
    expect(visits.status).toBe(200);
    expect(visits.body.visits.upcoming.map((v: { title: string }) => v.title)).toEqual(["mine upcoming"]);
    expect(visits.body.visits.past.map((v: { title: string }) => v.title)).toEqual(["mine past"]);

    const estimates = await get(`${base}/estimates`);
    expect(estimates.status).toBe(200);
    expect(estimates.body.estimates.map((e: { title: string }) => e.title)).toEqual(["mine sent"]);

    const invoices = await get(`${base}/invoices`);
    expect(invoices.status).toBe(200);
    expect(invoices.body.invoices).toHaveLength(1);
    expect(invoices.body.invoices[0].paymentToken).toBe("mine-pay");

    const all = JSON.stringify([account.body, visits.body, estimates.body, invoices.body]);
    expect(all).not.toContain("sibling");
    expect(all).not.toContain("foreign");
    expect(all).not.toContain(b.company.id);
  });

  it("rejects bad/forged tokens and tokens for deleted customers (401)", async () => {
    const a = createAuth("owner");
    const customer = seedCustomer(a.company.id);
    const jwt = (await import("jsonwebtoken")).default;

    const forged = jwt.sign(
      { companyId: a.company.id, customerId: customer.id, jti: crypto.randomUUID(), tokenType: "customer_portal" },
      "not-the-secret",
      { expiresIn: 60 }
    );
    const wrongType = jwt.sign(
      { companyId: a.company.id, customerId: customer.id, jti: crypto.randomUUID(), tokenType: "booking_manage" },
      "booking_hold_token_secret",
      { expiresIn: 60 }
    );
    expect((await request(app.server).get(`/api/v1/public/customer-portal/me/invoices`)).status).toBe(401);
    for (const t of ["short", "x".repeat(20), forged, wrongType]) {
      const res = await request(app.server)
        .get(`/api/v1/public/customer-portal/me/invoices`)
        .set("x-customer-portal-token", t);
      expect(res.status).toBe(401);
    }

    const { token } = (await issueLink(a.authorization, customer.id)).body.link;
    await request(app.server).delete(`/api/v1/customers/${customer.id}`).set("Authorization", a.authorization);
    const res = await request(app.server).get(`/api/v1/public/customer-portal/me`).set("x-customer-portal-token", token);
    expect(res.status).toBe(401);
  });

  it("portal-link: 401 anon, 403 technician, 404 cross-tenant", async () => {
    const a = createAuth("owner", "tenant-a");
    const tech = createAuth("technician", "tenant-t");
    const foreign = seedCustomer(createAuth("owner", "tenant-b").company.id, "Foreign");
    const own = seedCustomer(tech.company.id);

    expect((await request(app.server).post(`/api/v1/customers/${own.id}/portal-link`)).status).toBe(401);
    expect((await issueLink(tech.authorization, own.id)).status).toBe(403);
    expect((await issueLink(a.authorization, foreign.id)).status).toBe(404);
  });
});
