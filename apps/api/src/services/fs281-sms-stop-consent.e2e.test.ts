/**
 * FS-281 end-to-end (in-memory fake-db): Twilio webhook STOP write -> authorizeAgentActionExecution read via the
 * real loyalty.reminder.propose executor gate. The webhook handler is the real apps/webhook module; both apps share
 * the same mocked @fsm/db + drizzle-orm here, so the STOP write and the consent read hit one in-memory store.
 *
 * Not proven here: a STOP that commits while an execute is already past its consent read (true concurrency).
 */
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("@fsm/config/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fsm/config/feature-flags")>();
  return { ...actual, featureFlags: new Proxy(actual.featureFlags, {
    get: (target, key) =>
      key === "loyaltyRemindersEnabled" ? true : key === "loyaltyRemindersDryRun" ? false : Reflect.get(target, key)
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
type TwilioHandler = (request: unknown, reply: unknown) => Promise<unknown>;
let fakeDb: FakeDbModule;
let executors: typeof import("./agent-action.executors.js");
let createLoyaltyReminderProposal: typeof import("./loyalty-reminder-propose.service.js").createLoyaltyReminderProposal;
let twilioHandler: TwilioHandler;

// The webhook app is outside this package's rootDir, so load it by URL (vitest resolves it; tsc does not follow it).
const TWILIO_HANDLER_URL = new URL("../../../webhook/src/handlers/twilio.handler.ts", import.meta.url).href;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  executors = await import("./agent-action.executors.js");
  ({ createLoyaltyReminderProposal } = await import("./loyalty-reminder-propose.service.js"));
  ({ twilioHandler } = (await import(/* @vite-ignore */ TWILIO_HANDLER_URL)) as { twilioHandler: TwilioHandler });
});

beforeEach(() => fakeDb.resetTestState());

const E164 = "+15551112222";

async function inboundSms(body: string, from = E164) {
  const reply = {
    statusCode: 0,
    code(status: number) { this.statusCode = status; return this; },
    type() { return this; },
    send() { return this; }
  };
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  await twilioHandler(
    { twilioParams: { From: from, To: "+15555550000", Body: body, MessageSid: `SM${randomUUID()}` }, log },
    reply
  );
  expect(reply.statusCode).toBe(200);
}

function seedConsentingCustomer(slug: string, customerPhone = "5551112222", bookingPhone = "5551112222") {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", phone: customerPhone });
  const booking = fakeDb.seedBookingRequest({ companyId: company.id, customerId: customer.id, firstName: "A", lastName: "B",
    phone: bookingPhone, addressLine1: "1 St", city: "Austin", state: "TX", zip: "78701", smsConsentMarketing: true });
  return { company, customer, booking };
}

function gateContext(companyId: string, customerId: string, state = "approved") {
  return {
    tx: {} as never,
    companyId,
    actorId: "user-1",
    actionId: randomUUID(),
    actionType: "loyalty.reminder.propose",
    parameters: { channel: "sms", consentScope: "marketing" },
    target: { contractVersion: "1.0.0" as const, entityType: "customer" as const, entityId: customerId, companyId,
      observedAt: "2026-11-03T12:00:00.000Z", recordVersion: "rv1:1" },
    requiresApproval: true,
    state
  };
}

const gate = (ctx: ReturnType<typeof gateContext>) =>
  Promise.resolve().then(() => executors.requireAgentActionExecutor("loyalty.reminder.propose").beforeExecute!(ctx as never));

describe("FS-281 webhook STOP -> loyalty.reminder.propose consent gate", () => {
  it("persisted proposal is allowed, then denied after an inbound STOP (legacy-format stored phone)", async () => {
    const { company, customer } = seedConsentingCustomer("stop-e2e");
    const proposal = await createLoyaltyReminderProposal({
      companyId: company.id,
      actorId: "ai-actor",
      idempotencyKey: "loyalty:stop-e2e",
      parameters: { customerId: customer.id, ruleFamily: "lapsed_reactivation", summary: "Service reminder" }
    });
    const stored = fakeDb.getTestState().agentActions.find((action) => action.id === proposal.id)!;
    const ctx = { ...gateContext(company.id, customer.id), actionId: proposal.id, parameters: stored.parameters,
      target: proposal.target };
    await expect(gate(ctx as never)).resolves.toMatchObject({ allowed: true });

    await inboundSms("  Unsubscribe ");

    expect(fakeDb.getTestState().customers.find((row) => row.id === customer.id)?.doNotContact).toBe(true);
    expect(fakeDb.getSmsOptOutPhones()).toEqual([E164]);
    await expect(gate(ctx as never)).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("STOP between approval and execute: the approved action is denied at execute", async () => {
    const { company, customer } = seedConsentingCustomer("approved-then-stop");
    const ctx = gateContext(company.id, customer.id, "approved");
    await expect(gate(ctx)).resolves.toMatchObject({ allowed: true });
    await inboundSms("STOP");
    await expect(gate(ctx)).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("phone-level opt-out: STOP from a phone with no customer row denies a customer created later in any tenant", async () => {
    await inboundSms("QUIT");
    expect(fakeDb.getSmsOptOutPhones()).toEqual([E164]);
    const { company, customer } = seedConsentingCustomer("created-after-stop", "(555) 111-2222");
    expect(customer.doNotContact).toBe(false);
    await expect(gate(gateContext(company.id, customer.id))).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("platform-wide: one STOP denies the same phone in every tenant", async () => {
    const a = seedConsentingCustomer("tenant-a", "+15551112222");
    const b = seedConsentingCustomer("tenant-b", "555-111-2222");
    await expect(gate(gateContext(a.company.id, a.customer.id))).resolves.toMatchObject({ allowed: true });
    await expect(gate(gateContext(b.company.id, b.customer.id))).resolves.toMatchObject({ allowed: true });
    await inboundSms("stop");
    await expect(gate(gateContext(a.company.id, a.customer.id))).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
    await expect(gate(gateContext(b.company.id, b.customer.id))).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("a non-STOP reply never writes an opt-out and keeps the action allowed", async () => {
    const { company, customer } = seedConsentingCustomer("non-stop");
    await inboundSms("START");
    await inboundSms("stop texting so early please");
    expect(fakeDb.getSmsOptOutPhones()).toEqual([]);
    await expect(gate(gateContext(company.id, customer.id))).resolves.toMatchObject({ allowed: true });
  });
});

describe("FS-281 authorizeAgentActionExecution phone-level checks (fail closed)", () => {
  it("customer stored as E.164 still matches 10-digit booking consent evidence", async () => {
    const { company, customer } = seedConsentingCustomer("e164-vs-10", "+15551112222", "5551112222");
    await expect(gate(gateContext(company.id, customer.id))).resolves.toMatchObject({ allowed: true });
  });

  it("denies when the target phone cannot be normalised", async () => {
    const { company, customer } = seedConsentingCustomer("bad-phone", "555-0100", "555-0100");
    await expect(gate(gateContext(company.id, customer.id))).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("denies when the opt-out lookup fails", async () => {
    const { company, customer } = seedConsentingCustomer("lookup-fails");
    fakeDb.setSmsOptOutLookupFailure(true);
    await expect(gate(gateContext(company.id, customer.id))).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("denies a seeded phone-level opt-out even when the customer row is not doNotContact", async () => {
    const { company, customer } = seedConsentingCustomer("seeded-opt-out");
    fakeDb.seedSmsOptOut(E164);
    await expect(gate(gateContext(company.id, customer.id))).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });
});
