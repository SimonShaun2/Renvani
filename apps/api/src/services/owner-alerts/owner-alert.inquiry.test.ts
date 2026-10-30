import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetPublicBookingRateLimitStateForTests } from "../../lib/public-booking-rate-limit.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob } = vi.hoisted(() => ({ addQueueJob: vi.fn(async () => undefined) }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});
vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});
vi.mock("@fsm/jobs", () => ({
  notificationsQueue: { add: addQueueJob },
  redisConnection: { del: vi.fn(async () => 0) }
}));

type FakeDbModule = typeof import("../../test-support/fake-db.js");
type AlertModule = typeof import("./owner-alert.service.js");
type IntakeModule = typeof import("../revenue-inquiry-intake.service.js");
type BuildAppModule = typeof import("../../app.js");

let fakeDb: FakeDbModule;
let alerts: AlertModule;
let intake: IntakeModule;
let buildAppModule: BuildAppModule;

beforeAll(async () => {
  fakeDb = await import("../../test-support/fake-db.js");
  alerts = await import("./owner-alert.service.js");
  intake = await import("../revenue-inquiry-intake.service.js");
  buildAppModule = await import("../../app.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  resetPublicBookingRateLimitStateForTests();
  alerts.resetOwnerAlertStateForTests();
  addQueueJob.mockClear();
});

function seedShop(settings: Record<string, unknown> = {}) {
  const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac", timezone: "America/Chicago", email: "owner@acme.test" });
  fakeDb.seedBookingSettings({ companyId: company.id, bookingSlug: "acme-hvac", isEnabled: true, autoConfirm: false, ...settings });
  fakeDb.seedTechnician({ companyId: company.id, firstName: "Taylor", lastName: "Tech", phone: "555-0101", serviceZipCodes: ["74103"] });
  return company;
}

function ownerAlertCalls() {
  return addQueueJob.mock.calls.filter((call) => (call as unknown[])[0] === "send-owner-alert") as unknown as Array<
    [string, Record<string, unknown>, { jobId: string }]
  >;
}

const base = {
  kind: "new_inquiry" as const,
  enabled: true,
  headline: "New inquiry",
  summary: "Dana S. · ZIP 74103. Open your inbox to reply.",
  actionPath: "/dispatch/bookings",
  actionLabel: "Open inbox"
};

describe("queueOwnerAlert", () => {
  it("queues one email alert to the notification email (falls back to company email), idempotent per entity", async () => {
    const company = seedShop({ notificationEmail: "alerts@acme.test" });
    const first = await alerts.queueOwnerAlert({ ...base, companyId: company.id, entityId: "br-1" });
    expect(first).toEqual({ status: "queued", jobId: "owner-alert-new_inquiry-br-1", channels: ["email"] });
    const [, data, opts] = ownerAlertCalls()[0]!;
    expect(data).toMatchObject({ toEmail: "alerts@acme.test", toPhones: [], kind: "new_inquiry", companyName: "Acme HVAC" });
    expect(String(data.actionUrl)).toMatch(/\/dispatch\/bookings$/u);
    expect(opts).toEqual({ jobId: "owner-alert-new_inquiry-br-1" });

    await expect(alerts.queueOwnerAlert({ ...base, companyId: company.id, entityId: "br-1" })).resolves.toEqual({
      status: "skipped",
      reason: "duplicate"
    });
    expect(ownerAlertCalls()).toHaveLength(1);

    const other = seedShop();
    fakeDb.getTestState().bookingSettings.find((s) => s.companyId === other.id)!.notificationEmail = null;
    await alerts.queueOwnerAlert({ ...base, companyId: other.id, entityId: "br-2" });
    expect(ownerAlertCalls()[1]![1].toEmail).toBe("owner@acme.test");
  });

  it("is off-able", async () => {
    const company = seedShop();
    await expect(alerts.queueOwnerAlert({ ...base, enabled: false, companyId: company.id, entityId: "br-1" })).resolves.toEqual({
      status: "skipped",
      reason: "disabled"
    });
    expect(ownerAlertCalls()).toHaveLength(0);
  });

  it("folds alerts beyond the per-company hourly limit (no send) without affecting other companies", async () => {
    const company = seedShop();
    for (let i = 0; i < alerts.OWNER_ALERT_COMPANY_HOURLY_LIMIT; i += 1) {
      expect((await alerts.queueOwnerAlert({ ...base, companyId: company.id, entityId: `br-${i}` })).status).toBe("queued");
    }
    await expect(alerts.queueOwnerAlert({ ...base, companyId: company.id, entityId: "br-over" })).resolves.toEqual({
      status: "skipped",
      reason: "rate_limited"
    });
    const other = seedShop();
    expect((await alerts.queueOwnerAlert({ ...base, companyId: other.id, entityId: "br-x" })).status).toBe("queued");
  });

  it("queues no SMS while outbound SMS is the disabled stub", async () => {
    const company = seedShop();
    fakeDb.seedUser({ companyId: company.id, email: "o@acme.test", role: "owner", phone: "+19185550100" } as never);
    const outcome = await alerts.queueOwnerAlert({ ...base, sms: true, companyId: company.id, entityId: "br-1" });
    expect(outcome).toMatchObject({ channels: ["email"] });
    expect(ownerAlertCalls()[0]![1].toPhones).toEqual([]);
  });

  it("skips when there is no recipient", async () => {
    const company = seedShop();
    company.email = null as never;
    fakeDb.getTestState().companies.find((c) => c.id === company.id)!.email = null as never;
    await expect(alerts.queueOwnerAlert({ ...base, companyId: company.id, entityId: "br-1" })).resolves.toMatchObject({
      reason: "no_recipient"
    });
  });

  it("shortens names", () => {
    expect(alerts.shortCustomerName("Dana", "smith")).toBe("Dana S.");
    expect(alerts.shortCustomerName("", "")).toBe("A customer");
  });
});

describe("public inquiry -> owner alert", () => {
  let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;
  beforeEach(async () => {
    app = await buildAppModule.buildApp();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  const body = {
    firstName: "Jamie",
    lastName: "Stone",
    phone: "555-0200",
    email: "jamie@example.com",
    addressLine1: "500 Oak Ave",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    urgency: "this_week",
    preferredWindow: "afternoon",
    customerNotes: "Secret gate code 1234, furnace is loud",
    smsConsentAppointments: false,
    smsConsentMarketing: false
  };

  it("alerts the owner once per public inquiry with an inbox-level summary only", async () => {
    seedShop();
    const response = await request(app.server).post("/api/v1/public/booking/acme-hvac/submit?src=google").send(body);
    expect(response.status).toBe(201);
    const calls = ownerAlertCalls();
    expect(calls).toHaveLength(1);
    const data = calls[0]![1];
    expect(data.summary).toBe("Jamie S. · ZIP 74103 · via google. Open your inbox to reply.");
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("gate code");
    expect(serialized).not.toContain("jamie@example.com");
    expect(serialized).not.toContain("0200");
    expect(serialized).not.toContain("Stone");
    expect(calls[0]![2].jobId).toBe(`owner-alert-new_inquiry-${fakeDb.getTestState().bookingRequests[0]!.id}`);
  });

  it("respects notify_on_new_booking = false", async () => {
    seedShop({ notifyOnNewBooking: false });
    expect((await request(app.server).post("/api/v1/public/booking/acme-hvac/submit").send(body)).status).toBe(201);
    expect(ownerAlertCalls()).toHaveLength(0);
  });

  it("does not alert for staff-entered inquiries", async () => {
    const company = seedShop();
    const user = fakeDb.seedUser({ companyId: company.id, email: "staff@acme.test", role: "office" } as never);
    await intake.intakeStaffInquiry(company.id, (user as { id: string }).id, {
      channel: "staff_entry",
      contact: { firstName: "Pat", lastName: "Lee", phone: "5550300" },
      intentText: "Call back about a quote"
    } as never);
    expect(ownerAlertCalls()).toHaveLength(0);
  });
});
