import { beforeEach, describe, expect, it, vi } from "vitest";

const runTransactionWithTenantSession = vi.hoisted(() => vi.fn());
const tables = vi.hoisted(() => ({
  bookingRequests: { kind: "bookingRequests" }, customers: { kind: "customers" },
  outboundConsentEvents: { kind: "events" }, outboundConsentStates: { kind: "states" },
  outboundConsentCaptureReceipts: { kind: "receipts" },
}));
const emitEventWithExecutor = vi.hoisted(() => vi.fn());
vi.mock("@fsm/db", () => ({
  runTransactionWithTenantSession,
  ...tables,
  emitEventWithExecutor,
}));

import { checkOutboundConsent, recordOutboundConsentDecision, revokeOperatorOutboundConsent } from "./outbound-consent.service.js";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
const receiptId = "55555555-5555-4555-8555-555555555555";
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
    await expect(recordOutboundConsentDecision(actor, { key, decision: "grant", receiptId, idempotencyKey: "one" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });

  it("rejects caller-forged capture evidence and actor identity before any database call", async () => {
    const sameTenantKey = { ...key, companyId: tenantA };
    await expect(recordOutboundConsentDecision(actor, {
      key: sameTenantKey, decision: "grant", receiptId, idempotencyKey: "one",
      sourceKind: "customer_capture", sourceRecordId: subjectId,
      statementVersion: "fabricated", evidenceRef: "fabricated", actorType: "customer", actorId: subjectId,
    })).rejects.toThrow();
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });

  it("keeps grant, revocation, and regrant closed without an authoritative persisted verifier", async () => {
    const sameTenantKey = { ...key, companyId: tenantA };
    for (const decision of ["grant", "revoke", "grant"] as const) {
      await expect(recordOutboundConsentDecision(actor, {
        key: sameTenantKey, decision, receiptId, idempotencyKey: `decision-${decision}`,
      })).rejects.toMatchObject({ code: "POLICY_DENIED" });
    }
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });
});

describe("FS-234 source-specific operator revocation", () => {
  const operator = { ...actor, companyId: tenantB };
  const input = { customerId: subjectId, channel: "email", purpose: "marketing", idempotencyKey: "revoke-one" };

  beforeEach(() => {
    runTransactionWithTenantSession.mockReset();
    emitEventWithExecutor.mockReset();
  });

  it("rejects unauthenticated actors, grants and forged evidence before a transaction", async () => {
    await expect(revokeOperatorOutboundConsent({ ...operator, actorType: "system", actorId: null }, input))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(revokeOperatorOutboundConsent(operator, { ...input, decision: "grant" })).rejects.toThrow();
    await expect(revokeOperatorOutboundConsent(operator, { ...input, contact: "forged@example.com" })).rejects.toThrow();
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });

  it("writes a server-derived receipt, revocation and activity in one tenant transaction and replays idempotently", async () => {
    const receipts: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const states: Record<string, unknown>[] = [];
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockImplementation(() => ({
        from: (table: { kind: string }) => ({
          where: () => ({ limit: () => {
            const rows = table === tables.customers ? [{ email: "Test@Example.com", phone: null, doNotContact: false }]
              : table === tables.outboundConsentCaptureReceipts ? receipts
              : table === tables.outboundConsentEvents ? events
                : table === tables.outboundConsentStates ? states : [];
            return { then: (resolve: (value: unknown) => void) => resolve(rows.slice(0, 1)),
              for: () => Promise.resolve(rows.slice(0, 1)) };
          } }),
        }),
      })),
      insert: vi.fn().mockImplementation((table: { kind: string }) => ({
        values: (value: Record<string, unknown>) => {
          const rows = table === tables.outboundConsentCaptureReceipts ? receipts
            : table === tables.outboundConsentStates ? states : events;
          const saved = { ...value, occurredAt: new Date("2026-11-03T00:00:00Z") };
          rows.push(saved);
          return { then: (resolve: (value: unknown) => void) => resolve(undefined),
            returning: () => Promise.resolve([saved]) };
        },
      })),
      update: vi.fn().mockImplementation(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    };
    runTransactionWithTenantSession.mockImplementation(async (_companyId: string, work: (transaction: typeof tx) => Promise<unknown>) => work(tx));
    const first = await revokeOperatorOutboundConsent(operator, input);
    const second = await revokeOperatorOutboundConsent(operator, input);
    expect(first).toEqual(second);
    await expect(revokeOperatorOutboundConsent(operator, { ...input, purpose: "appointment" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(runTransactionWithTenantSession).toHaveBeenCalledWith(tenantB, expect.any(Function));
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ companyId: tenantB, contact: "test@example.com", decision: "revoke",
      sourceSurface: "operator", actorId: operator.actorId, explicitChoice: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ companyId: tenantB, currentState: "revoked", sourceKind: "operator_revoke" });
    expect(emitEventWithExecutor).toHaveBeenCalledTimes(1);
  });
});
