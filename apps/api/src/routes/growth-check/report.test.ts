/**
 * FS-57 Growth Check owner report: drafts, versioning, approval, preview, export, shares, disabled delivery.
 */
import { createHash } from "node:crypto";

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

const XSS = `<script>alert("x")</script><img src=x onerror=alert(1)>`;

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "Northside Heating & Air", slug: "northside-hvac" });
  const other = fakeDb.seedCompany({ name: "Other Electric", slug: "other-electric" });
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
  const ctaFail = fakeDb.seedGrowthCheckFinding({
    companyId: company.id, scanId: scan.id, areaId: "booking_intake", checkId: "booking_cta", status: "fail",
    confidence: "medium", summary: "No visible service request call-to-action on the home page"
  });
  const httpsPass = fakeDb.seedGrowthCheckFinding({
    companyId: company.id, scanId: scan.id, areaId: "web_presence", checkId: "homepage_reachable", status: "pass",
    confidence: "high", summary: "Homepage loads over HTTPS"
  });
  const titleFail = fakeDb.seedGrowthCheckFinding({
    companyId: company.id, scanId: scan.id, areaId: "web_presence", checkId: "title_present", status: "fail",
    confidence: "high", summary: "Title does not name the trade or service area"
  });
  const otherScan = fakeDb.seedGrowthCheckScan({ companyId: other.id, targetUrl: "https://other.test/" });
  const otherFinding = fakeDb.seedGrowthCheckFinding({ companyId: other.id, scanId: otherScan.id });
  return {
    company, scan, ctaFail, httpsPass, titleFail, otherScan, otherFinding,
    ownerId: owner.id,
    adminId: admin.id,
    owner: bearer(company.id, owner.id, "owner"),
    admin: bearer(company.id, admin.id, "admin"),
    dispatcher: bearer(company.id, dispatcher.id, "dispatcher"),
    technician: bearer(company.id, technician.id, "technician"),
    otherOwner: bearer(other.id, otherOwner.id, "owner")
  };
}

const api = () => request(app.server);
const base = "/api/v1/growth-check";

async function createDraft(auth: string, scanId: string, key = "create-key-0001", extra: Record<string, unknown> = {}) {
  return api().post(`${base}/scans/${scanId}/report-draft`).set("Authorization", auth).send({ idempotencyKey: key, ...extra });
}
const edit = (auth: string, draftId: string, body: Record<string, unknown>) =>
  api().patch(`${base}/report-drafts/${draftId}`).set("Authorization", auth).send(body);
const approve = (auth: string, draftId: string, expectedVersion: number, key: string) =>
  api().post(`${base}/report-drafts/${draftId}/approve`).set("Authorization", auth).send({ expectedVersion, idempotencyKey: key });
const share = (auth: string, draftId: string, body: Record<string, unknown>) =>
  api().post(`${base}/report-drafts/${draftId}/shares`).set("Authorization", auth).send(body);

