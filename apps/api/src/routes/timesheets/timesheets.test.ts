/**
 * FS-171 — timesheets & payroll API route tests.
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

// Week of Mon 2026-10-19 .. Sun 2026-10-25 (America/Chicago, UTC-5). 14:00Z = 09:00 local.
const at = (date: string, hourUtc: number) => new Date(`${date}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "TS Co", slug: "ts-co" });
  const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
  const owner = fakeDb.seedUser({ companyId: company.id, email: "owner@ts.test", firstName: "O", lastName: "W", role: "owner" });
  const dispatcher = fakeDb.seedUser({ companyId: company.id, email: "disp@ts.test", firstName: "D", lastName: "S", role: "dispatcher" });
  const techUser = fakeDb.seedUser({ companyId: company.id, email: "tech@ts.test", firstName: "T", lastName: "E", role: "technician" });
  const tech = fakeDb.seedTechnician({ companyId: company.id, userId: techUser.id, firstName: "Tess", lastName: "Tech", phone: "+15555550101" });
  const peerUser = fakeDb.seedUser({ companyId: company.id, email: "peer@ts.test", firstName: "P", lastName: "E", role: "technician" });
  const peer = fakeDb.seedTechnician({ companyId: company.id, userId: peerUser.id, firstName: "Pete", lastName: "Peer", phone: "+15555550102" });
  const otherOwner = fakeDb.seedUser({ companyId: other.id, email: "owner@other.test", firstName: "X", lastName: "Y", role: "owner" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Pat", lastName: "C", leadSource: "web" });
  const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: tech.id, status: "in_progress", title: "Job" });
  return {
    company, other, owner, tech, peer, job,
    ownerAuth: bearer(company.id, owner.id, "owner"),
    dispatcherAuth: bearer(company.id, dispatcher.id, "dispatcher"),
    techAuth: bearer(company.id, techUser.id, "technician"),
    peerAuth: bearer(company.id, peerUser.id, "technician"),
    otherOwnerAuth: bearer(other.id, otherOwner.id, "owner")
  };
}

function seedWeek(w: ReturnType<typeof seedWorld>, technicianId: string, hoursPerDay: number) {
  return ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((date) =>
    fakeDb.seedTimeEntry({
      companyId: w.company.id, jobId: w.job.id, technicianId,
      startedAt: at(date, 14), endedAt: new Date(at(date, 14).getTime() + hoursPerDay * 3_600_000),
      durationMinutes: hoursPerDay * 60, entryType: "on_site"
    })
  );
}

describe("FS-171 time entries", () => {
  it("401 without auth; 400 on invalid body", async () => {
    const w = seedWorld();
    await request(app.server).post("/api/v1/time/clock-in").send({ jobId: w.job.id }).expect(401);
    await request(app.server).post("/api/v1/time/clock-in").set("authorization", w.techAuth).send({ jobId: "nope" }).expect(400);
    await request(app.server).post("/api/v1/time/entries").set("authorization", w.techAuth)
      .send({ jobId: w.job.id, startedAt: "2026-10-19T15:00:00Z", endedAt: "2026-10-19T14:00:00Z" }).expect(400);
  });

  it("technician clocks in/out; second clock-in is 409 open_entry_exists; audit recorded", async () => {
    const w = seedWorld();
    const inRes = await request(app.server).post("/api/v1/time/clock-in").set("authorization", w.techAuth).send({ jobId: w.job.id }).expect(201);
    expect(inRes.body.entry).toMatchObject({ technicianId: w.tech.id, endedAt: null, locked: false });
    expect(inRes.body.entry.recordVersion).toContain(":time_entry:");
    const again = await request(app.server).post("/api/v1/time/clock-in").set("authorization", w.techAuth).send({ jobId: w.job.id }).expect(409);
    expect(again.body).toMatchObject({ error: "CONFLICT", reason: "open_entry_exists" });
    const outRes = await request(app.server).post("/api/v1/time/clock-out").set("authorization", w.techAuth)
      .send({ recordVersion: inRes.body.entry.recordVersion }).expect(200);
    expect(outRes.body.entry.endedAt).not.toBeNull();
    await request(app.server).post("/api/v1/time/clock-out").set("authorization", w.techAuth).send({}).expect(409);
    expect(fakeDb.getTimesheetAuditEvents().map((e) => e.action)).toEqual(["time_entry.clock_in", "time_entry.clock_out"]);
  });

  it("rejects overlapping manual entries", async () => {
    const w = seedWorld();
    seedWeek(w, w.tech.id, 8);
    const res = await request(app.server).post("/api/v1/time/entries").set("authorization", w.techAuth)
      .send({ jobId: w.job.id, startedAt: "2026-10-19T20:00:00Z", endedAt: "2026-10-19T23:00:00Z" }).expect(409);
    expect(res.body.reason).toBe("overlapping_entry");
    await request(app.server).post("/api/v1/time/entries").set("authorization", w.techAuth)
      .send({ jobId: w.job.id, startedAt: "2026-10-19T22:00:00Z", endedAt: "2026-10-19T23:00:00Z" }).expect(201);
  });

  it("technician cannot see or edit another technician's entries", async () => {
    const w = seedWorld();
    const [peerEntry] = seedWeek(w, w.peer.id, 8);
    await request(app.server).get(`/api/v1/time/entries?technicianId=${w.peer.id}`).set("authorization", w.techAuth).expect(403);
    const own = await request(app.server).get("/api/v1/time/entries").set("authorization", w.techAuth).expect(200);
    expect(own.body.entries).toHaveLength(0);
    await request(app.server).patch(`/api/v1/time/entries/${peerEntry!.id}`).set("authorization", w.techAuth).send({ notes: "x" }).expect(404);
    await request(app.server).post("/api/v1/time/entries").set("authorization", w.techAuth)
      .send({ jobId: w.job.id, technicianId: w.peer.id, startedAt: "2026-10-24T14:00:00Z", endedAt: "2026-10-24T15:00:00Z" }).expect(403);
    const managerView = await request(app.server).get(`/api/v1/time/entries?technicianId=${w.peer.id}&from=2026-10-19&to=2026-10-20`)
      .set("authorization", w.dispatcherAuth).expect(200);
    expect(managerView.body.entries).toHaveLength(2);
  });

  it("cross-tenant entry is 404; stale recordVersion is 409 with current", async () => {
    const w = seedWorld();
    const [entry] = seedWeek(w, w.tech.id, 8);
    await request(app.server).patch(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.otherOwnerAuth).send({ notes: "x" }).expect(404);
    const stale = await request(app.server).patch(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.techAuth)
      .send({ notes: "x", recordVersion: `rv1:time_entry:${entry!.id}:2020-01-01T00:00:00.000Z` }).expect(409);
    expect(stale.body).toMatchObject({ error: "CONFLICT", reason: "stale_record_version" });
    expect(stale.body.current.id).toBe(entry!.id);
    const ok = await request(app.server).patch(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.techAuth)
      .send({ notes: "fixed", recordVersion: stale.body.current.recordVersion }).expect(200);
    expect(ok.body.entry.notes).toBe("fixed");
  });
});

describe("FS-171 timesheets", () => {
  it("submit -> approve locks entries; owner/admin reopen with reason unlocks; audit trail", async () => {
    const w = seedWorld();
    const [entry] = seedWeek(w, w.tech.id, 8);
    const created = await request(app.server).post("/api/v1/timesheets").set("authorization", w.techAuth)
      .send({ periodStart: "2026-10-19", periodEnd: "2026-10-25" }).expect(201);
    const id = created.body.timesheet.id as string;
    await request(app.server).post("/api/v1/timesheets").set("authorization", w.techAuth)
      .send({ periodStart: "2026-10-25", periodEnd: "2026-10-31" }).expect(409);

    await request(app.server).post(`/api/v1/timesheets/${id}/approve`).set("authorization", w.techAuth).send({}).expect(403);
    await request(app.server).post(`/api/v1/timesheets/${id}/approve`).set("authorization", w.dispatcherAuth).send({}).expect(409);
    const submitted = await request(app.server).post(`/api/v1/timesheets/${id}/submit`).set("authorization", w.techAuth)
      .send({ recordVersion: created.body.timesheet.recordVersion }).expect(200);
    expect(submitted.body.timesheet.status).toBe("submitted");
    // Technician can no longer edit a submitted period.
    const techEdit = await request(app.server).patch(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.techAuth).send({ notes: "x" }).expect(409);
    expect(techEdit.body.reason).toBe("timesheet_submitted");

    await request(app.server).post(`/api/v1/timesheets/${id}/approve`).set("authorization", w.dispatcherAuth)
      .send({ recordVersion: created.body.timesheet.recordVersion }).expect(409);
    const approved = await request(app.server).post(`/api/v1/timesheets/${id}/approve`).set("authorization", w.dispatcherAuth).send({}).expect(200);
    expect(approved.body.timesheet.status).toBe("approved");

    const detail = await request(app.server).get(`/api/v1/timesheets/${id}`).set("authorization", w.techAuth).expect(200);
    expect(detail.body.totals).toMatchObject({ workedMinutes: 2400, regularMinutes: 2400, overtimeMinutes: 0, entryCount: 5 });
    expect(detail.body.entries.every((e: { locked: boolean }) => e.locked)).toBe(true);

    // Locked for everyone, including owner, on both new and legacy edit routes.
    const ownerEdit = await request(app.server).patch(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.ownerAuth).send({ notes: "x" }).expect(409);
    expect(ownerEdit.body.reason).toBe("timesheet_locked");
    await request(app.server).patch(`/api/v1/time/${entry!.id}`).set("authorization", w.ownerAuth).send({ notes: "x" }).expect(409);
    await request(app.server).delete(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.ownerAuth).send({}).expect(409);
    await request(app.server).post("/api/v1/time/entries").set("authorization", w.ownerAuth)
      .send({ jobId: w.job.id, technicianId: w.tech.id, startedAt: "2026-10-24T14:00:00Z", endedAt: "2026-10-24T15:00:00Z" }).expect(409);

    await request(app.server).post(`/api/v1/timesheets/${id}/reopen`).set("authorization", w.dispatcherAuth).send({ reason: "fix" }).expect(403);
    await request(app.server).post(`/api/v1/timesheets/${id}/reopen`).set("authorization", w.ownerAuth).send({}).expect(400);
    const reopened = await request(app.server).post(`/api/v1/timesheets/${id}/reopen`).set("authorization", w.ownerAuth)
      .send({ reason: "Missed a lunch break" }).expect(200);
    expect(reopened.body.timesheet).toMatchObject({ status: "open", approvedAt: null });
    await request(app.server).patch(`/api/v1/time/entries/${entry!.id}`).set("authorization", w.ownerAuth).send({ notes: "corrected" }).expect(200);

    const audit = await request(app.server).get(`/api/v1/timesheets/${id}/audit`).set("authorization", w.ownerAuth).expect(200);
    expect(audit.body.events.map((e: { action: string }) => e.action)).toEqual([
      "timesheet.created", "timesheet.submitted", "timesheet.approved", "timesheet.reopened"
    ]);
    expect(audit.body.events[3].reason).toBe("Missed a lunch break");
    await request(app.server).get(`/api/v1/timesheets/${id}/audit`).set("authorization", w.techAuth).expect(403);
  });

  it("reject requires reason; submit blocked by open entries; peers and other tenants get 404", async () => {
    const w = seedWorld();
    fakeDb.seedTimeEntry({ companyId: w.company.id, jobId: w.job.id, technicianId: w.tech.id, startedAt: at("2026-10-20", 14) });
    const sheet = fakeDb.seedTimesheet({ companyId: w.company.id, technicianId: w.tech.id, periodStart: "2026-10-19", periodEnd: "2026-10-25" });
    const open = await request(app.server).post(`/api/v1/timesheets/${sheet.id}/submit`).set("authorization", w.techAuth).send({}).expect(409);
    expect(open.body.reason).toBe("open_entries");
    await request(app.server).get(`/api/v1/timesheets/${sheet.id}`).set("authorization", w.peerAuth).expect(404);
    await request(app.server).get(`/api/v1/timesheets/${sheet.id}`).set("authorization", w.otherOwnerAuth).expect(404);
    const submitted = fakeDb.seedTimesheet({ companyId: w.company.id, technicianId: w.peer.id, periodStart: "2026-10-19", periodEnd: "2026-10-25", status: "submitted" });
    await request(app.server).post(`/api/v1/timesheets/${submitted.id}/reject`).set("authorization", w.dispatcherAuth).send({}).expect(400);
    const rejected = await request(app.server).post(`/api/v1/timesheets/${submitted.id}/reject`).set("authorization", w.dispatcherAuth)
      .send({ reason: "Missing Friday" }).expect(200);
    expect(rejected.body.timesheet).toMatchObject({ status: "rejected", rejectionReason: "Missing Friday" });
    const list = await request(app.server).get("/api/v1/timesheets").set("authorization", w.peerAuth).expect(200);
    expect(list.body.timesheets.map((t: { id: string }) => t.id)).toEqual([submitted.id]);
  });
});

describe("FS-171 payroll", () => {
  it("pay rates and payroll are owner/admin only", async () => {
    const w = seedWorld();
    await request(app.server).get("/api/v1/payroll/pay-rates").set("authorization", w.dispatcherAuth).expect(403);
    await request(app.server).get("/api/v1/payroll/summary?periodStart=2026-10-19&periodEnd=2026-10-25").set("authorization", w.techAuth).expect(403);
    await request(app.server).get("/api/v1/payroll/export?periodStart=2026-10-19&periodEnd=2026-10-25").expect(401);
    await request(app.server).get("/api/v1/payroll/summary?periodStart=2026-10-25&periodEnd=2026-10-19").set("authorization", w.ownerAuth).expect(400);
    await request(app.server).post("/api/v1/payroll/pay-rates").set("authorization", w.ownerAuth)
      .send({ technicianId: w.tech.id, hourlyRateCents: 25.5, effectiveFrom: "2026-10-01" }).expect(400);
    await request(app.server).post("/api/v1/payroll/pay-rates").set("authorization", w.otherOwnerAuth)
      .send({ technicianId: w.tech.id, hourlyRateCents: 2000, effectiveFrom: "2026-10-01" }).expect(404);
    const rate = await request(app.server).post("/api/v1/payroll/pay-rates").set("authorization", w.ownerAuth)
      .send({ technicianId: w.tech.id, hourlyRateCents: 2000, effectiveFrom: "2026-10-01" }).expect(201);
    expect(rate.body.payRate.recordVersion).toContain(":technician_pay_rate:");
    const dup = await request(app.server).post("/api/v1/payroll/pay-rates").set("authorization", w.ownerAuth)
      .send({ technicianId: w.tech.id, hourlyRateCents: 2100, effectiveFrom: "2026-10-01" }).expect(409);
    expect(dup.body.reason).toBe("duplicate_effective_date");
  });

  it("summarizes approved hours only, with weekly overtime, in cents; CSV + JSON export", async () => {
    const w = seedWorld();
    seedWeek(w, w.tech.id, 9); // 45h -> 40 reg + 5 OT
    seedWeek(w, w.peer.id, 8); // not approved -> excluded
    fakeDb.seedTimeEntry({
      companyId: w.company.id, jobId: w.job.id, technicianId: w.tech.id, startedAt: at("2026-10-24", 14),
      endedAt: at("2026-10-24", 15), durationMinutes: 60, entryType: "break"
    }); // unpaid break
    fakeDb.seedTechnicianPayRate({ companyId: w.company.id, technicianId: w.tech.id, hourlyRateCents: 2000, effectiveFrom: "2026-10-01" });
    fakeDb.seedTimesheet({ companyId: w.company.id, technicianId: w.tech.id, periodStart: "2026-10-19", periodEnd: "2026-10-25", status: "approved" });
    fakeDb.seedTimesheet({ companyId: w.company.id, technicianId: w.peer.id, periodStart: "2026-10-19", periodEnd: "2026-10-25", status: "submitted" });

    const res = await request(app.server).get("/api/v1/payroll/summary?periodStart=2026-10-19&periodEnd=2026-10-25")
      .set("authorization", w.ownerAuth).expect(200);
    expect(res.body.summary.lines).toHaveLength(1);
    expect(res.body.summary.lines[0]).toMatchObject({
      technicianId: w.tech.id, regularMinutes: 2400, overtimeMinutes: 300, totalMinutes: 2700,
      hourlyRateCents: 2000, regularPayCents: 80000, overtimePayCents: 15000, grossPayCents: 95000, missingPayRate: false
    });
    expect(res.body.summary).toMatchObject({ weeklyOvertimeThresholdMinutes: 2400, overtimeMultiplierBps: 15000, timezone: "America/Chicago" });

    const custom = await request(app.server)
      .get("/api/v1/payroll/summary?periodStart=2026-10-19&periodEnd=2026-10-25&weeklyOvertimeThresholdMinutes=2700")
      .set("authorization", w.ownerAuth).expect(200);
    expect(custom.body.summary.lines[0].overtimeMinutes).toBe(0);

    const csv = await request(app.server).get("/api/v1/payroll/export?periodStart=2026-10-19&periodEnd=2026-10-25")
      .set("authorization", w.ownerAuth).expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("Tess Tech,40.00,5.00,45.00,2400,300,20.00,800.00,150.00,950.00,false");
    const json = await request(app.server).get("/api/v1/payroll/export?periodStart=2026-10-19&periodEnd=2026-10-25&format=json")
      .set("authorization", w.ownerAuth).expect(200);
    expect(json.body.summary.totals.grossPayCents).toBe(95000);
  });
});

describe("FS-171 review fixes", () => {
  it("concurrent clock-ins: one 201, one 409 open_entry_exists, only one open entry", async () => {
    const w = seedWorld();
    const results = await Promise.all([0, 1].map(() =>
      request(app.server).post("/api/v1/time/clock-in").set("authorization", w.techAuth).send({ jobId: w.job.id })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const clash = results.find((r) => r.status === 409)!;
    expect(clash.body).toMatchObject({ error: "CONFLICT", reason: "open_entry_exists" });
    const open = fakeDb.getTimeEntries().filter((e) => e.technicianId === w.tech.id && e.endedAt === null && e.deletedAt === null);
    expect(open).toHaveLength(1);
  });

  it("unique violation on the open-entry index maps to 409 even when the pre-check misses", async () => {
    const w = seedWorld();
    const service = await import("../../services/timesheets.service.js");
    // Simulate the race: the other clock-in commits between our pre-check and our insert.
    const db = (await import("@fsm/db")).db as unknown as { insert: (...args: unknown[]) => unknown };
    const realInsert = db.insert.bind(db);
    const spy = vi.spyOn(db, "insert").mockImplementationOnce((...args: unknown[]) => {
      fakeDb.seedTimeEntry({ companyId: w.company.id, jobId: w.job.id, technicianId: w.tech.id, startedAt: new Date(), endedAt: null });
      return realInsert(...args);
    });
    const res = await request(app.server).post("/api/v1/time/clock-in").set("authorization", w.techAuth).send({ jobId: w.job.id }).expect(409);
    expect(res.body).toMatchObject({ error: "CONFLICT", reason: "open_entry_exists", message: "Technician is already clocked in" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    // The fake transaction rollback also discards the simulated concurrent row; what matters is that
    // our insert was rejected and no second open entry exists.
    expect(fakeDb.getTimeEntries().filter((e) => e.technicianId === w.tech.id && e.endedAt === null).length).toBeLessThanOrEqual(1);
    expect(service.isOpenEntryUniqueViolation({ code: "23505", constraint: "time_entries_open_technician_idx" })).toBe(true);
    expect(service.isOpenEntryUniqueViolation({ cause: { code: "23505", constraint: "time_entries_open_technician_idx" } })).toBe(true);
    expect(service.isOpenEntryUniqueViolation({ code: "23505", constraint: "other_idx" })).toBe(false);
  });

  it("time entries list is paginated (default 50, max 200) with SQL-side filters", async () => {
    const w = seedWorld();
    seedWeek(w, w.tech.id, 8);
    seedWeek(w, w.peer.id, 8);
    const all = await request(app.server).get("/api/v1/time/entries").set("authorization", w.ownerAuth).expect(200);
    expect(all.body).toMatchObject({ limit: 50, offset: 0, hasMore: false });
    expect(all.body.entries).toHaveLength(10);
    const p1 = await request(app.server).get(`/api/v1/time/entries?technicianId=${w.tech.id}&limit=2`).set("authorization", w.ownerAuth).expect(200);
    expect(p1.body).toMatchObject({ limit: 2, offset: 0, hasMore: true });
    expect(p1.body.entries.map((e: { workDate: string }) => e.workDate)).toEqual(["2026-10-23", "2026-10-22"]);
    const p3 = await request(app.server).get(`/api/v1/time/entries?technicianId=${w.tech.id}&limit=2&offset=4`).set("authorization", w.ownerAuth).expect(200);
    expect(p3.body).toMatchObject({ limit: 2, offset: 4, hasMore: false });
    expect(p3.body.entries.map((e: { workDate: string }) => e.workDate)).toEqual(["2026-10-19"]);
    const ranged = await request(app.server).get("/api/v1/time/entries?from=2026-10-20&to=2026-10-21").set("authorization", w.ownerAuth).expect(200);
    expect(ranged.body.entries).toHaveLength(4);
    await request(app.server).get("/api/v1/time/entries?limit=201").set("authorization", w.ownerAuth).expect(400);
    await request(app.server).get("/api/v1/time/entries?limit=0").set("authorization", w.ownerAuth).expect(400);
    await request(app.server).get("/api/v1/time/entries?offset=-1").set("authorization", w.ownerAuth).expect(400);
    const max = await request(app.server).get("/api/v1/time/entries?limit=200").set("authorization", w.ownerAuth).expect(200);
    expect(max.body.limit).toBe(200);
  });

  it("timesheets list is paginated with status/date filters", async () => {
    const w = seedWorld();
    for (const start of ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]) {
      const end = new Date(`${start}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      await request(app.server).post("/api/v1/timesheets").set("authorization", w.techAuth)
        .send({ periodStart: start, periodEnd: end.toISOString().slice(0, 10) }).expect(201);
    }
    const p1 = await request(app.server).get("/api/v1/timesheets?limit=3").set("authorization", w.ownerAuth).expect(200);
    expect(p1.body).toMatchObject({ limit: 3, offset: 0, hasMore: true });
    expect(p1.body.timesheets.map((t: { periodStart: string }) => t.periodStart)).toEqual(["2026-10-19", "2026-10-12", "2026-10-05"]);
    const p2 = await request(app.server).get("/api/v1/timesheets?limit=3&offset=3").set("authorization", w.ownerAuth).expect(200);
    expect(p2.body).toMatchObject({ hasMore: false });
    expect(p2.body.timesheets).toHaveLength(1);
    const ranged = await request(app.server).get("/api/v1/timesheets?from=2026-10-12&to=2026-10-14&status=open").set("authorization", w.ownerAuth).expect(200);
    expect(ranged.body.timesheets.map((t: { periodStart: string }) => t.periodStart)).toEqual(["2026-10-12"]);
    await request(app.server).get("/api/v1/timesheets?limit=500").set("authorization", w.ownerAuth).expect(400);
  });
});
