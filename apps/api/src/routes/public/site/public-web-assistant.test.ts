import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type pino from "pino";

const capturedLogs = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock("pino", async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof pino }>();
  const { Writable } = await import("node:stream");
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      capturedLogs.lines.push(String(chunk));
      callback();
    }
  });
  return { ...actual, default: (options: Parameters<typeof actual.default>[0]) => actual.default(options, stream) };
});

import { PUBLIC_ASSISTANT_ANSWER_IP_LIMIT } from "../../../lib/public-inquiry-rate-limit.js";
import { resetPublicBookingRateLimitStateForTests } from "../../../lib/public-booking-rate-limit.js";
import { setupTestEnv } from "../../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});
vi.mock("@fsm/db", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});
const queueAdd = vi.fn(async () => undefined);
vi.mock("@fsm/jobs", () => ({ notificationsQueue: { add: queueAdd }, redisConnection: { del: vi.fn(async () => 0) } }));

type BuildAppModule = typeof import("../../../app.js");
type FakeDbModule = typeof import("../../../test-support/fake-db.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;
let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let app: AppInstance;
let hvacCompanyId: string;
let plumbingCompanyId: string;

const contact = {
  firstName: "Ana", lastName: "Lopez", phone: "(918) 555-0142", email: "ana@example.com",
  addressLine1: "12 Oak St", city: "Tulsa", state: "OK", zip: "74103"
};

function post(slug: string, body: unknown, options: { key?: string; ip?: string } = {}) {
  return app.inject({
    method: "POST", url: `/api/v1/public/site/${slug}/assistant`,
    remoteAddress: options.ip ?? "203.0.113.40",
    headers: { "content-type": "application/json", ...(options.key ? { "idempotency-key": options.key } : {}) },
    payload: JSON.stringify(body)
  });
}

describe("FS-197 public web assistant first slice", () => {
  beforeAll(async () => {
    buildAppModule = await import("../../../app.js");
    fakeDb = await import("../../../test-support/fake-db.js");
  });
  beforeEach(async () => {
    process.env.FS197_WEB_ASSISTANT_ENABLED = "true";
    fakeDb.resetTestState();
    resetPublicBookingRateLimitStateForTests();
    queueAdd.mockClear();
    capturedLogs.lines.length = 0;
    const hvac = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac", timezone: "America/Chicago",
      settings: { trade: "hvac", serviceArea: { zips: ["74103"], radiusMiles: null }, emergencyService: { enabled: false, hoursText: null } } });
    hvacCompanyId = hvac.id;
    fakeDb.seedBookingSettings({ companyId: hvac.id, bookingSlug: "acme-hvac", isEnabled: true,
      offeredServices: [{ label: "AC Repair" }], autoConfirm: true, notifyOnNewBooking: true });
    const plumbing = fakeDb.seedCompany({ name: "Pipe Co", slug: "pipe-co", timezone: "America/Chicago",
      settings: { trade: "plumbing", serviceArea: { zips: ["74104"], radiusMiles: null } } });
    plumbingCompanyId = plumbing.id;
    fakeDb.seedBookingSettings({ companyId: plumbing.id, bookingSlug: "pipe-co", isEnabled: true,
      offeredServices: [{ label: "Water Heater Repair" }] });
    app = await buildAppModule.buildApp();
    await app.ready();
  });
  afterEach(async () => {
    delete process.env.FS197_WEB_ASSISTANT_ENABLED;
    await app.close();
  });

  it("fails closed until the validated rollout gate is enabled", async () => {
    process.env.FS197_WEB_ASSISTANT_ENABLED = "false";
    const res = await post("acme-hvac", { action: "answer", topic: "services" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: "FEATURE_DISABLED" });
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
  });

  it("answers only verified HVAC/plumbing public facts and withholds prices or live capacity", async () => {
    const hvac = await post("acme-hvac", { action: "answer", topic: "services", service: "AC Repair" });
    expect(hvac.statusCode).toBe(200);
    expect(hvac.json()).toMatchObject({ kind: "answer", verified: true, source: "public_booking_settings" });
    const plumbing = await post("pipe-co", { action: "answer", topic: "services", service: "Water Heater Repair" }, { ip: "203.0.113.41" });
    expect(plumbing.json()).toMatchObject({ kind: "answer", verified: true });
    expect((await post("acme-hvac", { action: "answer", topic: "service_area", zip: "74103" }, { ip: "203.0.113.42" })).json())
      .toMatchObject({ verified: true, source: "zip_serviceability" });
    expect((await post("acme-hvac", { action: "answer", topic: "service_area", zip: "10001" }, { ip: "203.0.113.43" })).json())
      .toMatchObject({ verified: true, source: "zip_serviceability" });
    for (const topic of ["pricing", "availability", "emergency", "human"] as const) {
      expect((await post("acme-hvac", { action: "answer", topic }, { ip: `203.0.113.${50 + topic.length}` })).json())
        .toMatchObject({ verified: false, source: "unverified" });
    }
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
  });

  it("labels midnight correctly when the published booking window ends at hour 24", async () => {
    const shop = fakeDb.seedCompany({ name: "Night Pipe", slug: "night-pipe", timezone: "America/Chicago",
      settings: { trade: "plumbing", serviceArea: { zips: ["74103"], radiusMiles: null } } });
    fakeDb.seedBookingSettings({ companyId: shop.id, bookingSlug: "night-pipe", isEnabled: true,
      offeredServices: [{ label: "Drain Repair" }], availableHoursStart: 18, availableHoursEnd: 24 });
    const response = await post("night-pipe", { action: "answer", topic: "booking_hours" }, { ip: "203.0.113.44" });
    expect(response.statusCode).toBe(200);
    expect(response.json().answer).toContain("12:00 AM (next day)");
    expect(response.json().answer).not.toContain("12:00 PM");
  });

  it("creates one pending tenant-scoped staff handoff with consent and activity, never a job or outbound notification", async () => {
    const body = { action: "handoff", topic: "human", service: "AC Repair", message: "Please call about my AC",
      contact, contactConsent: true, smsConsentAppointments: false, smsConsentMarketing: false, source: "website" };
    const first = await post("acme-hvac", body, { key: "assistant-1" });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ kind: "handoff", status: "pending", reason: "human_requested" });
    expect(first.json().message).toContain("No appointment has been confirmed");
    const state = fakeDb.getTestState();
    expect(state.bookingRequests).toHaveLength(1);
    expect(state.bookingRequests[0]).toMatchObject({ companyId: hvacCompanyId, status: "pending", jobId: null,
      source: "website", smsConsentAppointments: false, smsConsentMarketing: false });
    expect(state.activityEvents.some((event) => event.eventType === "booking.requested" && event.companyId === hvacCompanyId)).toBe(true);
    expect(state.activityEvents.some((event) => event.eventType === "revenue.inquiry_escalated" && event.companyId === hvacCompanyId)).toBe(true);
    expect(state.activityEvents.some((event) => event.eventType === "revenue.inquiry_received" &&
      (event.payload as { consentAudit?: { contactConsent?: boolean } }).consentAudit?.contactConsent === true)).toBe(true);
    expect(queueAdd).not.toHaveBeenCalled();
    const replay = await post("acme-hvac", body, { key: "assistant-1" });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().referenceNumber).toBe(first.json().referenceNumber);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(1);
    const mismatch = await post("acme-hvac", { ...body, message: "Different request" }, { key: "assistant-1" });
    expect(mismatch.statusCode).toBe(409);
  });

  it("keeps out-of-area, unknown service and emergency requests pending for staff with their true reasons", async () => {
    const cases = [
      { topic: "services", service: "Roofing", zip: "74103", reason: "unsupported_service" },
      { topic: "service_area", service: "AC Repair", zip: "10001", reason: "out_of_area" },
      { topic: "emergency", service: "AC Repair", zip: "74103", reason: "emergency_review" }
    ] as const;
    for (const [index, item] of cases.entries()) {
      const response = await post("acme-hvac", { action: "handoff", topic: item.topic, service: item.service,
        message: "Please review", contact: { ...contact, zip: item.zip }, contactConsent: true },
        { key: `assistant-case-${index}`, ip: `203.0.113.${70 + index}` });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ reason: item.reason, status: "pending" });
    }
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(3);
    expect(fakeDb.getTestState().activityEvents.some((event) => event.eventType === "booking.requested" &&
      (event.payload as { serviceability?: string }).serviceability === "out_of_area")).toBe(true);
  });

  it("keeps unknown coverage, pricing, and unknown capacity requests pending for staff", async () => {
    const unknown = fakeDb.seedCompany({ name: "New HVAC", slug: "new-hvac", timezone: "America/Chicago",
      settings: { trade: "hvac" } });
    fakeDb.seedBookingSettings({ companyId: unknown.id, bookingSlug: "new-hvac", isEnabled: true,
      offeredServices: [{ label: "AC Repair" }] });
    const cases = [
      { slug: "new-hvac", topic: "service_area", reason: "unknown_serviceability" },
      { slug: "acme-hvac", topic: "pricing", reason: "pricing_review" },
      { slug: "acme-hvac", topic: "availability", reason: "availability_review" }
    ] as const;
    for (const [index, item] of cases.entries()) {
      const response = await post(item.slug, { action: "handoff", topic: item.topic, service: "AC Repair",
        message: "Please review", contact, contactConsent: true },
        { key: `unknown-${index}`, ip: `203.0.113.${90 + index}` });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ kind: "handoff", status: "pending", reason: item.reason });
    }
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(3);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("does not verify unsupported-trade facts and sends that request to staff", async () => {
    const shop = fakeDb.seedCompany({ name: "General Shop", slug: "general-shop", timezone: "America/Chicago",
      settings: { serviceArea: { zips: ["74103"], radiusMiles: null } } });
    fakeDb.seedBookingSettings({ companyId: shop.id, bookingSlug: "general-shop", isEnabled: true,
      offeredServices: [{ label: "General Service" }] });
    const answer = await post("general-shop", { action: "answer", topic: "services" }, { ip: "203.0.113.95" });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toMatchObject({ verified: false, source: "unverified" });
    const handoff = await post("general-shop", { action: "handoff", topic: "services", service: "General Service",
      message: "Please review", contact, contactConsent: true }, { key: "unsupported-trade", ip: "203.0.113.96" });
    expect(handoff.statusCode).toBe(201);
    expect(handoff.json()).toMatchObject({ status: "pending", reason: "unsupported_service" });
  });

  it("scopes the same handoff idempotency key to each published tenant", async () => {
    const body = { action: "handoff", topic: "human", message: "Please call", contact, contactConsent: true };
    const first = await post("acme-hvac", body, { key: "shared-public-key", ip: "203.0.113.81" });
    const second = await post("pipe-co", body, { key: "shared-public-key", ip: "203.0.113.82" });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().referenceNumber).not.toBe(second.json().referenceNumber);
    expect(fakeDb.getTestState().bookingRequests.map((row) => row.companyId)).toEqual([hvacCompanyId, plumbingCompanyId]);
  });

  it("rejects invalid consent, client tenant selection, unknown shop and abuse without creating work", async () => {
    const body = { action: "handoff", topic: "human", message: "Help", contact };
    expect((await post("acme-hvac", body, { key: "invalid-1" })).statusCode).toBe(400);
    expect((await post("acme-hvac", { ...body, contactConsent: true }, { key: "k".repeat(115) })).statusCode).toBe(400);
    expect((await post("acme-hvac", { ...body, contactConsent: true, companyId: plumbingCompanyId }, { key: "invalid-2" })).statusCode).toBe(400);
    expect((await post("missing-shop", { action: "answer", topic: "services" })).statusCode).toBe(404);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
    for (let i = 0; i < PUBLIC_ASSISTANT_ANSWER_IP_LIMIT; i += 1) {
      await post("acme-hvac", { action: "answer", topic: "services" }, { ip: "198.51.100.20" });
    }
    const limited = await post("acme-hvac", { action: "answer", topic: "services" }, { ip: "198.51.100.20" });
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("does not let FAQ traffic consume the real inquiry and staff handoff budget", async () => {
    const ip = "198.51.100.21";
    for (let i = 0; i < PUBLIC_ASSISTANT_ANSWER_IP_LIMIT; i += 1) {
      expect((await post("acme-hvac", { action: "answer", topic: "services" }, { ip })).statusCode).toBe(200);
    }
    expect((await post("acme-hvac", { action: "answer", topic: "services" }, { ip })).statusCode).toBe(429);
    const handoff = await post("acme-hvac", { action: "handoff", topic: "human", message: "Please call",
      contact, contactConsent: true }, { key: "after-faq", ip });
    expect(handoff.statusCode).toBe(201);
    expect(handoff.json()).toMatchObject({ status: "pending" });
  });

  it("does not log submitted contact details or message", async () => {
    const response = await post("acme-hvac", { action: "handoff", topic: "human",
      message: "Private compressor concern", contact, contactConsent: true },
      { key: "private-contact", ip: "203.0.113.97" });
    expect(response.statusCode).toBe(201);
    const logged = capturedLogs.lines.join(" ");
    expect(logged).toContain("/api/v1/public/site/acme-hvac/assistant");
    expect(logged).not.toContain(contact.email);
    expect(logged).not.toContain(contact.phone);
    expect(logged).not.toContain(contact.addressLine1);
    expect(logged).not.toContain("Private compressor concern");
  });
});
