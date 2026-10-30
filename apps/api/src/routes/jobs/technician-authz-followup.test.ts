
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob, redisDelMock, redisGetMock, redisSetMock } = vi.hoisted(() => ({
  addQueueJob: vi.fn(),
  redisDelMock: vi.fn(async () => 1),
  redisGetMock: vi.fn(async () => null),
  redisSetMock: vi.fn(async () => "OK")
}));

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
    add: addQueueJob
  },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
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
}, 20000);

beforeEach(async () => {
  fakeDb.resetTestState();
  addQueueJob.mockReset();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

type Role = "owner" | "admin" | "dispatcher" | "office" | "technician";

function seedCompanyGraph(slug: string) {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug, timezone: "America/Chicago" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Chris", lastName: "Pine" });
  return { company, customer };
}

function login(companyId: string, role: Role, email: string) {
  const user = fakeDb.seedUser({ companyId, email, firstName: "U", lastName: role, role });
  const token = tokens.generateAccessToken({ userId: user.id, companyId, role: user.role });
  return { user, authorization: `Bearer ${token}` };
}

function setup() {
  const { company, customer } = seedCompanyGraph("acme-authz");
  const me = login(company.id, "technician", "tech-me@example.com");
  const myTech = fakeDb.seedTechnician({ companyId: company.id, userId: me.user.id, firstName: "Me", lastName: "Tech", phone: "555-0001" });
  const otherTech = fakeDb.seedTechnician({ companyId: company.id, firstName: "Other", lastName: "Tech", phone: "555-0002" });
  const myJob = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: myTech.id, title: "Mine", status: "in_progress" });
  const otherJob = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: otherTech.id, title: "Theirs", status: "in_progress" });
  return { company, customer, me, myTech, otherTech, myJob, otherJob };
}

const api = () => request(app.server);

type Ctx = ReturnType<typeof setup>;
type Kind = "write" | "read" | "staff";
interface RouteCase {
  name: string;
  kind: Kind;
  call: (jobId: string, ctx: Ctx) => request.Test;
  /** Extra statuses that prove the request got past authz (domain-state conflicts). */
  ok?: number[];
  /** Fake DB lacks this route's backing data, so only the denial paths are asserted here. */
  denyOnly?: boolean;
}

function seedJobFixtures(ctx: Ctx, jobId: string, companyId = ctx.company.id) {
  const task = fakeDb.seedJobTask({ companyId, jobId, title: "Step" });
  const catalog = fakeDb.seedProductCatalog({ companyId, name: "Capacitor", unitPrice: "89.00" });
  return { task, catalog };
}

const fixtures = new Map<string, ReturnType<typeof seedJobFixtures>>();
const fx = (jobId: string) => fixtures.get(jobId)!;

const ROUTES: RouteCase[] = [
  { name: "PATCH /jobs/:id", kind: "write", call: (id) => api().patch(`/api/v1/jobs/${id}`).send({ title: "Renamed" }) },
  { name: "POST /jobs/:id/status", kind: "write", call: (id) => api().post(`/api/v1/jobs/${id}/status`).send({ status: "on_hold" }) },
  { name: "POST /jobs/:id/assign", kind: "staff", call: (id, c) => api().post(`/api/v1/jobs/${id}/assign`).send({ technicianId: c.myTech.id }) },
  { name: "POST /jobs/:id/schedule", kind: "staff", call: (id) => api().post(`/api/v1/jobs/${id}/schedule`).send({ scheduledStart: "2026-04-29T13:00:00.000Z", scheduledEnd: "2026-04-29T14:00:00.000Z" }), ok: [409] },
  { name: "POST /jobs/:id/tasks", kind: "write", call: (id) => api().post(`/api/v1/jobs/${id}/tasks`).send({ title: "New" }) },
  { name: "POST /jobs/:id/tasks/reorder", kind: "write", call: (id) => api().post(`/api/v1/jobs/${id}/tasks/reorder`).send({ orderedIds: [fx(id).task.id] }) },
  { name: "PATCH /jobs/:id/tasks/:taskId", kind: "write", call: (id) => api().patch(`/api/v1/jobs/${id}/tasks/${fx(id).task.id}`).send({ title: "Edited" }) },
  { name: "DELETE /jobs/:id/tasks/:taskId", kind: "write", call: (id) => api().delete(`/api/v1/jobs/${id}/tasks/${fx(id).task.id}`) },
  { name: "POST /jobs/:id/notes", kind: "write", call: (id) => api().post(`/api/v1/jobs/${id}/notes`).send({ content: "Note" }) },
  { name: "POST /jobs/:id/photos", kind: "write", call: (id) => api().post(`/api/v1/jobs/${id}/photos`).send({ url: "https://cdn.example.com/p.jpg", photoType: "before" }) },
  { name: "POST /jobs/:id/products", kind: "write", call: (id) => api().post(`/api/v1/jobs/${id}/products`).send({ productCatalogId: fx(id).catalog.id, quantity: 1 }) },
  { name: "POST /jobs/:id/time/start", kind: "write", call: (id, c) => api().post(`/api/v1/jobs/${id}/time/start`).send({ technicianId: c.myTech.id, entryType: "on_site" }) },
  { name: "POST /jobs/:id/time/stop", kind: "write", call: (id, c) => api().post(`/api/v1/jobs/${id}/time/stop`).send({ technicianId: c.myTech.id }), ok: [200, 404, 409] },
  { name: "POST /jobs/:id/on-the-way", kind: "write", call: (id, c) => api().post(`/api/v1/jobs/${id}/on-the-way`).send({ technicianId: c.myTech.id, estimatedArrivalMinutes: 20 }), ok: [200, 201, 202, 409, 422] },
  { name: "GET /jobs/:id/service-brief", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/service-brief`), denyOnly: true },
  { name: "GET /jobs/:id/preparation-status", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/preparation-status`), denyOnly: true },
  { name: "GET /jobs/:id/notes", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/notes`) },
  { name: "GET /jobs/:id/photos", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/photos`) },
  { name: "GET /jobs/:id/tasks", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/tasks`) },
  { name: "GET /jobs/:id/products", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/products`) },
  { name: "GET /jobs/:id/activity", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/activity`) },
  { name: "GET /jobs/:id/time", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/time`) },
  { name: "GET /jobs/:id/on-the-way", kind: "read", call: (id) => api().get(`/api/v1/jobs/${id}/on-the-way`) }
];

