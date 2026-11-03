/**
 * FS-24 Scheduling Agent changes and exceptions: reschedule, cancel, exceptions, versioning, idempotency,
 * collisions, cancellation window, tenant isolation and role gates.
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
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) }
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

const bearer = (companyId: string, userId: string, role: string) => `Bearer ${tokens.generateAccessToken({ userId, companyId, role })}`;
const H = 3_600_000;
const at = (ms: number) => new Date(ms);
const BASE = Date.UTC(2030, 4, 12, 14, 0, 0);

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "Northside Heating & Air", slug: "northside-hvac" });
  const other = fakeDb.seedCompany({ name: "Other Plumbing", slug: "other-plumbing" });
  const user = (companyId: string, role: string) =>
    fakeDb.seedUser({ companyId, email: `${role}-${companyId.slice(0, 6)}@t.test`, firstName: role, lastName: "U", role: role as never });
  const owner = user(company.id, "owner");
  const admin = user(company.id, "admin");
  const dispatcher = user(company.id, "dispatcher");
  const technicianUser = user(company.id, "technician");
  const otherOwner = user(other.id, "owner");
  const tech = fakeDb.seedTechnician({ companyId: company.id, firstName: "Ray", lastName: "Ortiz", phone: "+15125550101" });
  const tech2 = fakeDb.seedTechnician({ companyId: company.id, firstName: "Kim", lastName: "Lee", phone: "+15125550102" });
  const otherTech = fakeDb.seedTechnician({ companyId: other.id, firstName: "Z", lastName: "Z", phone: "+15125550103" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Dana", lastName: "Whitfield" } as never);
  const otherCustomer = fakeDb.seedCustomer({ companyId: other.id, firstName: "O", lastName: "C" } as never);
  const job = fakeDb.seedJob({
    companyId: company.id,
    customerId: customer.id,
    technicianId: tech.id,
    status: "scheduled",
    title: "Furnace tune-up",
    jobNumber: "J-100",
    scheduledStart: at(BASE),
    scheduledEnd: at(BASE + 2 * H)
  } as never);
  const busy = fakeDb.seedJob({
    companyId: company.id,
    customerId: customer.id,
    technicianId: tech2.id,
    status: "scheduled",
    title: "Water heater replacement",
    jobNumber: "J-101",
    scheduledStart: at(BASE + 24 * H),
    scheduledEnd: at(BASE + 27 * H)
  } as never);
  const otherJob = fakeDb.seedJob({
    companyId: other.id,
    customerId: otherCustomer.id,
    status: "scheduled",
    title: "Panel upgrade",
    jobNumber: "J-1",
    scheduledStart: at(BASE),
    scheduledEnd: at(BASE + H)
  } as never);
  const as = (u: { id: string; companyId: string; role: string }) => bearer(u.companyId, u.id, u.role);
  return { company, owner, admin, dispatcher, technicianUser, otherOwner, tech, tech2, otherTech, job, busy, otherJob, as };
}

const url = (jobId: string, path: string) => `/api/v1/scheduling-agent/jobs/${jobId}/${path}`;
const move = (over: Record<string, unknown> = {}) => ({
  expectedVersion: 1,
  idempotencyKey: "resched-key-0001",
  scheduledStart: at(BASE + 48 * H).toISOString(),
  scheduledEnd: at(BASE + 50 * H).toISOString(),
  reason: "Customer asked for Thursday",
  ...over
});

describe("FS-24 schedule changes", () => {
  it("returns the schedule at version 1 with empty history", async () => {
    const w = seedWorld();
    const res = await request(app.server).get(url(w.job.id, "schedule")).set("Authorization", w.as(w.dispatcher));
    expect(res.status).toBe(200);
    expect(res.body.schedule).toMatchObject({ jobId: w.job.id, scheduleVersion: 1, status: "scheduled", technicianId: w.tech.id });
    expect(res.body.history).toEqual([]);
  });

  it("reschedules, bumps the version, records history and replays the same key", async () => {
    const w = seedWorld();
    const res = await request(app.server).post(url(w.job.id, "reschedule")).set("Authorization", w.as(w.dispatcher)).send(move());
    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(false);
    expect(res.body.schedule).toMatchObject({ scheduleVersion: 2, scheduledStart: move().scheduledStart, scheduledEnd: move().scheduledEnd });
    expect(res.body.change).toMatchObject({ action: "reschedule", version: 2, reason: "Customer asked for Thursday", previous: { scheduledStart: at(BASE).toISOString() } });

    const replay = await request(app.server).post(url(w.job.id, "reschedule")).set("Authorization", w.as(w.dispatcher)).send(move());
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.change.id).toBe(res.body.change.id);

    const reused = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send(move({ reason: "different" }));
    expect(reused.status).toBe(409);
    expect(reused.body.fields).toMatchObject({ reason: "idempotency_conflict" });

    const detail = await request(app.server).get(url(w.job.id, "schedule")).set("Authorization", w.as(w.owner));
    expect(detail.body.schedule.scheduleVersion).toBe(2);
    expect(detail.body.history).toHaveLength(1);
  });

  it("rejects a stale expectedVersion with 409 stale_version", async () => {
    const w = seedWorld();
    await request(app.server).post(url(w.job.id, "reschedule")).set("Authorization", w.as(w.dispatcher)).send(move());
    const stale = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.admin))
      .send(move({ idempotencyKey: "resched-key-0002", scheduledStart: at(BASE + 72 * H).toISOString(), scheduledEnd: at(BASE + 73 * H).toISOString() }));
    expect(stale.status).toBe(409);
    expect(stale.body.fields).toMatchObject({ reason: "stale_version", currentVersion: "2" });
  });

  it("blocks a collision with the technician's other visit (409 schedule_conflict)", async () => {
    const w = seedWorld();
    const res = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send(move({ technicianId: w.tech2.id, scheduledStart: at(BASE + 25 * H).toISOString(), scheduledEnd: at(BASE + 26 * H).toISOString() }));
    expect(res.status).toBe(409);
    expect(res.body.fields).toMatchObject({ reason: "schedule_conflict", conflictJobId: w.busy.id });
    // back-to-back is fine
    const ok = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send(move({ idempotencyKey: "resched-key-0003", technicianId: w.tech2.id, scheduledStart: at(BASE + 27 * H).toISOString(), scheduledEnd: at(BASE + 28 * H).toISOString() }));
    expect(ok.status).toBe(200);
    expect(ok.body.schedule.technicianId).toBe(w.tech2.id);
  });

  it("validates times and rejects another company's technician", async () => {
    const w = seedWorld();
    const backwards = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send(move({ scheduledEnd: at(BASE + 47 * H).toISOString() }));
    expect(backwards.status).toBe(400);
    const past = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send(move({ scheduledStart: "2020-01-01T10:00:00.000Z", scheduledEnd: "2020-01-01T11:00:00.000Z" }));
    expect(past.status).toBe(400);
    const foreignTech = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send(move({ technicianId: w.otherTech.id }));
    expect(foreignTech.status).toBe(400);
    const extra = await request(app.server)
      .post(url(w.job.id, "reschedule"))
      .set("Authorization", w.as(w.dispatcher))
      .send({ ...move(), status: "completed" });
    expect(extra.status).toBe(400);
  });

  it("won't reschedule a completed visit", async () => {
    const w = seedWorld();
    const done = fakeDb.seedJob({ companyId: w.company.id, customerId: w.job.customerId, status: "completed", title: "Done", jobNumber: "J-102" } as never);
    const res = await request(app.server).post(url(done.id, "reschedule")).set("Authorization", w.as(w.owner)).send(move());
    expect(res.status).toBe(409);
    expect(res.body.fields).toMatchObject({ reason: "not_reschedulable" });
  });

  it("cancels outside the window; inside the window only owner/admin can", async () => {
    const w = seedWorld();
    const far = await request(app.server)
      .post(url(w.job.id, "cancel"))
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 1, idempotencyKey: "cancel-key-0001", reason: "Customer sold the house" });
    expect(far.status).toBe(200);
    expect(far.body.schedule.status).toBe("cancelled");

    const soon = fakeDb.seedJob({
      companyId: w.company.id,
      customerId: w.job.customerId,
      status: "scheduled",
      title: "AC repair",
      jobNumber: "J-103",
      scheduledStart: at(Date.now() + 2 * H),
      scheduledEnd: at(Date.now() + 3 * H)
    } as never);
    const denied = await request(app.server)
      .post(url(soon.id, "cancel"))
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 1, idempotencyKey: "cancel-key-0002", reason: "Tech out sick" });
    expect(denied.status).toBe(403);
    expect(denied.body.fields).toMatchObject({ reason: "cancellation_window" });
    const allowed = await request(app.server)
      .post(url(soon.id, "cancel"))
      .set("Authorization", w.as(w.owner))
      .send({ expectedVersion: 1, idempotencyKey: "cancel-key-0003", reason: "Tech out sick" });
    expect(allowed.status).toBe(200);
  });

  it("records an exception for human escalation without moving the visit", async () => {
    const w = seedWorld();
    const res = await request(app.server)
      .post(url(w.job.id, "exceptions"))
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 1, idempotencyKey: "exc-key-00001", kind: "late_staff", note: "Ray is 40 minutes behind", delayMinutes: 40 });
    expect(res.status).toBe(200);
    expect(res.body.change).toMatchObject({ action: "exception", version: 2, exception: { kind: "late_staff", delayMinutes: 40, escalation: "human" } });
    expect(res.body.schedule).toMatchObject({ scheduleVersion: 2, scheduledStart: at(BASE).toISOString(), status: "scheduled" });
    const bad = await request(app.server)
      .post(url(w.job.id, "exceptions"))
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 2, idempotencyKey: "exc-key-00002", kind: "aliens", note: "x" });
    expect(bad.status).toBe(400);
  });

  it("isolates tenants: another company's job is 404 on every route", async () => {
    const w = seedWorld();
    const auth = w.as(w.otherOwner);
    expect((await request(app.server).get(url(w.job.id, "schedule")).set("Authorization", auth)).status).toBe(404);
    expect((await request(app.server).post(url(w.job.id, "reschedule")).set("Authorization", auth).send(move())).status).toBe(404);
    expect(
      (await request(app.server).post(url(w.job.id, "cancel")).set("Authorization", auth).send({ expectedVersion: 1, idempotencyKey: "cancel-key-x001", reason: "x" })).status
    ).toBe(404);
    expect(
      (await request(app.server).post(url(w.job.id, "exceptions")).set("Authorization", auth).send({ expectedVersion: 1, idempotencyKey: "exc-key-x0001", kind: "other", note: "x" })).status
    ).toBe(404);
    const own = await request(app.server).get(url(w.otherJob.id, "schedule")).set("Authorization", w.as(w.owner));
    expect(own.status).toBe(404);
    expect(w.job.scheduledStart?.toISOString()).toBe(at(BASE).toISOString());
  });

  it("denies technicians (403) and unauthenticated callers (401)", async () => {
    const w = seedWorld();
    expect((await request(app.server).get(url(w.job.id, "schedule")).set("Authorization", w.as(w.technicianUser))).status).toBe(403);
    expect((await request(app.server).post(url(w.job.id, "reschedule")).set("Authorization", w.as(w.technicianUser)).send(move())).status).toBe(403);
    expect((await request(app.server).post(url(w.job.id, "reschedule")).send(move())).status).toBe(401);
  });
});
