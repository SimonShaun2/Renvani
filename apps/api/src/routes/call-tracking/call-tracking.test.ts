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
  const limiter = await import("../../lib/fixed-window-rate-limit.js");
  limiter.setRateLimitRedisClientForTests(null);
  limiter.resetFixedWindowRateLimitStateForTests();
  fakeOwnership = "verified";
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
/** Ownership the fake provider reports; tests flip it to exercise unverified numbers. */
let fakeOwnership = "verified";
const fakeVerifyOwnership = vi.fn(async () => fakeOwnership);
const fakeAdapter = {
  id: FAKE_PROVIDER,
  enabled: true,
  verifyWebhookSignature: (input: { headers: Readonly<Record<string, string | undefined>> }) => input.headers[FAKE_SECRET_HEADER] === "valid",
  parseInboundCall: fakeParse,
  verifyNumberOwnership: fakeVerifyOwnership
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
  occurredAt: new Date().toISOString(),
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

describe("FS-200 security follow-up: ownership, recording gating, rate limits, replay window", () => {
  beforeEach(async () => {
    (await registry()).registerCallTrackingAdapter(fakeAdapter);
    fakeParse.mockClear();
    fakeVerifyOwnership.mockClear();
  });
  afterEach(async () => {
    (await registry()).unregisterCallTrackingAdapter(FAKE_PROVIDER);
    vi.useRealTimers();
  });

  async function enable(w: ReturnType<typeof seedWorld>, extra: Record<string, unknown> = {}) {
    const res = await request(app.server)
      .put("/api/v1/growth/call-tracking/settings")
      .set("Authorization", w.owner)
      .send({ expectedVersion: 0, provider: FAKE_PROVIDER, enabled: true, ...(extra.recordingEnabled ? { recordingNoticeState: "TX" } : {}), ...extra });
    expect(res.status).toBe(200);
    const num = await request(app.server)
      .post("/api/v1/growth/call-tracking/numbers")
      .set("Authorization", w.admin)
      .send({ trackingNumber: "+15125550111", label: "Yard signs", marketingSource: "yard signs", forwardingNumber: "+15125550100" });
    expect(num.status).toBe(201);
    return num.body.number as { id: string; verificationStatus: string; canReceiveCalls: boolean };
  }

  const recorded = () => fakeDb.getTestState().callRecords;

  it("numbers on the disabled adapter are always unverified and cannot receive calls", async () => {
    const w = seedWorld();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const num = await request(app.server)
      .post("/api/v1/growth/call-tracking/numbers")
      .set("Authorization", w.owner)
      .send({ trackingNumber: "+15125550222", label: "Truck", marketingSource: "truck wrap", forwardingNumber: "+15125550100" });
    expect(num.status).toBe(201);
    expect(num.body.number).toMatchObject({ provider: "disabled", verificationStatus: "unverified", canReceiveCalls: false });
    const list = await request(app.server).get("/api/v1/growth/call-tracking/numbers").set("Authorization", w.owner);
    expect(list.body.numbers[0]).toMatchObject({ verificationStatus: "unverified", canReceiveCalls: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reports provider ownership states and fails closed on unknown status or adapter errors", async () => {
    const w = seedWorld();
    const num = await enable(w);
    expect(num).toMatchObject({ verificationStatus: "verified", canReceiveCalls: true });
    const states: Array<[string | (() => never), string, boolean]> = [
      ["pending", "pending", false],
      ["failed", "failed", false],
      ["unverified", "unverified", false],
      ["owned!", "unverified", false],
      [() => { throw new Error("provider down"); }, "unverified", false]
    ];
    for (const [reported, expected, canReceive] of states) {
      if (typeof reported === "function") fakeVerifyOwnership.mockImplementationOnce(async () => reported());
      else fakeOwnership = reported;
      const list = await request(app.server).get("/api/v1/growth/call-tracking/numbers").set("Authorization", w.owner);
      expect(list.body.numbers[0]).toMatchObject({ verificationStatus: expected, canReceiveCalls: canReceive });
    }
  });

  it("ignores calls to numbers that are not ownership-verified and writes nothing", async () => {
    const w = seedWorld();
    await enable(w, { recordingEnabled: true });
    for (const status of ["unverified", "pending", "failed"]) {
      fakeOwnership = status;
      const res = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: `CA-${status}`, occurredAt: new Date().toISOString() }));
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ status: "ignored", reason: "number_unverified" });
    }
    expect(recorded()).toHaveLength(0);
    fakeOwnership = "verified";
    expect((await postWebhook(FAKE_PROVIDER, callEvent({ occurredAt: new Date().toISOString() }))).body).toEqual({ status: "accepted" });
    expect(recorded()).toHaveLength(1);
  });

  it("stores the recording ref only when the disclosure played and consent mode is satisfied, else drops and flags it", async () => {
    const w = seedWorld();
    await enable(w, { recordingEnabled: true });
    const cases: Array<[Record<string, unknown>, boolean]> = [
      [{ recordingDisclosurePlayed: true, callerConsent: "granted" }, true],
      [{ recordingDisclosurePlayed: false, callerConsent: "granted" }, false],
      [{ recordingDisclosurePlayed: undefined, callerConsent: "granted" }, false],
      [{ recordingDisclosurePlayed: true, callerConsent: "unknown" }, false],
      [{ recordingDisclosurePlayed: true, callerConsent: "declined" }, false]
    ];
    let i = 0;
    for (const [overrides, kept] of cases) {
      const id = `CA-rec-${i++}`;
      const res = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: id, occurredAt: new Date().toISOString(), ...overrides }));
      expect(res.status).toBe(202);
      expect(res.body).toEqual(kept ? { status: "accepted" } : { status: "accepted", recordingRefDropped: true });
      const row = recorded().find((r) => r.providerCallId === id)!;
      expect(row.recordingRef).toBe(kept ? "rec-abc123" : null);
    }
    // No ref sent: nothing to drop, no flag.
    const none = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-noref", recordingRef: null, occurredAt: new Date().toISOString() }));
    expect(none.body).toEqual({ status: "accepted" });
    const calls = await request(app.server).get("/api/v1/growth/call-tracking/calls").set("Authorization", w.owner);
    expect(calls.body.calls.filter((c: { recordingRef: string | null }) => c.recordingRef !== null)).toHaveLength(1);
  });

  it("one-party consent accepts a played disclosure with unknown consent but never a declined caller", async () => {
    const w = seedWorld();
    await enable(w, { recordingEnabled: true, consentMode: "one_party" });
    await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-1p-a", callerConsent: "unknown", occurredAt: new Date().toISOString() }));
    await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-1p-b", callerConsent: "declined", occurredAt: new Date().toISOString() }));
    await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-1p-c", recordingDisclosurePlayed: false, occurredAt: new Date().toISOString() }));
    const refs = Object.fromEntries(recorded().map((r) => [r.providerCallId, r.recordingRef]));
    expect(refs).toEqual({ "CA-1p-a": "rec-abc123", "CA-1p-b": null, "CA-1p-c": null });
  });

  it("hides a legacy stored ref on read when disclosure/consent was not satisfied", async () => {
    const w = seedWorld();
    await enable(w, { recordingEnabled: true });
    await postWebhook(FAKE_PROVIDER, callEvent({ occurredAt: new Date().toISOString() }));
    const row = recorded()[0]!;
    row.recordingDisclosurePlayed = false; // simulate a pre-gate row that kept its ref
    const calls = await request(app.server).get("/api/v1/growth/call-tracking/calls").set("Authorization", w.owner);
    expect(calls.body.calls[0].recordingRef).toBeNull();
  });

  it("rejects events outside the ±5 minute replay window but keeps duplicate retries idempotent", async () => {
    const w = seedWorld();
    await enable(w);
    const minute = 60_000;
    const stale = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-stale", occurredAt: new Date(Date.now() - 6 * minute).toISOString() }));
    expect(stale.status).toBe(400);
    expect(stale.body).toEqual({ error: "EVENT_OUTSIDE_REPLAY_WINDOW" });
    const future = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-future", occurredAt: new Date(Date.now() + 6 * minute).toISOString() }));
    expect(future.status).toBe(400);
    const edge = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-edge", occurredAt: new Date(Date.now() - 4 * minute).toISOString() }));
    expect(edge.status).toBe(202);
    expect(recorded().map((r) => r.providerCallId)).toEqual(["CA-edge"]);

    // A provider retry of a stored event after the window is still a 200 duplicate, not an error or a second row.
    const retry = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-edge", occurredAt: new Date(Date.now() - 60 * minute).toISOString() }));
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({ status: "duplicate" });
    expect(recorded()).toHaveLength(1);
    expect((await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-nots", occurredAt: undefined }))).status).toBe(400);
  });

  it("rate limits per provider+number with 429 and Retry-After, without affecting other numbers", async () => {
    const w = seedWorld();
    await enable(w);
    const { CALL_TRACKING_WEBHOOK_NUMBER_LIMIT } = await import("../../services/growth/call-tracking.service.js");
    for (let i = 0; i < CALL_TRACKING_WEBHOOK_NUMBER_LIMIT; i++) {
      const res = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: `CA-rl-${i}`, occurredAt: new Date().toISOString() }));
      expect(res.status).not.toBe(429);
    }
    const limited = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-rl-over", occurredAt: new Date().toISOString() }));
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: "RATE_LIMITED" });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(recorded().some((r) => r.providerCallId === "CA-rl-over")).toBe(false);
    const other = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-other", trackingNumber: "+15125550999", occurredAt: new Date().toISOString() }));
    expect(other.status).toBe(202);
  });

  it("rate limits per IP before any provider lookup, including the disabled adapter", async () => {
    const { CALL_TRACKING_WEBHOOK_IP_LIMIT } = await import("../../services/growth/call-tracking.service.js");
    for (let i = 0; i < CALL_TRACKING_WEBHOOK_IP_LIMIT; i++) {
      expect((await postWebhook("disabled", {})).status).toBe(503);
    }
    const limited = await postWebhook("disabled", {});
    expect(limited.status).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect((await postWebhook(FAKE_PROVIDER, callEvent())).status).toBe(429);
    expect(fakeParse).not.toHaveBeenCalled();
  });

  describe("review nits: signed timestamp header + timingSafeEqual, verified_at freshness", () => {
    const SIGNING_SECRET = "test-only-signing-secret";
    const SIG_HEADER = "x-provider-signature";
    const TS_HEADER = "x-provider-timestamp";
    async function signingAdapter() {
      const { verifySignedWebhook, parseSignedTimestampMs } = await import("../../lib/webhook-signature.js");
      return {
        ...fakeAdapter,
        verifyWebhookSignature: (input: { headers: Readonly<Record<string, string | undefined>>; rawBody: string }) =>
          verifySignedWebhook({
            secret: SIGNING_SECRET,
            rawBody: input.rawBody,
            signature: input.headers[SIG_HEADER],
            timestamp: input.headers[TS_HEADER],
            toleranceMs: 5 * 60_000
          }).ok,
        signedTimestampMs: (input: { headers: Readonly<Record<string, string | undefined>> }) => parseSignedTimestampMs(input.headers[TS_HEADER])
      };
    }
    async function postSigned(body: unknown, signedAtMs: number, opts: { tamper?: boolean } = {}) {
      const { createHmac } = await import("node:crypto");
      const raw = JSON.stringify(body);
      const ts = String(Math.floor(signedAtMs / 1000));
      const sig = createHmac("sha256", SIGNING_SECRET).update(`${ts}.${raw}`).digest("hex");
      return request(app.server)
        .post(`/api/v1/webhooks/call-tracking/${FAKE_PROVIDER}`)
        .set("content-type", "application/json")
        .set(SIG_HEADER, sig)
        .set(TS_HEADER, ts)
        .send(opts.tamper ? raw.replace("answered", "missed") : raw);
    }

    it("uses the provider's signed timestamp (not the body occurredAt) for the replay window", async () => {
      const w = seedWorld();
      await enable(w);
      (await registry()).registerCallTrackingAdapter(await signingAdapter());
      const minute = 60_000;
      // Body claims a stale occurredAt, but the provider signed it just now: accepted.
      const fresh = await postSigned(callEvent({ providerCallId: "CA-signed-1", occurredAt: new Date(Date.now() - 60 * minute).toISOString() }), Date.now());
      expect(fresh.status).toBe(202);
      expect(fresh.body).toEqual({ status: "accepted" });
      // Body claims "now", but the signed header is 10 minutes old: the signature check rejects it (401).
      const replayed = await postSigned(callEvent({ providerCallId: "CA-signed-2" }), Date.now() - 10 * minute);
      expect(replayed.status).toBe(401);
      // Tampered body under a valid header signature is rejected by the constant-time compare.
      expect((await postSigned(callEvent({ providerCallId: "CA-signed-3" }), Date.now(), { tamper: true })).status).toBe(401);
      expect(recorded().map((r) => r.providerCallId)).toEqual(["CA-signed-1"]);
    });

    it("a signing adapter that yields no signed timestamp fails closed (401) before any write", async () => {
      const w = seedWorld();
      await enable(w);
      (await registry()).registerCallTrackingAdapter({ ...fakeAdapter, signedTimestampMs: () => null });
      const res = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-nots-header" }));
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "INVALID_SIGNATURE" });
      (await registry()).registerCallTrackingAdapter({ ...fakeAdapter, signedTimestampMs: () => { throw new Error("bad header"); } });
      expect((await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-throw-header" }))).status).toBe(401);
      expect(recorded()).toHaveLength(0);
    });

    it("honors provider verified_at only while fresh; stale, future or invalid verified_at reads as unverified", async () => {
      const w = seedWorld();
      await enable(w);
      const day = 24 * 60 * 60_000;
      const cases: Array<[unknown, string]> = [
        [{ status: "verified", verifiedAt: new Date(Date.now() - day).toISOString() }, "verified"],
        [{ status: "verified" }, "verified"],
        [{ status: "verified", verifiedAt: new Date(Date.now() - 31 * day).toISOString() }, "unverified"],
        [{ status: "verified", verifiedAt: new Date(Date.now() + day).toISOString() }, "unverified"],
        [{ status: "verified", verifiedAt: "not-a-date" }, "unverified"],
        [{ status: "verified", verifiedAt: 12345 }, "unverified"],
        [{ status: "pending", verifiedAt: new Date().toISOString() }, "pending"],
        [{ status: "__proto__" }, "unverified"]
      ];
      for (const [reported, expected] of cases) {
        fakeVerifyOwnership.mockImplementationOnce((async () => reported) as never);
        const list = await request(app.server).get("/api/v1/growth/call-tracking/numbers").set("Authorization", w.owner);
        expect(list.body.numbers[0]).toMatchObject({ verificationStatus: expected, canReceiveCalls: expected === "verified" });
      }
      // A stale verification also blocks ingest.
      fakeVerifyOwnership.mockImplementationOnce((async () => ({ status: "verified", verifiedAt: new Date(Date.now() - 31 * day).toISOString() })) as never);
      const res = await postWebhook(FAKE_PROVIDER, callEvent({ providerCallId: "CA-stale-verified" }));
      expect(res.body).toEqual({ status: "ignored", reason: "number_unverified" });
      expect(recorded()).toHaveLength(0);
    });
  });
});
