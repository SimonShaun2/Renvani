
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

describe("technician authz scoping", () => {
  it("GET /jobs returns only the technician's own jobs and ignores a technicianId override", async () => {
    const { me, otherTech, myJob } = setup();
    const own = await api().get("/api/v1/jobs").set("Authorization", me.authorization);
    const override = await api().get(`/api/v1/jobs?technicianId=${otherTech.id}`).set("Authorization", me.authorization);
    expect(own.status).toBe(200);
    expect(own.body.data.map((job: { id: string }) => job.id)).toEqual([myJob.id]);
    expect(override.body.data.map((job: { id: string }) => job.id)).toEqual([myJob.id]);
  });

  it("technician without a linked technician record sees no jobs", async () => {
    const { company } = setup();
    const unlinked = login(company.id, "technician", "unlinked@example.com");
    const response = await api().get("/api/v1/jobs").set("Authorization", unlinked.authorization);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("GET /jobs/:id hides other technicians' jobs (404) but returns own", async () => {
    const { me, myJob, otherJob } = setup();
    expect((await api().get(`/api/v1/jobs/${otherJob.id}`).set("Authorization", me.authorization)).status).toBe(404);
    expect((await api().get(`/api/v1/jobs/${myJob.id}`).set("Authorization", me.authorization)).status).toBe(200);
  });

  it("only the assigned technician can complete a job or a task", async () => {
    const { company, me, myJob, otherJob } = setup();
    const otherTask = fakeDb.seedJobTask({ companyId: company.id, jobId: otherJob.id, title: "Other step" });
    const myTask = fakeDb.seedJobTask({ companyId: company.id, jobId: myJob.id, title: "My step" });

    expect((await api().post(`/api/v1/jobs/${otherJob.id}/complete`).set("Authorization", me.authorization).send({})).status).toBe(403);
    expect((await api().post(`/api/v1/jobs/${otherJob.id}/tasks/${otherTask.id}/complete`).set("Authorization", me.authorization).send({})).status).toBe(403);
    expect(fakeDb.getTestState().jobs.find((row) => row.id === otherJob.id)?.status).toBe("in_progress");

    expect((await api().post(`/api/v1/jobs/${myJob.id}/tasks/${myTask.id}/complete`).set("Authorization", me.authorization).send({})).status).toBe(200);
    expect((await api().post(`/api/v1/jobs/${myJob.id}/complete`).set("Authorization", me.authorization).send({})).status).toBe(200);
  });

  it("office roles keep company-wide access (list, detail, complete)", async () => {
    for (const role of ["owner", "admin", "dispatcher", "office"] as const) {
      fakeDb.resetTestState();
      const { company, otherTech, myJob, otherJob } = setup();
      const staff = login(company.id, role, `${role}@example.com`);
      const all = await api().get("/api/v1/jobs").set("Authorization", staff.authorization);
      expect(all.body.data).toHaveLength(2);
      const filtered = await api().get(`/api/v1/jobs?technicianId=${otherTech.id}`).set("Authorization", staff.authorization);
      expect(filtered.body.data.map((job: { id: string }) => job.id)).toEqual([otherJob.id]);
      expect((await api().get(`/api/v1/jobs/${myJob.id}`).set("Authorization", staff.authorization)).status).toBe(200);
      expect((await api().post(`/api/v1/jobs/${otherJob.id}/complete`).set("Authorization", staff.authorization).send({})).status).toBe(200);
    }
  });

  it("GET /payments: technician 403, office roles 200", async () => {
    const { company, me } = setup();
    expect((await api().get("/api/v1/payments").set("Authorization", me.authorization)).status).toBe(403);
    for (const role of ["owner", "admin", "dispatcher", "office"] as const) {
      const staff = login(company.id, role, `${role}-pay@example.com`);
      expect((await api().get("/api/v1/payments").set("Authorization", staff.authorization)).status).toBe(200);
    }
  });

  it("cross-tenant: a technician of company A cannot see or complete company B's jobs", async () => {
    const { me } = setup();
    const b = seedCompanyGraph("beta-authz");
    const bJob = fakeDb.seedJob({ companyId: b.company.id, customerId: b.customer.id, title: "B job", status: "in_progress" });
    const bTask = fakeDb.seedJobTask({ companyId: b.company.id, jobId: bJob.id, title: "B step" });

    const list = await api().get("/api/v1/jobs").set("Authorization", me.authorization);
    expect(list.body.data.map((job: { id: string }) => job.id)).not.toContain(bJob.id);
    expect((await api().get(`/api/v1/jobs/${bJob.id}`).set("Authorization", me.authorization)).status).toBe(404);
    expect((await api().post(`/api/v1/jobs/${bJob.id}/complete`).set("Authorization", me.authorization).send({})).status).toBe(404);
    expect((await api().post(`/api/v1/jobs/${bJob.id}/tasks/${bTask.id}/complete`).set("Authorization", me.authorization).send({})).status).toBe(404);
    expect(fakeDb.getTestState().jobs.find((row) => row.id === bJob.id)?.status).toBe("in_progress");
  });
});
