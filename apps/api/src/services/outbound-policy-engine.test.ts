import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

import { ErrorCode } from "@fsm/types";

import { authorizeAgentActionExecution } from "./outbound-policy-engine.service.js";

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
});

describe("outbound-policy-engine (FS-13)", () => {
  function customerTarget(companyId: string, entityId: string) {
    return { contractVersion: "1.0.0" as const, entityType: "customer" as const, entityId,
      companyId, observedAt: "2026-10-10T12:00:00.000Z", recordVersion: "rv1:1" };
  }

  function marketingAction(companyId: string, entityId: string, parameters: Record<string, unknown> = {}) {
    return authorizeAgentActionExecution({ companyId, actorId: "user-1", actorType: "user",
      actionType: "revenue.reactivation.propose",
      parameters: { channel: "sms", consentScope: "marketing", ...parameters },
      target: customerTarget(companyId, entityId), requiresApproval: true, state: "approved" });
  }

  function bookingConsent(companyId: string, customerId: string, phone: string, marketing: boolean) {
    return fakeDb.seedBookingRequest({ companyId, customerId, firstName: "Chris", lastName: "Pine", phone,
      addressLine1: "1 St", city: "Austin", state: "TX", zip: "78701", smsConsentMarketing: marketing });
  }
  it("denies cross-tenant agent execution via resource company mismatch", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant A", slug: "tenant-a" });
    const booking = fakeDb.seedBookingRequest({
      companyId: company.id,
      firstName: "A",
      lastName: "B",
      phone: "5551112222",
      addressLine1: "1 St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      smsConsentAppointments: true
    });

    const decision = await authorizeAgentActionExecution({
      companyId: company.id,
      actorId: "user-1",
      actorType: "user",
      actionType: "message.send_proposed",
      parameters: { channel: "sms", workflow: "revenue.inquiry_response" },
      target: {
        contractVersion: "1.0.0",
        entityType: "booking_request",
        entityId: booking.id,
        companyId: "00000000-0000-4000-8000-0000000000aa",
        observedAt: "2026-10-10T12:00:00.000Z",
        recordVersion: "rv1:1"
      },
      requiresApproval: true,
      state: "approved"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe(ErrorCode.NOT_FOUND);
    expect(decision.policyVersion).toBeTruthy();
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it("denies forged identity when asserted company disagrees with session tenant", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant B", slug: "tenant-b" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B" });

    const decision = await authorizeAgentActionExecution({
      companyId: company.id,
      actorId: "user-1",
      actorType: "user",
      assertedCompanyId: "forged-tenant",
      actionType: "message.send_proposed",
      parameters: {
        channel: "sms",
        consentScope: "marketing",
        consentSnapshot: {
          consentScope: "appointment",
          capturedAt: "2026-10-10T12:00:00.000Z",
          consentVersion: 1,
          currentConsentVersion: 1,
          appointmentOptIn: true,
          marketingOptIn: false,
          revokedAt: null
        }
      },
      target: {
        contractVersion: "1.0.0",
        entityType: "customer",
        entityId: customer.id,
        companyId: company.id,
        observedAt: "2026-10-10T12:00:00.000Z",
        recordVersion: "rv1:1"
      },
      requiresApproval: true,
      state: "approved"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.failureCode).toBe("FORGED_IDENTITY");
    expect(decision.errorCode).toBe(ErrorCode.FORBIDDEN);
  });

  it("denies revoked marketing consent despite an embedded proposal snapshot", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant C", slug: "tenant-c" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", phone: "5551112222" });
    const booking = bookingConsent(company.id, customer.id, customer.phone!, true);
    booking.smsConsentMarketing = false;

    const decision = await authorizeAgentActionExecution({
      companyId: company.id,
      actorId: "user-1",
      actorType: "user",
      actionType: "message.send_proposed",
      parameters: {
        channel: "sms",
        consentSnapshot: {
          consentScope: "marketing",
          capturedAt: "2026-10-01T12:00:00.000Z",
          consentVersion: 1,
          currentConsentVersion: 4,
          appointmentOptIn: true,
          marketingOptIn: true,
          revokedAt: null
        }
      },
      target: {
        contractVersion: "1.0.0",
        entityType: "customer",
        entityId: customer.id,
        companyId: company.id,
        observedAt: "2026-10-10T12:00:00.000Z",
        recordVersion: "rv1:1"
      },
      requiresApproval: true,
      state: "approved"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.failureCode).toBe("CONSENT_REQUIRED");
    expect(decision.errorCode).toBe(ErrorCode.CONSENT_REQUIRED);
  });

  it("denies unauthorized sends when approval is still required", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant D", slug: "tenant-d" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B" });

    const decision = await authorizeAgentActionExecution({
      companyId: company.id,
      actorId: "user-1",
      actorType: "user",
      actionType: "message.send_proposed",
      parameters: {
        channel: "sms",
        consentSnapshot: {
          consentScope: "appointment",
          capturedAt: "2026-10-10T12:00:00.000Z",
          consentVersion: 2,
          currentConsentVersion: 2,
          appointmentOptIn: true,
          marketingOptIn: true,
          revokedAt: null
        }
      },
      target: {
        contractVersion: "1.0.0",
        entityType: "customer",
        entityId: customer.id,
        companyId: company.id,
        observedAt: "2026-10-10T12:00:00.000Z",
        recordVersion: "rv1:1"
      },
      requiresApproval: true,
      state: "awaiting_approval"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.failureCode).toBe("UNAUTHORIZED_SEND");
    expect(decision.errorCode).toBe(ErrorCode.POLICY_DENIED);
  });

  it("denies default preferences without an affirmative marketing grant", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant E", slug: "tenant-e" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", phone: "5551112222", doNotContact: false });
    expect((await marketingAction(company.id, customer.id)).failureCode).toBe("CONSENT_REQUIRED");
    await expect(marketingAction(company.id, customer.id, { channel: "unknown" }))
      .rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
  });

  it("uses only current matching SMS scope and honors current opt-out", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant F", slug: "tenant-f" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", phone: "5551112222" });
    bookingConsent(company.id, customer.id, customer.phone!, true);
    expect((await marketingAction(company.id, customer.id)).allowed).toBe(true);
    expect((await marketingAction(company.id, customer.id, { channel: "email" })).failureCode).toBe("CONSENT_REQUIRED");
    await expect(marketingAction(company.id, customer.id, { consentScope: "appointment" })).rejects.toMatchObject({ code: ErrorCode.CONSENT_REQUIRED });
    customer.doNotContact = true;
    expect((await marketingAction(company.id, customer.id)).allowed).toBe(false);
  });

  it("denies conflicting inquiry consent even after the granting inquiry is rescheduled", async () => {
    const company = fakeDb.seedCompany({ name: "Tenant I", slug: "tenant-i" });
    const other = fakeDb.seedCompany({ name: "Tenant J", slug: "tenant-j" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", phone: "5551112222" });
    const oldGrant = bookingConsent(company.id, customer.id, customer.phone!, true);
    oldGrant.smsConsentAppointments = true;
    const revoked = bookingConsent(company.id, customer.id, customer.phone!, false);
    revoked.updatedAt = new Date("2026-02-01T00:00:00.000Z");
    // A scheduling edit makes the old grant the newest row without changing consent.
    oldGrant.updatedAt = new Date("2026-03-01T00:00:00.000Z");
    bookingConsent(other.id, customer.id, customer.phone!, true).updatedAt = new Date("2026-03-01T00:00:00.000Z");
    expect((await marketingAction(company.id, customer.id)).failureCode).toBe("CONSENT_REQUIRED");
    const appointment = await authorizeAgentActionExecution({ companyId: company.id, actorId: "user-1",
      actorType: "user", actionType: "revenue.invoice_reminder.propose",
      parameters: { channel: "sms", consentScope: "appointment" },
      target: customerTarget(company.id, customer.id), requiresApproval: true, state: "approved" });
    expect(appointment.failureCode).toBe("CONSENT_REQUIRED");
    revoked.deletedAt = new Date("2026-04-01T00:00:00.000Z");
    expect((await marketingAction(company.id, customer.id)).failureCode).toBe("CONSENT_REQUIRED");
    revoked.smsConsentMarketing = true;
    customer.phone = "5559998888";
    expect((await marketingAction(company.id, customer.id)).failureCode).toBe("CONSENT_REQUIRED");
  });

  it("rejects missing, deleted and other-tenant targets despite forged snapshots", async () => {
    const own = fakeDb.seedCompany({ name: "Tenant G", slug: "tenant-g" });
    const other = fakeDb.seedCompany({ name: "Tenant H", slug: "tenant-h" });
    const deleted = fakeDb.seedCustomer({ companyId: own.id, firstName: "A", lastName: "B", deletedAt: new Date() });
    const foreign = fakeDb.seedCustomer({ companyId: other.id, firstName: "C", lastName: "D" });
    const snapshot = { consentScope: "marketing", marketingOptIn: true, appointmentOptIn: true,
      capturedAt: "2099-01-01T00:00:00.000Z", consentVersion: 999, currentConsentVersion: 999, revokedAt: null };
    for (const id of ["00000000-0000-4000-8000-000000000099", deleted.id, foreign.id]) {
      await expect(marketingAction(own.id, id, { consentSnapshot: snapshot })).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    }
  });
});
