import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const flags = vi.hoisted(() => ({ loyaltyRemindersEnabled: true, loyaltyRemindersDryRun: false }));

vi.mock("@fsm/config/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fsm/config/feature-flags")>();
  return { ...actual, featureFlags: new Proxy(actual.featureFlags, {
    get: (target, key) => (key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key))
  }) };
});

vi.mock("drizzle-orm", async () => (await import("../test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("../test-support/fake-db.js")).createDbModuleMock());

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 0) },
  webhooksQueue: { add: vi.fn() }
}));
vi.mock("@fsm/ai/langfuse", () => ({ recordAgentAuditObservation: vi.fn(async () => undefined) }));

type FakeDbModule = typeof import("../test-support/fake-db.js");
let fakeDb: FakeDbModule;
let executors: typeof import("./agent-action.executors.js");

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  executors = await import("./agent-action.executors.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  flags.loyaltyRemindersEnabled = true;
  flags.loyaltyRemindersDryRun = false;
});

function seedConsentingCustomer(slug: string, marketing = true) {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", phone: "5551112222" });
  const booking = fakeDb.seedBookingRequest({ companyId: company.id, customerId: customer.id, firstName: "A", lastName: "B",
    phone: customer.phone!, addressLine1: "1 St", city: "Austin", state: "TX", zip: "78701", smsConsentMarketing: marketing });
  return { company, customer, booking };
}

function runGate(companyId: string, customerId: string, opts: { targetCompanyId?: string; parameters?: Record<string, unknown> } = {}) {
  const executor = executors.requireAgentActionExecutor("loyalty.reminder.propose");
  const ctx = {
    tx: {} as never,
    companyId,
    actorId: "user-1",
    actionId: "action-1",
    actionType: "loyalty.reminder.propose",
    parameters: { channel: "sms", consentScope: "marketing", ...opts.parameters },
    target: { contractVersion: "1.0.0" as const, entityType: "customer" as const, entityId: customerId,
      companyId: opts.targetCompanyId ?? companyId, observedAt: "2026-10-10T12:00:00.000Z", recordVersion: "rv1:1" },
    requiresApproval: true,
    state: "approved"
  };
  return Promise.resolve().then(() => executor.beforeExecute!(ctx as never));
}

describe("loyalty.reminder.propose outbound consent gate", () => {
  it("is blocked without an affirmative marketing consent", async () => {
    const { company, customer } = seedConsentingCustomer("no-consent", false);
    await expect(runGate(company.id, customer.id)).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("is allowed with current SMS marketing consent", async () => {
    const { company, customer } = seedConsentingCustomer("consent");
    await expect(runGate(company.id, customer.id)).resolves.toMatchObject({ allowed: true });
  });

  it("is blocked when consent is revoked after the proposal was approved", async () => {
    const { company, customer, booking } = seedConsentingCustomer("revoked");
    await expect(runGate(company.id, customer.id)).resolves.toMatchObject({ allowed: true });
    booking.smsConsentMarketing = false;
    await expect(runGate(company.id, customer.id)).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
    customer.doNotContact = true;
    await expect(runGate(company.id, customer.id)).rejects.toBeTruthy();
  });

  it("fails closed on wrong channel or scope, and email stays blocked", async () => {
    const { company, customer } = seedConsentingCustomer("wrong");
    await expect(runGate(company.id, customer.id, { parameters: { channel: "push" } }))
      .rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
    await expect(runGate(company.id, customer.id, { parameters: { consentScope: "appointment" } }))
      .rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
    await expect(runGate(company.id, customer.id, { parameters: { channel: "email" } }))
      .rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("denies cross-tenant targets", async () => {
    const a = seedConsentingCustomer("tenant-a");
    const b = seedConsentingCustomer("tenant-b");
    await expect(runGate(a.company.id, b.customer.id)).rejects.toBeTruthy();
    await expect(runGate(a.company.id, a.customer.id, { targetCompanyId: b.company.id }))
      .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("still enforces the FS-72 loyalty founder gate before consent", async () => {
    const { company, customer } = seedConsentingCustomer("flags");
    flags.loyaltyRemindersEnabled = false;
    await expect(runGate(company.id, customer.id)).rejects.toMatchObject({ code: ErrorCode.POLICY_DENIED, message: "Loyalty reminders are disabled" });
    flags.loyaltyRemindersEnabled = true;
    flags.loyaltyRemindersDryRun = true;
    await expect(runGate(company.id, customer.id)).rejects.toMatchObject({ code: ErrorCode.POLICY_DENIED });
  });
});
