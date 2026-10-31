/**
 * FS-200 — call tracking + recording (disabled adapter) route tests.
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

const FAKE_PROVIDER = "fake_tracker";
const FAKE_SECRET_HEADER = "x-fake-signature";
const fakeParse = vi.fn((raw: string) => JSON.parse(raw) as unknown);
const fakeAdapter = {
  id: FAKE_PROVIDER,
  enabled: true,
  verifyWebhookSignature: (input: { headers: Readonly<Record<string, string | undefined>> }) => input.headers[FAKE_SECRET_HEADER] === "valid",
  parseInboundCall: fakeParse
};

async function registry() {
  return import("../../services/growth/call-tracking-adapter.registry.js");
}

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "Lone Star Plumbing", slug: "lone-star-plumbing" });
  const other = fakeDb.seedCompany({ name: "Other Electric", slug: "other-electric" });
  const owner = fakeDb.seedUser({ companyId: company.id, email: "owner@lonestar.test", firstName: "O", lastName: "W", role: "owner" });
  const admin = fakeDb.seedUser({ companyId: company.id, email: "admin@lonestar.test", firstName: "A", lastName: "D", role: "admin" });
  const dispatcher = fakeDb.seedUser({ companyId: company.id, email: "disp@lonestar.test", firstName: "D", lastName: "S", role: "dispatcher" });
  const technician = fakeDb.seedUser({ companyId: company.id, email: "tech@lonestar.test", firstName: "T", lastName: "E", role: "technician" });
  const otherOwner = fakeDb.seedUser({ companyId: other.id, email: "owner@other.test", firstName: "X", lastName: "Y", role: "owner" });
  return {
    company,
    other,
    owner: bearer(company.id, owner.id, "owner"),
    admin: bearer(company.id, admin.id, "admin"),
    dispatcher: bearer(company.id, dispatcher.id, "dispatcher"),
    technician: bearer(company.id, technician.id, "technician"),
    otherOwner: bearer(other.id, otherOwner.id, "owner")
  };
}

const callEvent = (overrides: Record<string, unknown> = {}) => ({
  providerCallId: "CA-0001",
  trackingNumber: "+15125550111",
  callerNumber: "+15125559876",
  startedAt: "2026-10-30T15:00:00.000Z",
  durationSeconds: 184,
  outcome: "answered",
  recordingRef: "rec-abc123",
  recordingDisclosurePlayed: true,
  callerConsent: "granted",
  ...overrides
});

const postWebhook = (provider: string, body: unknown, signature = "valid") =>
  request(app.server)
    .post(`/api/v1/webhooks/call-tracking/${provider}`)
    .set("content-type", "application/json")
    .set(FAKE_SECRET_HEADER, signature)
    .send(JSON.stringify(body));

describe("FS-200 call tracking: disabled by default", () => {
  it("returns disabled default settings and refuses to enable the disabled adapter", async () => {
    const w = seedWorld();
    const res = await request(app.server).get("/api/v1/growth/call-tracking/settings").set("Authorization", w.owner);
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ provider: "disabled", enabled: false, providerReady: false, recordingEnabled: false, version: 0 });
    expect(res.body.settings.availableProviders).toContain("disabled");

    const enable = await request(app.server)
      .put("/api/v1/growth/call-tracking/settings")
      .set("Authorization", w.owner)
      .send({ expectedVersion: 0, enabled: true });
    expect(enable.status).toBe(400);
  });

  it("rejects webhooks for the disabled adapter (503) and unknown providers (404) without parsing or writing", async () => {
    const w = seedWorld();
    fakeDb.seedCallTrackingNumber({ companyId: w.company.id, trackingNumber: "+15125550111" });
    const disabled = await postWebhook("disabled", callEvent());
    expect(disabled.status).toBe(503);
    expect(disabled.body).toEqual({ error: "CALL_TRACKING_DISABLED" });
    const unknown = await postWebhook("nope", callEvent());
    expect(unknown.status).toBe(404);
    const bad = await postWebhook("Bad-Id", callEvent());
    expect(bad.status).toBe(404);
    expect(fakeDb.getTestState().callRecords).toHaveLength(0);
  });
});

describe("FS-200 call tracking settings, numbers and calls", () => {
  beforeEach(async () => {
    (await registry()).registerCallTrackingAdapter(fakeAdapter);
    fakeParse.mockClear();
  });
  afterEach(async () => {
    (await registry()).unregisterCallTrackingAdapter(FAKE_PROVIDER);
  });

  async function enable(w: ReturnType<typeof seedWorld>, extra: Record<string, unknown> = {}) {
    const res = await request(app.server)
      .put("/api/v1/growth/call-tracking/settings")
      .set("Authorization", w.owner)
      .send({ expectedVersion: 0, provider: FAKE_PROVIDER, enabled: true, ...extra });
    expect(res.status).toBe(200);
    const num = await request(app.server)
      .post("/api/v1/growth/call-tracking/numbers")
      .set("Authorization", w.admin)
      .send({ trackingNumber: "+15125550111", label: "Yard signs", marketingSource: "yard signs", marketingCampaign: "fall-hvac-tuneup", forwardingNumber: "+15125550100" });
    expect(num.status).toBe(201);
    return num.body.number as { id: string; version: number };
  }

  it("gates every settings/number/call route to owner/admin", async () => {
    const w = seedWorld();
    const routes = [
      ["get", "/api/v1/growth/call-tracking/settings"],
      ["put", "/api/v1/growth/call-tracking/settings"],
      ["get", "/api/v1/growth/call-tracking/numbers"],
      ["post", "/api/v1/growth/call-tracking/numbers"],
      ["patch", "/api/v1/growth/call-tracking/numbers/00000000-0000-4000-8000-000000000001"],
      ["get", "/api/v1/growth/call-tracking/calls"]
    ] as const;
    for (const [method, path] of routes) {
      expect((await request(app.server)[method](path).send({})).status, `${method} ${path}`).toBe(401);
      for (const auth of [w.dispatcher, w.technician]) {
        expect((await request(app.server)[method](path).set("Authorization", auth).send({})).status, `${method} ${path}`).toBe(403);
      }
    }
    expect((await request(app.server).get("/api/v1/growth/call-tracking/calls").set("Authorization", w.admin)).status).toBe(200);
  });

  it("ingests a signed call via an enabled adapter with masked caller, attribution and recording reference", async () => {
    const w = seedWorld();
    await enable(w, { recordingEnabled: true, recordingNoticeState: "tx" });
    const res = await postWebhook(FAKE_PROVIDER, callEvent());
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: "accepted" });

    const stored = fakeDb.getTestState().callRecords;
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0])).not.toContain("5559876");
    expect(stored[0]!.callerHash).toMatch(/^[0-9a-f]{64}$/);

    const calls = await request(app.server).get("/api/v1/growth/call-tracking/calls").set("Authorization", w.owner);
    expect(calls.status).toBe(200);
    expect(calls.body.calls).toHaveLength(1);
    expect(calls.body.calls[0]).toMatchObject({
      callerMasked: "***9876",
      durationSeconds: 184,
      outcome: "answered",
      provider: FAKE_PROVIDER,
      recordingRef: "rec-abc123",
      recordingDisclosurePlayed: true,
      callerConsent: "granted",
      recordingNoticeState: "TX",
      leadAttribution: { utm_source: "yard signs", utm_medium: "phone", utm_campaign: "fall-hvac-tuneup" }
    });
    expect(JSON.stringify(calls.body)).not.toContain("5559876");
    expect(calls.body.calls[0]).not.toHaveProperty("callerHash");

    const replay = await postWebhook(FAKE_PROVIDER, callEvent());
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ status: "duplicate" });
    expect(fakeDb.getTestState().callRecords).toHaveLength(1);
  });

  it("drops the recording reference when recording is off", async () => {
    const w = seedWorld();
    await enable(w);
    expect((await postWebhook(FAKE_PROVIDER, callEvent())).status).toBe(202);
    expect(fakeDb.getTestState().callRecords[0]).toMatchObject({ recordingRef: null, callerConsent: "not_required" });
  });

  it("rejects bad signatures and invalid payloads; ignores unknown numbers and shops that have not enabled tracking", async () => {
    const w = seedWorld();
    expect((await postWebhook(FAKE_PROVIDER, callEvent(), "forged")).status).toBe(401);
    expect(fakeParse).not.toHaveBeenCalled();

    // Number exists but the shop has not enabled tracking: ignored.
    fakeDb.seedCallTrackingNumber({ companyId: w.company.id, trackingNumber: "+15125550111", provider: FAKE_PROVIDER });
    expect((await postWebhook(FAKE_PROVIDER, callEvent())).body).toEqual({ status: "ignored" });
    expect((await postWebhook(FAKE_PROVIDER, callEvent({ trackingNumber: "+15125550999" }))).body).toEqual({ status: "ignored" });
    expect((await postWebhook(FAKE_PROVIDER, callEvent({ callerNumber: "555-9876" }))).status).toBe(400);
    expect((await postWebhook(FAKE_PROVIDER, callEvent({ extra: "x" }))).status).toBe(400);
    expect((await postWebhook(FAKE_PROVIDER, callEvent({ outcome: "teleported" }))).status).toBe(400);
    expect(fakeDb.getTestState().callRecords).toHaveLength(0);
  });

  it("isolates tenants for numbers and calls", async () => {
    const w = seedWorld();
    const num = await enable(w);
    await postWebhook(FAKE_PROVIDER, callEvent());
    const patch = await request(app.server)
      .patch(`/api/v1/growth/call-tracking/numbers/${num.id}`)
      .set("Authorization", w.otherOwner)
      .send({ expectedVersion: 1, label: "Hijack" });
    expect(patch.status).toBe(404);
    expect((await request(app.server).get("/api/v1/growth/call-tracking/numbers").set("Authorization", w.otherOwner)).body.numbers).toEqual([]);
    expect((await request(app.server).get("/api/v1/growth/call-tracking/calls").set("Authorization", w.otherOwner)).body.calls).toEqual([]);
    const otherSettings = await request(app.server).get("/api/v1/growth/call-tracking/settings").set("Authorization", w.otherOwner);
    expect(otherSettings.body.settings).toMatchObject({ provider: "disabled", enabled: false });
    // A tracking number is globally unique: another shop cannot claim it.
    const dup = await request(app.server)
      .post("/api/v1/growth/call-tracking/numbers")
      .set("Authorization", w.otherOwner)
      .send({ trackingNumber: "+15125550111", label: "Mine", marketingSource: "google", forwardingNumber: "+15125550200" });
    expect(dup.status).toBe(409);
  });

  it("handles version conflicts on settings and numbers", async () => {
    const w = seedWorld();
    const num = await enable(w);
    const staleSettings = await request(app.server)
      .put("/api/v1/growth/call-tracking/settings")
      .set("Authorization", w.admin)
      .send({ expectedVersion: 0, consentMode: "one_party" });
    expect(staleSettings.status).toBe(409);
    const ok = await request(app.server)
      .patch(`/api/v1/growth/call-tracking/numbers/${num.id}`)
      .set("Authorization", w.admin)
      .send({ expectedVersion: 1, active: false, marketingCampaign: null });
    expect(ok.status).toBe(200);
    expect(ok.body.number).toMatchObject({ active: false, marketingCampaign: null, version: 2 });
    const stale = await request(app.server)
      .patch(`/api/v1/growth/call-tracking/numbers/${num.id}`)
      .set("Authorization", w.admin)
      .send({ expectedVersion: 1, label: "Late" });
    expect(stale.status).toBe(409);
    // Inactive numbers no longer accept calls.
    expect((await postWebhook(FAKE_PROVIDER, callEvent())).body).toEqual({ status: "ignored" });
  });

  it("validates settings and number bodies strictly", async () => {
    const w = seedWorld();
    const put = (body: Record<string, unknown>) =>
      request(app.server).put("/api/v1/growth/call-tracking/settings").set("Authorization", w.owner).send(body);
    expect((await put({ expectedVersion: 0, provider: "no_such_provider" })).status).toBe(400);
    expect((await put({ expectedVersion: 0, consentMode: "whatever" })).status).toBe(400);
    expect((await put({ expectedVersion: 0, recordingNoticeState: "Texas" })).status).toBe(400);
    expect((await put({ expectedVersion: 0, extra: true })).status).toBe(400);
    expect((await put({ expectedVersion: 0, provider: FAKE_PROVIDER, recordingEnabled: true })).status).toBe(400);
    expect(
      (await put({ expectedVersion: 0, provider: FAKE_PROVIDER, recordingEnabled: true, recordingDisclosureEnabled: false, recordingNoticeState: "CA" })).status
    ).toBe(400);

    const post = (body: Record<string, unknown>) =>
      request(app.server).post("/api/v1/growth/call-tracking/numbers").set("Authorization", w.owner).send(body);
    const valid = { trackingNumber: "+15125550111", label: "Truck wrap", marketingSource: "truck wrap", forwardingNumber: "+15125550100" };
    expect((await post({ ...valid, trackingNumber: "512-555-0111" })).status).toBe(400);
    expect((await post({ ...valid, marketingSource: "https://evil.test/?a=b" })).status).toBe(400);
    expect((await post({ ...valid, forwardingNumber: valid.trackingNumber })).status).toBe(400);
    expect((await post({ ...valid, callerName: "x" })).status).toBe(400);
    expect((await request(app.server).get("/api/v1/growth/call-tracking/calls?limit=500").set("Authorization", w.owner)).status).toBe(400);
    expect((await request(app.server).patch("/api/v1/growth/call-tracking/numbers/not-a-uuid").set("Authorization", w.owner).send({ expectedVersion: 1 })).status).toBe(400);
  });
});
