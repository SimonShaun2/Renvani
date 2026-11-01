/**
 * FS-60 recurring series controls: preview -> approve -> execute, stale version, idempotent replay (no duplicate or
 * lost visits), linked-job exceptions, tenant isolation and role gates.
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

const TZ = "America/Chicago";
const DATES = ["2030-01-15", "2030-04-15", "2030-07-15", "2030-10-15"];

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "Sparkle Home Cleaning", slug: "sparkle-home" });
  const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
  const user = (companyId: string, role: string) =>
    fakeDb.seedUser({ companyId, email: `${role}-${companyId.slice(0, 6)}@t.test`, firstName: role, lastName: "U", role: role as never });
  const owner = user(company.id, "owner");
  const dispatcher = user(company.id, "dispatcher");
  const technician = user(company.id, "technician");
  const otherOwner = user(other.id, "owner");
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Ana", lastName: "Ruiz" } as never);
  const state = fakeDb.getTestState();
  const mkSeries = (companyId: string, customerId: string) => {
    const s = {
      id: crypto.randomUUID(),
      companyId,
      customerId,
      propertyId: null,
      maintenancePlanId: null,
      anchorMaintenanceVisitId: null,
      timeZone: TZ,
      frequency: "quarterly",
      anchorLocalDate: DATES[0]!,
      localTime: "09:00",
      status: "active",
      externalSchedulerAuthoritative: false,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
    state.recurringVisitSeries.push(s as never);
    const occ = DATES.map((d, i) => {
      const o = {
        id: crypto.randomUUID(),
        companyId,
        seriesId: s.id,
        occurrenceIndex: i,
        scheduledLocalDate: d,
        scheduledAtUtc: new Date(`${d}T15:00:00.000Z`),
        status: "scheduled",
        overrideScheduledLocalDate: null,
        overrideNotes: null,
        maintenanceVisitId: null,
        jobId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      };
      state.recurringVisitOccurrences.push(o as never);
      return o;
    });
    return { s, occ };
  };
  const main = mkSeries(company.id, customer.id);
  const otherCustomer = fakeDb.seedCustomer({ companyId: other.id, firstName: "O", lastName: "C" } as never);
  const foreign = mkSeries(other.id, otherCustomer.id);
  const as = (u: { id: string; companyId: string; role: string }) => `Bearer ${tokens.generateAccessToken({ userId: u.id, companyId: u.companyId, role: u.role })}`;
  return { company, customer, owner, dispatcher, technician, otherOwner, main, foreign, as, state };
}

const base = (id: string) => `/api/v1/scheduling-agent/recurring-series/${id}`;

async function previewAndExecute(
  w: ReturnType<typeof seedWorld>,
  change: Record<string, unknown>,
  key: string,
  auth = w.as(w.dispatcher)
) {
  const p = await request(app.server).post(`${base(w.main.s.id)}/changes/preview`).set("Authorization", auth).send({ change });
  expect(p.status).toBe(200);
  const body = { expectedVersion: p.body.series.seriesVersion, idempotencyKey: key, previewHash: p.body.previewHash, change };
  const e = await request(app.server).post(`${base(w.main.s.id)}/changes`).set("Authorization", auth).send(body);
  return { p, e, body };
}

describe("FS-60 recurring series controls", () => {
  it("returns the series with occurrences at version 1", async () => {
    const w = seedWorld();
    const res = await request(app.server).get(base(w.main.s.id)).set("Authorization", w.as(w.dispatcher));
    expect(res.status).toBe(200);
    expect(res.body.series).toMatchObject({ status: "active", seriesVersion: 1, frequency: "quarterly" });
    expect(res.body.occurrences).toHaveLength(4);
  });

  it("preview is a dry run; execute applies exactly the preview and replays without duplicates", async () => {
    const w = seedWorld();
    const change = { action: "skip_occurrence", occurrenceId: w.main.occ[1]!.id, reason: "Customer on vacation" };
    const p = await request(app.server).post(`${base(w.main.s.id)}/changes/preview`).set("Authorization", w.as(w.dispatcher)).send({ change });
    expect(p.status).toBe(200);
    expect(p.body.preview.occurrences).toEqual([expect.objectContaining({ occurrenceId: w.main.occ[1]!.id, after: expect.objectContaining({ status: "skipped" }) })]);
    expect(w.main.occ[1]!.status).toBe("scheduled");

    const body = { expectedVersion: 1, idempotencyKey: "skip-key-0001", previewHash: p.body.previewHash, change };
    const e = await request(app.server).post(`${base(w.main.s.id)}/changes`).set("Authorization", w.as(w.dispatcher)).send(body);
    expect(e.status).toBe(200);
    expect(e.body).toMatchObject({ replayed: false, series: { seriesVersion: 2 }, change: { action: "skip_occurrence", version: 2 } });

    const again = await request(app.server).post(`${base(w.main.s.id)}/changes`).set("Authorization", w.as(w.dispatcher)).send(body);
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.change.id).toBe(e.body.change.id);

    const detail = await request(app.server).get(base(w.main.s.id)).set("Authorization", w.as(w.owner));
    expect(detail.body.history).toHaveLength(1);
    expect(detail.body.occurrences).toHaveLength(4);
    expect(detail.body.occurrences.map((o: { status: string }) => o.status)).toEqual(["scheduled", "skipped", "scheduled", "scheduled"]);

    const reused = await request(app.server)
      .post(`${base(w.main.s.id)}/changes`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ ...body, change: { ...change, reason: "other" } });
    expect(reused.status).toBe(409);
    expect(reused.body.fields).toMatchObject({ reason: "idempotency_conflict" });
  });

  it("rejects a stale version and a stale preview", async () => {
    const w = seedWorld();
    const pauseChange = { action: "pause", reason: "Winter break" };
    const p = await request(app.server).post(`${base(w.main.s.id)}/changes/preview`).set("Authorization", w.as(w.dispatcher)).send({ change: pauseChange });
    const { e } = await previewAndExecute(w, { action: "skip_occurrence", occurrenceId: w.main.occ[2]!.id, reason: "x" }, "skip-key-0002");
    expect(e.status).toBe(200);
    const stale = await request(app.server)
      .post(`${base(w.main.s.id)}/changes`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 1, idempotencyKey: "pause-key-0001", previewHash: p.body.previewHash, change: pauseChange });
    expect(stale.status).toBe(409);
    expect(stale.body.fields).toMatchObject({ reason: "stale_version", currentVersion: "2" });
    const badHash = await request(app.server)
      .post(`${base(w.main.s.id)}/changes`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 2, idempotencyKey: "pause-key-0002", previewHash: "a".repeat(64), change: pauseChange });
    expect(badHash.status).toBe(409);
    expect(badHash.body.fields).toMatchObject({ reason: "preview_stale" });
  });

  it("pauses and resumes; resume on an active series is a 409", async () => {
    const w = seedWorld();
    expect((await previewAndExecute(w, { action: "pause", reason: "Winter" }, "pause-key-1000")).e.body.series.status).toBe("paused");
    expect((await previewAndExecute(w, { action: "resume", reason: "Spring" }, "resume-key-100")).e.body.series.status).toBe("active");
    const bad = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ change: { action: "resume", reason: "x" } });
    expect(bad.status).toBe(409);
    expect(bad.body.fields).toMatchObject({ reason: "invalid_status" });
  });

  it("reschedules one visit, blocks a same-date collision and a past date", async () => {
    const w = seedWorld();
    const { e } = await previewAndExecute(w, { action: "reschedule_occurrence", occurrenceId: w.main.occ[1]!.id, localDate: "2030-04-22", reason: "Customer asked" }, "move-key-0001");
    expect(e.status).toBe(200);
    expect(w.main.occ[1]!.overrideScheduledLocalDate).toBe("2030-04-22");
    expect(w.main.occ[1]!.scheduledAtUtc.toISOString()).toBe("2030-04-22T14:00:00.000Z");
    const clash = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ change: { action: "reschedule_occurrence", occurrenceId: w.main.occ[2]!.id, localDate: "2030-10-15", reason: "x" } });
    expect(clash.status).toBe(409);
    expect(clash.body.fields).toMatchObject({ reason: "occurrence_conflict", conflictOccurrenceId: w.main.occ[3]!.id });
    const past = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ change: { action: "reschedule_occurrence", occurrenceId: w.main.occ[2]!.id, localDate: "2020-01-01", reason: "x" } });
    expect(past.status).toBe(400);
  });

  it("moves all future visits to a new time and leaves job-linked visits to a person", async () => {
    const w = seedWorld();
    const jobId = crypto.randomUUID();
    w.main.occ[0]!.jobId = jobId as never;
    const { p, e } = await previewAndExecute(w, { action: "reschedule_future", localTime: "13:30", reason: "Crew starts later" }, "time-key-0001");
    expect(p.body.preview.exceptions).toEqual([expect.objectContaining({ occurrenceId: w.main.occ[0]!.id, reason: "linked_job", escalation: "human" })]);
    expect(e.status).toBe(200);
    expect(e.body.series.localTime).toBe("13:30");
    expect(w.main.occ[0]!.scheduledAtUtc.toISOString()).toBe("2030-01-15T15:00:00.000Z");
    expect(w.main.occ[2]!.scheduledAtUtc.toISOString()).toBe("2030-07-15T18:30:00.000Z");
    const detail = await request(app.server).get(base(w.main.s.id)).set("Authorization", w.as(w.dispatcher));
    expect(detail.body.openExceptions).toEqual([expect.objectContaining({ occurrenceId: w.main.occ[0]!.id, jobId })]);
  });

  it("skip of a job-linked visit is 409 linked_job and lands in the exception queue", async () => {
    const w = seedWorld();
    const jobId = crypto.randomUUID();
    w.main.occ[1]!.jobId = jobId as never;
    const res = await request(app.server)
      .post(`${base(w.main.s.id)}/changes`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ expectedVersion: 1, idempotencyKey: "skip-key-0009", previewHash: "b".repeat(64), change: { action: "skip_occurrence", occurrenceId: w.main.occ[1]!.id, reason: "x" } });
    expect(res.status).toBe(409);
    expect(res.body.fields).toMatchObject({ reason: "linked_job", jobId });
    const detail = await request(app.server).get(base(w.main.s.id)).set("Authorization", w.as(w.dispatcher));
    expect(detail.body.openExceptions).toHaveLength(1);
    expect(detail.body.series.seriesVersion).toBe(1);
    expect(w.main.occ[1]!.status).toBe("scheduled");
  });

  it("ends the series, cancels future unlinked visits, then refuses further changes", async () => {
    const w = seedWorld();
    const { e } = await previewAndExecute(w, { action: "end", reason: "Customer moved" }, "end-key-00001", w.as(w.owner));
    expect(e.status).toBe(200);
    expect(e.body.series.status).toBe("cancelled");
    expect(w.main.occ.every((o) => o.status === "cancelled")).toBe(true);
    const after = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.owner))
      .send({ change: { action: "pause", reason: "x" } });
    expect(after.status).toBe(409);
    expect(after.body.fields).toMatchObject({ reason: "series_ended" });
  });

  it("isolates tenants on every route", async () => {
    const w = seedWorld();
    const auth = w.as(w.otherOwner);
    const change = { action: "pause", reason: "x" };
    expect((await request(app.server).get(base(w.main.s.id)).set("Authorization", auth)).status).toBe(404);
    expect((await request(app.server).post(`${base(w.main.s.id)}/changes/preview`).set("Authorization", auth).send({ change })).status).toBe(404);
    expect(
      (await request(app.server)
        .post(`${base(w.main.s.id)}/changes`)
        .set("Authorization", auth)
        .send({ expectedVersion: 1, idempotencyKey: "xt-key-00001", previewHash: "c".repeat(64), change })).status
    ).toBe(404);
    expect((await request(app.server).get(base(w.foreign.s.id)).set("Authorization", w.as(w.owner))).status).toBe(404);
    // occurrence from another tenant's series can't be targeted through our series
    const foreignOcc = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.owner))
      .send({ change: { action: "skip_occurrence", occurrenceId: w.foreign.occ[1]!.id, reason: "x" } });
    expect(foreignOcc.status).toBe(404);
    expect(w.main.s.status).toBe("active");
  });

  it("denies technicians and anonymous callers, and rejects unknown fields", async () => {
    const w = seedWorld();
    expect((await request(app.server).get(base(w.main.s.id)).set("Authorization", w.as(w.technician))).status).toBe(403);
    expect(
      (await request(app.server).post(`${base(w.main.s.id)}/changes/preview`).set("Authorization", w.as(w.technician)).send({ change: { action: "pause", reason: "x" } })).status
    ).toBe(403);
    expect((await request(app.server).post(`${base(w.main.s.id)}/changes/preview`).send({ change: { action: "pause", reason: "x" } })).status).toBe(401);
    const extra = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ change: { action: "pause", reason: "x", frequency: "monthly" } });
    expect(extra.status).toBe(400);
    const unknownAction = await request(app.server)
      .post(`${base(w.main.s.id)}/changes/preview`)
      .set("Authorization", w.as(w.dispatcher))
      .send({ change: { action: "change_frequency", reason: "x" } });
    expect(unknownAction.status).toBe(400);
  });
});
