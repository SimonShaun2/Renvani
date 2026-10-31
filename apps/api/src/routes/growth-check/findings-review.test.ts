/**
 * FS-56 — Growth Check findings review, correction and audit history route tests.
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
  const company = fakeDb.seedCompany({ name: "Northside Heating & Air", slug: "northside-hvac" });
  const other = fakeDb.seedCompany({ name: "Other Plumbing", slug: "other-plumbing" });
  const owner = fakeDb.seedUser({ companyId: company.id, email: "owner@northside.test", firstName: "O", lastName: "W", role: "owner" });
  const admin = fakeDb.seedUser({ companyId: company.id, email: "admin@northside.test", firstName: "A", lastName: "D", role: "admin" });
  const dispatcher = fakeDb.seedUser({ companyId: company.id, email: "disp@northside.test", firstName: "D", lastName: "S", role: "dispatcher" });
  const technician = fakeDb.seedUser({ companyId: company.id, email: "tech@northside.test", firstName: "T", lastName: "E", role: "technician" });
  const otherOwner = fakeDb.seedUser({ companyId: other.id, email: "owner@other.test", firstName: "X", lastName: "Y", role: "owner" });
  const scan = fakeDb.seedGrowthCheckScan({
    companyId: company.id,
    requestedByUserId: owner.id,
    targetUrl: "https://northside-hvac.test/",
    rubricId: "home-services",
    rubricVersion: "1.0.0",
    createdAt: new Date("2026-10-01T15:00:00Z")
  });
  const finding = fakeDb.seedGrowthCheckFinding({
    companyId: company.id,
    scanId: scan.id,
    areaId: "booking_intake",
    checkId: "booking_cta",
    status: "fail",
    confidence: "medium",
    summary: "No visible service request call-to-action on the home page"
  });
  const otherScan = fakeDb.seedGrowthCheckScan({ companyId: other.id, targetUrl: "https://other.test/" });
  const otherFinding = fakeDb.seedGrowthCheckFinding({ companyId: other.id, scanId: otherScan.id });
  return {
    company, other, scan, finding, otherScan, otherFinding,
    owner: bearer(company.id, owner.id, "owner"),
    ownerId: owner.id,
    admin: bearer(company.id, admin.id, "admin"),
    adminId: admin.id,
    dispatcher: bearer(company.id, dispatcher.id, "dispatcher"),
    technician: bearer(company.id, technician.id, "technician"),
    otherOwner: bearer(other.id, otherOwner.id, "owner")
  };
}

const review = (auth: string, findingId: string, body: Record<string, unknown>) =>
  request(app.server).post(`/api/v1/growth-check/findings/${findingId}/reviews`).set("Authorization", auth).send(body);

describe("FS-56 growth check findings review", () => {
  it("gates every review route to owner/admin", async () => {
    const w = seedWorld();
    const paths = [
      ["get", "/api/v1/growth-check/scans"],
      ["get", `/api/v1/growth-check/scans/${w.scan.id}/findings`],
      ["get", `/api/v1/growth-check/findings/${w.finding.id}`],
      ["post", `/api/v1/growth-check/findings/${w.finding.id}/reviews`]
    ] as const;
    for (const [method, path] of paths) {
      expect((await request(app.server)[method](path)).status).toBe(401);
      for (const auth of [w.dispatcher, w.technician]) {
        const res = await request(app.server)[method](path).set("Authorization", auth).send({});
        expect(res.status).toBe(403);
      }
    }
    expect((await request(app.server).get("/api/v1/growth-check/scans").set("Authorization", w.admin)).status).toBe(200);
    expect((await request(app.server).get("/api/v1/growth-check/scans").set("Authorization", w.owner)).status).toBe(200);
  });

  it("lists findings with the machine observation and an unreviewed hypothesis state", async () => {
    const w = seedWorld();
    const res = await request(app.server).get(`/api/v1/growth-check/scans/${w.scan.id}/findings`).set("Authorization", w.admin);
    expect(res.status).toBe(200);
    expect(res.body.rubricId).toBe("home-services");
    expect(res.body.findings).toHaveLength(1);
    const f = res.body.findings[0];
    expect(f.machine).toEqual({ status: "fail", confidence: "medium", summary: w.finding.summary });
    expect(f.current).toMatchObject({ reviewState: "machine", ownerValidation: "not_requested", ownerConfirmedFact: false });
    expect(f.revision).toBe(0);
    expect(f.checkLabel).toEqual(expect.any(String));
  });

  it("isolates tenants: foreign scan/finding ids are 404 and never leak", async () => {
    const w = seedWorld();
    for (const path of [
      `/api/v1/growth-check/scans/${w.otherScan.id}/findings`,
      `/api/v1/growth-check/findings/${w.otherFinding.id}`
    ]) {
      const res = await request(app.server).get(path).set("Authorization", w.owner);
      expect(res.status).toBe(404);
    }
    const write = await review(w.owner, w.otherFinding.id, { action: "dismiss", reason: "Not relevant", expectedRevision: 0, idempotencyKey: "xt-key-0001" });
    expect(write.status).toBe(404);
    expect(fakeDb.getGrowthCheckFindingRevisions()).toHaveLength(0);
    const history = await request(app.server).get("/api/v1/growth-check/scans").set("Authorization", w.otherOwner);
    expect(history.body.scans.map((s: { id: string }) => s.id)).toEqual([w.otherScan.id]);
  });

  it("records a correction with reason, preserves the machine observation and exposes old -> new history", async () => {
    const w = seedWorld();
    const res = await review(w.admin, w.finding.id, {
      action: "edit",
      reason: "Request-service button is in the header",
      status: "pass",
      summary: "Request-service button present in the site header",
      expectedRevision: 0,
      idempotencyKey: "edit-key-0001"
    });
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(res.body.finding.machine.status).toBe("fail");
    expect(res.body.finding.current).toMatchObject({ status: "pass", reviewState: "edited", ownerConfirmedFact: false });
    expect(res.body.revision).toMatchObject({
      revision: 1,
      action: "edit",
      actorUserId: w.adminId,
      reason: "Request-service button is in the header",
      previous: { status: "fail", reviewState: "machine" },
      next: { status: "pass", reviewState: "edited" }
    });
    expect(res.body.revision.changedFields).toEqual(["status", "summary", "reviewState"]);

    const noted = await review(w.admin, w.finding.id, { action: "add_note", note: "Checked on mobile too", expectedRevision: 1, idempotencyKey: "note-key-0001" });
    expect(noted.status).toBe(201);
    const requested = await review(w.admin, w.finding.id, { action: "request_owner_validation", expectedRevision: 2, idempotencyKey: "ask-key-0001" });
    expect(requested.body.finding.current.ownerValidation).toBe("requested");

    const detail = await request(app.server).get(`/api/v1/growth-check/findings/${w.finding.id}`).set("Authorization", w.owner);
    expect(detail.status).toBe(200);
    expect(detail.body.finding.revision).toBe(3);
    expect(detail.body.finding.machine.summary).toBe(w.finding.summary);
    expect(detail.body.history.map((h: { action: string }) => h.action)).toEqual(["request_owner_validation", "add_note", "edit"]);

    const scans = await request(app.server).get("/api/v1/growth-check/scans?limit=5").set("Authorization", w.owner);
    expect(scans.body.scans[0]).toMatchObject({
      id: w.scan.id, findingCount: 1, reviewedFindingCount: 1, revisionCount: 3, ownerValidationRequested: 1, ownerConfirmed: 0
    });
  });

  it("records owner confirm/reject/cannot-answer; only the owner may answer and only confirm makes a fact", async () => {
    const w = seedWorld();
    await review(w.admin, w.finding.id, { action: "request_owner_validation", expectedRevision: 0, idempotencyKey: "ask-key-0002" });
    const adminAnswer = await review(w.admin, w.finding.id, { action: "owner_confirm", expectedRevision: 1, idempotencyKey: "conf-key-0001" });
    expect(adminAnswer.status).toBe(403);

    const cannot = await review(w.owner, w.finding.id, { action: "owner_cannot_answer", expectedRevision: 1, idempotencyKey: "cant-key-0001" });
    expect(cannot.body.finding.current).toMatchObject({ ownerValidation: "cannot_answer", ownerConfirmedFact: false });
    const reject = await review(w.owner, w.finding.id, { action: "owner_reject", note: "We do take online requests", expectedRevision: 2, idempotencyKey: "rej-key-0001" });
    expect(reject.body.finding.current).toMatchObject({ ownerValidation: "rejected", ownerConfirmedFact: false });
    const confirm = await review(w.owner, w.finding.id, { action: "owner_confirm", expectedRevision: 3, idempotencyKey: "conf-key-0002" });
    expect(confirm.body.finding.current).toMatchObject({ ownerValidation: "confirmed", ownerConfirmedFact: true });

    // A later correction drops the fact flag again: no silent promotion of edited content.
    const edit = await review(w.admin, w.finding.id, { action: "edit", reason: "Copy changed", summary: "Updated copy", expectedRevision: 4, idempotencyKey: "edit-key-0002" });
    expect(edit.body.finding.current).toMatchObject({ ownerConfirmedFact: false, ownerValidation: "not_requested" });
  });

  it("returns 409 on a stale expectedRevision and writes nothing", async () => {
    const w = seedWorld();
    await review(w.admin, w.finding.id, { action: "dismiss", reason: "Duplicate of header check", expectedRevision: 0, idempotencyKey: "dis-key-0001" });
    const stale = await review(w.owner, w.finding.id, { action: "mark_not_applicable", reason: "Phone-only intake", expectedRevision: 0, idempotencyKey: "na-key-0001" });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe("CONFLICT");
    expect(fakeDb.getGrowthCheckFindingRevisions()).toHaveLength(1);
  });

  it("replays the same idempotency key + payload and rejects key reuse with a different payload", async () => {
    const w = seedWorld();
    const body = { action: "mark_not_applicable", reason: "Phone-only intake", expectedRevision: 0, idempotencyKey: "na-key-0002" };
    const first = await review(w.admin, w.finding.id, body);
    expect(first.status).toBe(201);
    const again = await review(w.admin, w.finding.id, body);
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.revision.id).toBe(first.body.revision.id);
    expect(fakeDb.getGrowthCheckFindingRevisions()).toHaveLength(1);

    const reused = await review(w.admin, w.finding.id, { ...body, reason: "Different reason" });
    expect(reused.status).toBe(409);
    expect(fakeDb.getGrowthCheckFindingRevisions()).toHaveLength(1);
  });

  it("rejects invalid bodies and params with strict validation", async () => {
    const w = seedWorld();
    const cases: Array<Record<string, unknown>> = [
      { action: "edit", reason: "Missing fields", expectedRevision: 0, idempotencyKey: "bad-key-0001" },
      { action: "dismiss", expectedRevision: 0, idempotencyKey: "bad-key-0002" },
      { action: "dismiss", reason: "ok reason", expectedRevision: -1, idempotencyKey: "bad-key-0003" },
      { action: "dismiss", reason: "ok reason", expectedRevision: 0, idempotencyKey: "short" },
      { action: "dismiss", reason: "ok reason", expectedRevision: 0, idempotencyKey: "bad-key-0004", extra: true },
      { action: "promote_to_fact", expectedRevision: 0, idempotencyKey: "bad-key-0005" },
      { action: "edit", reason: "Bad status", status: "great", expectedRevision: 0, idempotencyKey: "bad-key-0006" }
    ];
    for (const body of cases) {
      const res = await review(w.admin, w.finding.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect((await request(app.server).get("/api/v1/growth-check/findings/not-a-uuid").set("Authorization", w.admin)).status).toBe(400);
    expect((await request(app.server).get("/api/v1/growth-check/scans?limit=500").set("Authorization", w.admin)).status).toBe(400);
    expect((await request(app.server).get("/api/v1/growth-check/scans?foo=1").set("Authorization", w.admin)).status).toBe(400);
    expect(fakeDb.getGrowthCheckFindingRevisions()).toHaveLength(0);
  });
});