describe("FS-57 growth check owner report", () => {
  it("gates every report route to owner/admin (401 unauthenticated, 403 dispatcher/technician)", async () => {
    const w = seedWorld();
    const id = "00000000-0000-4000-8000-000000000001";
    const paths = [
      ["post", `${base}/scans/${w.scan.id}/report-draft`],
      ["get", `${base}/scans/${w.scan.id}/report-draft`],
      ["get", `${base}/report-drafts/${id}`],
      ["patch", `${base}/report-drafts/${id}`],
      ["post", `${base}/report-drafts/${id}/approve`],
      ["get", `${base}/report-drafts/${id}/preview`],
      ["get", `${base}/report-drafts/${id}/export`],
      ["post", `${base}/report-drafts/${id}/shares`],
      ["get", `${base}/report-drafts/${id}/shares`],
      ["post", `${base}/report-shares/${id}/revoke`],
      ["post", `${base}/report-shares/${id}/deliveries`]
    ] as const;
    for (const [method, path] of paths) {
      expect((await api()[method](path)).status).toBe(401);
      for (const auth of [w.dispatcher, w.technician]) {
        const res = await api()[method](path).set("Authorization", auth).send({});
        expect(res.status).toBe(403);
      }
    }
    expect((await createDraft(w.admin, w.scan.id)).status).toBe(201);
  });

  it("creates one draft per scan with trade-neutral defaults, replays the same key and rejects reuse", async () => {
    const w = seedWorld();
    const first = await createDraft(w.owner, w.scan.id, "create-key-0001", { businessName: "Northside Heating & Air", serviceArea: "North Austin" });
    expect(first.status).toBe(201);
    expect(first.body.replayed).toBe(false);
    expect(first.body.draft).toMatchObject({ scanId: w.scan.id, version: 1, approved: false, createdByUserId: w.ownerId });
    expect(first.body.draft.content).toMatchObject({ title: "Growth Check: Northside Heating & Air", opportunities: [], excludedFindingIds: [] });
    expect(first.body.revision).toMatchObject({ action: "create", version: 1, previous: null });

    const replay = await createDraft(w.owner, w.scan.id, "create-key-0001", { businessName: "Northside Heating & Air", serviceArea: "North Austin" });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.draft.id).toBe(first.body.draft.id);

    expect((await createDraft(w.owner, w.scan.id, "create-key-0001", { businessName: "Changed" })).status).toBe(409);
    const dup = await createDraft(w.owner, w.scan.id, "create-key-0002");
    expect(dup.status).toBe(409);
    expect(dup.body.fields).toMatchObject({ reason: "draft_exists", draftId: first.body.draft.id });

    const byScan = await api().get(`${base}/scans/${w.scan.id}/report-draft`).set("Authorization", w.admin);
    expect(byScan.status).toBe(200);
    expect(byScan.body.draft.id).toBe(first.body.draft.id);
    const title = (await createDraft(w.owner, w.scan.id)).body;
    expect(JSON.stringify(title)).not.toMatch(/clean|restaurant/i);
  });

  it("versions edits with expectedVersion, replays, 409s stale/reused keys, and records audit history", async () => {
    const w = seedWorld();
    const draftId = (await createDraft(w.owner, w.scan.id)).body.draft.id as string;
    const body = { expectedVersion: 1, idempotencyKey: "edit-key-0001", intro: "What we found on your public pages", internalNotes: "Owner seemed rushed" };
    const first = await edit(w.admin, draftId, body);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ replayed: false, draft: { version: 2 }, revision: { action: "edit", version: 2, actorUserId: w.adminId } });
    expect(first.body.revision.changedFields.sort()).toEqual(["internalNotes", "intro"]);

    const replay = await edit(w.admin, draftId, body);
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.revision.id).toBe(first.body.revision.id);

    expect((await edit(w.admin, draftId, { ...body, intro: "different" })).status).toBe(409);
    const stale = await edit(w.owner, draftId, { expectedVersion: 1, idempotencyKey: "edit-key-0002", title: "Late" });
    expect(stale.status).toBe(409);
    expect(stale.body.fields).toMatchObject({ reason: "stale_version", currentVersion: "2" });

    const detail = await api().get(`${base}/report-drafts/${draftId}`).set("Authorization", w.owner);
    expect(detail.status).toBe(200);
    expect(detail.body.history.map((r: { version: number; action: string }) => `${r.version}:${r.action}`)).toEqual(["2:edit", "1:create"]);
    expect(detail.body.history[0].previous.intro).toBeNull();
    expect(detail.body.history[0].next.intro).toBe("What we found on your public pages");
  });

  it("validates bodies strictly and keeps opportunity/excluded findings inside the draft's scan", async () => {
    const w = seedWorld();
    const draftId = (await createDraft(w.owner, w.scan.id)).body.draft.id as string;
    const opp = (findingId: string, extra: Record<string, unknown> = {}) => ({ findingId, headline: "h", nextStep: "n", impact: 3, evidence: 2, actionability: 2, ...extra });
    const bad: Array<Record<string, unknown>> = [
      { expectedVersion: 1, idempotencyKey: "edit-key-bad1" },
      { expectedVersion: 1, idempotencyKey: "short", title: "x" },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad2", title: "x", unknown: true },
      { expectedVersion: 0, idempotencyKey: "edit-key-bad3", title: "x" },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad4", opportunities: [opp(w.ctaFail.id, { impact: 4 })] },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad5", opportunities: [opp(w.ctaFail.id), opp(w.ctaFail.id)] },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad6", opportunities: [opp(w.ctaFail.id), opp(w.titleFail.id), opp(w.httpsPass.id), opp(w.otherFinding.id)] },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad7", opportunities: [opp(w.otherFinding.id)] },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad8", excludedFindingIds: [w.otherFinding.id] },
      { expectedVersion: 1, idempotencyKey: "edit-key-bad9", opportunities: [opp(w.ctaFail.id)], excludedFindingIds: [w.ctaFail.id] }
    ];
    for (const b of bad) expect((await edit(w.owner, draftId, b)).status).toBe(400);
    expect((await api().get(`${base}/report-drafts/${draftId}/export?format=pdf`).set("Authorization", w.owner)).status).toBe(400);
    expect((await api().get(`${base}/report-drafts/not-a-uuid`).set("Authorization", w.owner)).status).toBe(400);
    expect((await share(w.owner, draftId, { expectedVersion: 1, idempotencyKey: "share-key-bad1", expiresInDays: 91 })).status).toBe(400);
    expect(fakeDb.getGrowthCheckReportDraftRevisions()).toHaveLength(1);
  });

  it("previews ranked opportunities and strengths with evidence labels, escapes HTML, and never leaks internal notes", async () => {
    const w = seedWorld();
    // FS-56 review note on a finding is internal too.
    await api().post(`${base}/findings/${w.ctaFail.id}/reviews`).set("Authorization", w.owner)
      .send({ action: "add_note", note: "INTERNAL-REVIEW-NOTE", expectedRevision: 0, idempotencyKey: "review-key-0001" });
    const draftId = (await createDraft(w.owner, w.scan.id, "create-key-0001", { businessName: XSS, serviceArea: "North Austin" })).body.draft.id as string;
    const edited = await edit(w.owner, draftId, {
      expectedVersion: 1,
      idempotencyKey: "edit-key-0001",
      intro: `Hello ${XSS}`,
      internalNotes: "INTERNAL-DRAFT-NOTE",
      opportunities: [
        { findingId: w.titleFail.id, headline: "Name your trade in the page title", nextStep: "Add \"HVAC repair in North Austin\" to the title", impact: 1, evidence: 3, actionability: 1 },
        { findingId: w.ctaFail.id, headline: `Add a request-service button ${XSS}`, nextStep: "Put a Request service button above the fold", impact: 3, evidence: 2, actionability: 3 }
      ]
    });
    expect(edited.status).toBe(200);
    const res = await api().get(`${base}/report-drafts/${draftId}/preview`).set("Authorization", w.admin);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ draftId, version: 2, approved: false });
    expect(res.body.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const { report } = res.body;
    expect(report.opportunities.map((o: { findingId: string; rank: number }) => [o.rank, o.findingId])).toEqual([[1, w.ctaFail.id], [2, w.titleFail.id]]);
    expect(report.opportunities[0].score.total).toBe(8);
    expect(report.opportunities[0].evidenceLabel).toBe("needs_confirmation");
    expect(report.opportunities[1].evidenceLabel).toBe("observed");
    expect(report.whatsWorking.map((i: { findingId: string }) => i.findingId)).toEqual([w.httpsPass.id]);
    expect(report.business).toMatchObject({ serviceArea: "North Austin", website: "https://northside-hvac.test/" });
    expect(res.body.html).not.toContain("<script");
    expect(res.body.html).not.toContain("<img");
    expect(res.body.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    const all = JSON.stringify(res.body);
    expect(all).not.toContain("INTERNAL-DRAFT-NOTE");
    expect(all).not.toContain("INTERNAL-REVIEW-NOTE");
    expect(res.body.text).toContain("1. Add a request-service button");
  });

  it("excludes dismissed and explicitly excluded findings from the report", async () => {
    const w = seedWorld();
    await api().post(`${base}/findings/${w.titleFail.id}/reviews`).set("Authorization", w.owner)
      .send({ action: "dismiss", reason: "Not useful", expectedRevision: 0, idempotencyKey: "review-key-0002" });
    const draftId = (await createDraft(w.owner, w.scan.id)).body.draft.id as string;
    await edit(w.owner, draftId, { expectedVersion: 1, idempotencyKey: "edit-key-0001", excludedFindingIds: [w.httpsPass.id] });
    const res = await api().get(`${base}/report-drafts/${draftId}/preview`).set("Authorization", w.owner);
    const ids = JSON.stringify(res.body.report);
    expect(ids).not.toContain(w.titleFail.id);
    expect(ids).not.toContain(w.httpsPass.id);
  });

  it("requires approval of the current version for export; approval is logged and later edits revoke it", async () => {
    const w = seedWorld();
    const draftId = (await createDraft(w.owner, w.scan.id, "create-key-0001", { businessName: "Northside Heating & Air" })).body.draft.id as string;
    await edit(w.owner, draftId, {
      expectedVersion: 1, idempotencyKey: "edit-key-0001", internalNotes: "INTERNAL-DRAFT-NOTE",
      opportunities: [{ findingId: w.ctaFail.id, headline: "Add a [request](javascript:x) button", nextStep: "Above the fold", impact: 3, evidence: 2, actionability: 3 }]
    });
    const blocked = await api().get(`${base}/report-drafts/${draftId}/export`).set("Authorization", w.owner);
    expect(blocked.status).toBe(409);
    expect(blocked.body.fields).toMatchObject({ reason: "not_approved" });

    const approved = await approve(w.owner, draftId, 2, "approve-key-001");
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ draft: { version: 3, approved: true, approvedVersion: 3, approvedByUserId: w.ownerId }, revision: { action: "approve", version: 3 } });
    expect((await approve(w.owner, draftId, 2, "approve-key-001")).body.replayed).toBe(true);

    const md = await api().get(`${base}/report-drafts/${draftId}/export?format=markdown`).set("Authorization", w.owner);
    expect(md.status).toBe(200);
    expect(md.headers["content-type"]).toContain("text/markdown");
    expect(md.headers["content-disposition"]).toMatch(/^attachment; filename="growth-check-report-[0-9a-f]{8}-v3\.md"$/);
    expect(md.headers["x-report-version"]).toBe("3");
    expect(md.headers["x-report-content-hash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(md.text).toContain("# Growth Check: Northside Heating & Air");
    expect(md.text).toContain("Add a \\[request\\]\\(javascript:x\\) button");
    expect(md.text).not.toContain("INTERNAL-DRAFT-NOTE");

    const html = await api().get(`${base}/report-drafts/${draftId}/export?format=html`).set("Authorization", w.owner);
    expect(html.headers["content-type"]).toContain("text/html");
    expect(html.headers["x-content-type-options"]).toBe("nosniff");
    expect(html.text).toContain("Content-Security-Policy");
    expect(html.text).toContain("Northside Heating &amp; Air");
    const json = await api().get(`${base}/report-drafts/${draftId}/export?format=json`).set("Authorization", w.owner);
    expect(JSON.parse(json.text)).toMatchObject({ version: 3, contentHash: md.headers["x-report-content-hash"] });
    const text = await api().get(`${base}/report-drafts/${draftId}/export?format=text`).set("Authorization", w.owner);
    expect(text.text).toContain("TOP OPPORTUNITIES");

    await edit(w.owner, draftId, { expectedVersion: 3, idempotencyKey: "edit-key-0002", intro: "Updated" });
    expect((await api().get(`${base}/report-drafts/${draftId}/export`).set("Authorization", w.owner)).status).toBe(409);
    const detail = await api().get(`${base}/report-drafts/${draftId}`).set("Authorization", w.owner);
    expect(detail.body.draft.approved).toBe(false);
    expect(detail.body.history.map((r: { action: string }) => r.action)).toEqual(["edit", "approve", "edit", "create"]);
  });

  it("creates share snapshots with a hashed token, replays without the token, expires and revokes idempotently", async () => {
    const w = seedWorld();
    const draftId = (await createDraft(w.owner, w.scan.id)).body.draft.id as string;
    expect((await share(w.owner, draftId, { expectedVersion: 1, idempotencyKey: "share-key-0001" })).body.fields).toMatchObject({ reason: "not_approved" });
    await approve(w.owner, draftId, 1, "approve-key-001");
    expect((await share(w.owner, draftId, { expectedVersion: 1, idempotencyKey: "share-key-0002" })).body.fields).toMatchObject({ reason: "stale_version" });

    const created = await share(w.owner, draftId, { expectedVersion: 2, idempotencyKey: "share-key-0003", expiresInDays: 7 });
    expect(created.status).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    const token = created.body.token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.body.share).toMatchObject({ draftId, draftVersion: 2, status: "active", createdByUserId: w.ownerId, revokedAt: null });
    const expiresIn = Date.parse(created.body.share.expiresAt) - Date.parse(created.body.share.createdAt);
    expect(expiresIn).toBe(7 * 86_400_000);
    const stored = fakeDb.getGrowthCheckReportShares()[0]!;
    expect(stored.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.contentHash).toBe(created.body.share.contentHash);
    expect(stored.snapshot).toMatchObject({ draftVersion: 2 });
    expect(JSON.stringify(created.body.share)).not.toContain(stored.tokenHash);

    const replay = await share(w.owner, draftId, { expectedVersion: 2, idempotencyKey: "share-key-0003", expiresInDays: 7 });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ replayed: true, token: null, share: { id: created.body.share.id } });
    expect((await share(w.owner, draftId, { expectedVersion: 2, idempotencyKey: "share-key-0003", expiresInDays: 8 })).status).toBe(409);

    // Failed transactions restore a cloned snapshot in the fake db, so re-read the stored row before mutating it.
    const live = fakeDb.getGrowthCheckReportShares()[0]!;
    live.expiresAt = new Date(Date.now() - 1000);
    const listed = await api().get(`${base}/report-drafts/${draftId}/shares`).set("Authorization", w.admin);
    expect(listed.body.shares[0].status).toBe("expired");
    live.expiresAt = null;

    const revoked = await api().post(`${base}/report-shares/${live.id}/revoke`).set("Authorization", w.admin).send({});
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ alreadyRevoked: false, share: { status: "revoked", revokedByUserId: w.adminId } });
    expect(revoked.body.share.revokedAt).toEqual(expect.any(String));
    const again = await api().post(`${base}/report-shares/${live.id}/revoke`).set("Authorization", w.owner);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ alreadyRevoked: true, share: { revokedByUserId: w.adminId } });
  });

  it("isolates tenants: another company's scan, draft and share are 404 and nothing is written", async () => {
    const w = seedWorld();
    expect((await createDraft(w.otherOwner, w.scan.id)).status).toBe(404);
    const draftId = (await createDraft(w.owner, w.scan.id)).body.draft.id as string;
    await approve(w.owner, draftId, 1, "approve-key-001");
    const shareId = (await share(w.owner, draftId, { expectedVersion: 2, idempotencyKey: "share-key-0001" })).body.share.id as string;
    for (const [method, path] of [
      ["get", `${base}/scans/${w.scan.id}/report-draft`],
      ["get", `${base}/report-drafts/${draftId}`],
      ["get", `${base}/report-drafts/${draftId}/preview`],
      ["get", `${base}/report-drafts/${draftId}/export`],
      ["get", `${base}/report-drafts/${draftId}/shares`]
    ] as const) {
      expect((await api()[method](path).set("Authorization", w.otherOwner)).status).toBe(404);
    }
    expect((await edit(w.otherOwner, draftId, { expectedVersion: 2, idempotencyKey: "edit-key-xt01", title: "Taken" })).status).toBe(404);
    expect((await approve(w.otherOwner, draftId, 2, "approve-key-xt1")).status).toBe(404);
    expect((await share(w.otherOwner, draftId, { expectedVersion: 2, idempotencyKey: "share-key-xt01" })).status).toBe(404);
    expect((await api().post(`${base}/report-shares/${shareId}/revoke`).set("Authorization", w.otherOwner).send({})).status).toBe(404);
    expect((await api().post(`${base}/report-shares/${shareId}/deliveries`).set("Authorization", w.otherOwner).send({ channel: "email" })).status).toBe(404);
    // Same idempotency key in another tenant is independent.
    const otherDraft = await createDraft(w.otherOwner, w.otherScan.id, "create-key-0001");
    expect(otherDraft.status).toBe(201);
    expect(fakeDb.getGrowthCheckReportDraftRevisions().filter((r) => r.draftId === draftId)).toHaveLength(2);
    expect(fakeDb.getGrowthCheckReportShares()[0]?.revokedAt).toBeNull();
  });

  it("refuses outside delivery through the disabled adapter registry and makes no network call", async () => {
    const w = seedWorld();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const draftId = (await createDraft(w.owner, w.scan.id)).body.draft.id as string;
    await approve(w.owner, draftId, 1, "approve-key-001");
    const shareId = (await share(w.owner, draftId, { expectedVersion: 2, idempotencyKey: "share-key-0001" })).body.share.id as string;
    for (const channel of ["email", "sms", "fax"]) {
      const res = await api().post(`${base}/report-shares/${shareId}/deliveries`).set("Authorization", w.owner).send({ channel });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("POLICY_DENIED");
      expect(res.body.fields).toMatchObject({ reason: "delivery_disabled" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
