/**
 * FS-169 — technician mobile API route tests.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";



import { closeTestApp } from "../../test-support/close-test-app.js";
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

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");

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
  await closeTestApp(app);
});

function bearer(companyId: string, userId: string, role: string): string {
  return `Bearer ${tokens.generateAccessToken({ userId, companyId, role })}`;
}

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "Mobile Co", slug: "mobile-co" });
  const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Pat", lastName: "C", leadSource: "web" });
  const mkTech = (companyId: string, email: string) => {
    const user = fakeDb.seedUser({ companyId, email, firstName: "T", lastName: email, role: "technician" });
    const tech = fakeDb.seedTechnician({ companyId, userId: user.id, firstName: "T", lastName: email, phone: "+15555550101" });
    return { user, tech };
  };
  const me = mkTech(company.id, "me@mobile.test");
  const peer = mkTech(company.id, "peer@mobile.test");
  const office = fakeDb.seedUser({ companyId: company.id, email: "office@mobile.test", firstName: "O", lastName: "Ffice", role: "office" });
  const day = "2026-10-27";
  const late = fakeDb.seedJob({
    companyId: company.id, customerId: customer.id, technicianId: me.tech.id, status: "scheduled",
    title: "Late", scheduledStart: new Date(`${day}T17:00:00.000Z`)
  });
  const early = fakeDb.seedJob({
    companyId: company.id, customerId: customer.id, technicianId: me.tech.id, status: "scheduled",
    title: "Early", scheduledStart: new Date(`${day}T13:00:00.000Z`)
  });
  fakeDb.seedJob({
    companyId: company.id, customerId: customer.id, technicianId: me.tech.id, status: "scheduled",
    title: "Tomorrow", scheduledStart: new Date("2026-10-28T13:00:00.000Z")
  });
  const peerJob = fakeDb.seedJob({
    companyId: company.id, customerId: customer.id, technicianId: peer.tech.id, status: "scheduled",
    title: "Peer", scheduledStart: new Date(`${day}T14:00:00.000Z`)
  });
  const task = fakeDb.seedJobTask({ companyId: company.id, jobId: early.id, title: "Check filter" });
  const meAuth = bearer(company.id, me.user.id, "technician");
  return { company, other, customer, me, peer, office, day, late, early, peerJob, task, meAuth };
}

describe("FS-169 technician mobile API", () => {
  it("401 without auth", async () => {
    const res = await request(app.server).get("/api/v1/mobile/today");
    expect(res.status).toBe(401);
  });

  it("Today list: own jobs for the day in route order with recordVersion on job + checklist", async () => {
    const w = seedWorld();
    const res = await request(app.server).get(`/api/v1/mobile/today?date=${w.day}`).set("Authorization", w.meAuth);
    expect(res.status).toBe(200);
    expect(res.body.technicianId).toBe(w.me.tech.id);
    expect(res.body.jobs.map((j: { id: string }) => j.id)).toEqual([w.early.id, w.late.id]);
    const early = res.body.jobs[0];
    expect(early.recordVersion).toMatch(/^rv1?.*:job:/);
    expect(early.checklist).toHaveLength(1);
    expect(early.checklist[0].recordVersion).toContain(`:job_task:${w.task.id}:`);
  });

  it("technician cannot pass another technicianId to see their jobs; office must pass one", async () => {
    const w = seedWorld();
    const res = await request(app.server)
      .get(`/api/v1/mobile/today?date=${w.day}&technicianId=${w.peer.tech.id}`)
      .set("Authorization", w.meAuth);
    expect(res.body.technicianId).toBe(w.me.tech.id);
    const officeAuth = bearer(w.company.id, w.office.id, "office");
    expect((await request(app.server).get(`/api/v1/mobile/today`).set("Authorization", officeAuth)).status).toBe(400);
    const ok = await request(app.server)
      .get(`/api/v1/mobile/today?date=${w.day}&technicianId=${w.peer.tech.id}`)
      .set("Authorization", officeAuth);
    expect(ok.status).toBe(200);
    expect(ok.body.jobs.map((j: { id: string }) => j.id)).toEqual([w.peerJob.id]);
  });

  it("denies another technician's job and cross-tenant access (404)", async () => {
    const w = seedWorld();
    const peerRes = await request(app.server).get(`/api/v1/mobile/jobs/${w.peerJob.id}`).set("Authorization", w.meAuth);
    expect(peerRes.status).toBe(404);
    const otw = await request(app.server).post(`/api/v1/mobile/jobs/${w.peerJob.id}/on-the-way`).set("Authorization", w.meAuth).send({});
    expect(otw.status).toBe(404);
    const otherUser = fakeDb.seedUser({ companyId: w.other.id, email: "x@other.test", firstName: "X", lastName: "Y", role: "admin" });
    const cross = await request(app.server)
      .get(`/api/v1/mobile/jobs/${w.early.id}`)
      .set("Authorization", bearer(w.other.id, otherUser.id, "admin"));
    expect(cross.status).toBe(404);
  });

  it("on-the-way sets dispatched + timestamp and does not enqueue SMS", async () => {
    const w = seedWorld();
    const jobsModule = await import("@fsm/jobs");
    const res = await request(app.server)
      .post(`/api/v1/mobile/jobs/${w.early.id}/on-the-way`)
      .set("Authorization", w.meAuth)
      .send({ estimatedArrivalMinutes: 15 });
    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe("dispatched");
    expect(res.body.job.onTheWayAt).toEqual(expect.any(String));
    expect(jobsModule.notificationsQueue.add).not.toHaveBeenCalled();
  });

  it("stale recordVersion returns 409 with current record; omitted version is accepted", async () => {
    const w = seedWorld();
    const stale = `${(await request(app.server).get(`/api/v1/mobile/jobs/${w.early.id}`).set("Authorization", w.meAuth)).body.job.recordVersion}`;
    const first = await request(app.server)
      .patch(`/api/v1/mobile/jobs/${w.early.id}/status`).set("Authorization", w.meAuth)
      .send({ status: "dispatched", recordVersion: stale });
    expect(first.status).toBe(200);
    expect(first.body.job.recordVersion).not.toBe(stale);
    const conflict = await request(app.server)
      .patch(`/api/v1/mobile/jobs/${w.early.id}/status`).set("Authorization", w.meAuth)
      .send({ status: "in_progress", recordVersion: stale });
    expect(conflict.status).toBe(409);
    expect(conflict.body.reason).toBe("stale_record_version");
    expect(conflict.body.current.status).toBe("dispatched");
    const noVersion = await request(app.server)
      .patch(`/api/v1/mobile/jobs/${w.early.id}/status`).set("Authorization", w.meAuth)
      .send({ status: "in_progress" });
    expect(noVersion.status).toBe(200);
    expect(noVersion.body.job.status).toBe("in_progress");
  });

  it("checklist update honours recordVersion", async () => {
    const w = seedWorld();
    const job = (await request(app.server).get(`/api/v1/mobile/jobs/${w.early.id}`).set("Authorization", w.meAuth)).body.job;
    const v = job.checklist[0].recordVersion;
    const ok = await request(app.server)
      .patch(`/api/v1/mobile/jobs/${w.early.id}/checklist/${w.task.id}`).set("Authorization", w.meAuth)
      .send({ status: "completed", recordVersion: v });
    expect(ok.status).toBe(200);
    expect(ok.body.item.status).toBe("completed");
    const conflict = await request(app.server)
      .patch(`/api/v1/mobile/jobs/${w.early.id}/checklist/${w.task.id}`).set("Authorization", w.meAuth)
      .send({ notes: "again", recordVersion: v });
    expect(conflict.status).toBe(409);
    expect(conflict.body.current.id).toBe(w.task.id);
  });

  it("report issue creates an internal job note and can put the job on hold", async () => {
    const w = seedWorld();
    const res = await request(app.server)
      .post(`/api/v1/mobile/jobs/${w.early.id}/issues`).set("Authorization", w.meAuth)
      .send({ category: "parts_needed", severity: "high", description: "Need capacitor", putOnHold: true });
    expect(res.status).toBe(201);
    expect(res.body.issue).toMatchObject({ jobId: w.early.id, category: "parts_needed", severity: "high" });
    expect(res.body.job.status).toBe("on_hold");
    const bad = await request(app.server)
      .post(`/api/v1/mobile/jobs/${w.peerJob.id}/issues`).set("Authorization", w.meAuth)
      .send({ category: "other", description: "x" });
    expect(bad.status).toBe(404);
  });
});
