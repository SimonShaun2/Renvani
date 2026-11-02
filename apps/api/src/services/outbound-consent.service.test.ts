import { beforeEach, describe, expect, it, vi } from "vitest";

const runTransactionWithTenantSession = vi.hoisted(() => vi.fn());
vi.mock("@fsm/db", () => ({
  runTransactionWithTenantSession,
  bookingRequests: {}, customers: {}, outboundConsentEvents: {}, outboundConsentStates: {},
  emitEventWithExecutor: vi.fn(),
}));

import { checkOutboundConsent, recordOutboundConsentDecision } from "./outbound-consent.service.js";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
const key = {
  companyId: tenantB, subjectType: "customer", subjectId,
  channel: "email", purpose: "marketing", contact: "test@example.com",
};
const actor = { companyId: tenantA, actorType: "user" as const, actorId: "44444444-4444-4444-8444-444444444444" };

describe("FS-234 trusted tenant and evidence boundary", () => {
  beforeEach(() => runTransactionWithTenantSession.mockClear());

  it("denies A-authenticated/B-key reads before opening B's RLS session", async () => {
    await expect(checkOutboundConsent(tenantA, key)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });

  it("denies A-authenticated/B-key writes without state, event, or activity writes", async () => {
    await expect(recordOutboundConsentDecision(actor, { key, decision: "grant", idempotencyKey: "one" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });

  it("rejects caller-forged capture evidence and actor identity before any database call", async () => {
    const sameTenantKey = { ...key, companyId: tenantA };
    await expect(recordOutboundConsentDecision(actor, {
      key: sameTenantKey, decision: "grant", idempotencyKey: "one",
      sourceKind: "customer_capture", sourceRecordId: subjectId,
      statementVersion: "fabricated", evidenceRef: "fabricated", actorType: "customer", actorId: subjectId,
    })).rejects.toThrow();
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });

  it("keeps grant, revocation, and regrant closed without an authoritative persisted verifier", async () => {
    const sameTenantKey = { ...key, companyId: tenantA };
    for (const decision of ["grant", "revoke", "grant"] as const) {
      await expect(recordOutboundConsentDecision(actor, {
        key: sameTenantKey, decision, idempotencyKey: `decision-${decision}`,
      })).rejects.toMatchObject({ code: "POLICY_DENIED" });
    }
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });
});