const DENIED: Record<Kind, number> = { write: 403, read: 404, staff: 403 };
const allowed = (route: RouteCase, status: number) => (route.ok ?? []).includes(status) || (status >= 200 && status < 300);

function seedAll() {
  fixtures.clear();
  const ctx = setup();
  fixtures.set(ctx.myJob.id, seedJobFixtures(ctx, ctx.myJob.id));
  fixtures.set(ctx.otherJob.id, seedJobFixtures(ctx, ctx.otherJob.id));
  return ctx;
}

describe("technician authz follow-up: job sub-resources", () => {
  for (const route of ROUTES) {
    describe(route.name, () => {
      it(`technician on another tech's job -> ${DENIED[route.kind]}`, async () => {
        const ctx = seedAll();
        const response = await route.call(ctx.otherJob.id, ctx).set("Authorization", ctx.me.authorization);
        expect(response.status).toBe(DENIED[route.kind]);
      });

      it.skipIf(route.denyOnly)(route.kind === "staff" ? "technician denied by role even on own job (403)" : "assigned technician allowed on own job", async () => {
        const ctx = seedAll();
        const response = await route.call(ctx.myJob.id, ctx).set("Authorization", ctx.me.authorization);
        if (route.kind === "staff") {
          expect(response.status).toBe(403);
        } else {
          expect(allowed(route, response.status), `${response.status} ${JSON.stringify(response.body)}`).toBe(true);
        }
      });

      it.skipIf(route.denyOnly)("owner/admin/dispatcher/office unchanged (allowed on any company job)", async () => {
        for (const role of ["owner", "admin", "dispatcher", "office"] as const) {
          const ctx = seedAll();
          const staff = login(ctx.company.id, role, `${role}@example.com`);
          const response = await route.call(ctx.otherJob.id, ctx).set("Authorization", staff.authorization);
          expect(allowed(route, response.status), `${role}: ${response.status} ${JSON.stringify(response.body)}`).toBe(true);
          fakeDb.resetTestState();
        }
      });

      it("cross-tenant: technician cannot reach company B's job", async () => {
        const ctx = seedAll();
        const b = seedCompanyGraph("beta-authz2");
        const bJob = fakeDb.seedJob({ companyId: b.company.id, customerId: b.customer.id, title: "B", status: "in_progress" });
        fixtures.set(bJob.id, seedJobFixtures(ctx, bJob.id, b.company.id));
        const response = await route.call(bJob.id, ctx).set("Authorization", ctx.me.authorization);
        expect(response.status).toBe(route.kind === "staff" ? 403 : 404);
      });
    });
  }
});

describe("technician authz follow-up: GET /invoices/:id/payments", () => {
  function seedInvoices(ctx: Ctx) {
    const mine = fakeDb.seedInvoice({ companyId: ctx.company.id, customerId: ctx.customer.id, jobId: ctx.myJob.id, total: "100.00", balanceDue: "100.00" });
    const theirs = fakeDb.seedInvoice({ companyId: ctx.company.id, customerId: ctx.customer.id, jobId: ctx.otherJob.id, total: "100.00", balanceDue: "100.00" });
    const noJob = fakeDb.seedInvoice({ companyId: ctx.company.id, customerId: ctx.customer.id, total: "100.00", balanceDue: "100.00" });
    return { mine, theirs, noJob };
  }
  const get = (id: string, auth: string) => api().get(`/api/v1/invoices/${id}/payments`).set("Authorization", auth);

  it("technician: own job's invoice 200; other tech's or job-less invoice 404", async () => {
    const ctx = setup();
    const inv = seedInvoices(ctx);
    expect((await get(inv.mine.id, ctx.me.authorization)).status).toBe(200);
    expect((await get(inv.theirs.id, ctx.me.authorization)).status).toBe(404);
    expect((await get(inv.noJob.id, ctx.me.authorization)).status).toBe(404);
  });

  it("other roles unchanged", async () => {
    const ctx = setup();
    const inv = seedInvoices(ctx);
    for (const role of ["owner", "admin", "dispatcher", "office"] as const) {
      const staff = login(ctx.company.id, role, `${role}-inv@example.com`);
      expect((await get(inv.theirs.id, staff.authorization)).status).toBe(200);
      expect((await get(inv.noJob.id, staff.authorization)).status).toBe(200);
    }
  });

  it("cross-tenant: company B invoice is 404 for a company A technician", async () => {
    const ctx = setup();
    const b = seedCompanyGraph("beta-inv");
    const bJob = fakeDb.seedJob({ companyId: b.company.id, customerId: b.customer.id, title: "B", status: "in_progress" });
    const bInv = fakeDb.seedInvoice({ companyId: b.company.id, customerId: b.customer.id, jobId: bJob.id, total: "1.00", balanceDue: "1.00" });
    expect((await get(bInv.id, ctx.me.authorization)).status).toBe(404);
  });
});
