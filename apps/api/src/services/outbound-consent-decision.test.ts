import { describe, expect, it } from "vitest";
import { outboundConsentDecisionInputSchema } from "@fsm/types";
import { assertConsentReplayMatches, assertVerifiedConsentSource, fingerprintConsentDecision } from "./outbound-consent-decision.js";

const subjectId = "33333333-3333-4333-8333-333333333333";
const input = outboundConsentDecisionInputSchema.parse({
  key: {
    companyId: "11111111-1111-4111-8111-111111111111", subjectType: "customer", subjectId,
    channel: "email", purpose: "marketing", contact: " Test@Example.com ",
  },
  decision: "grant", sourceKind: "customer_capture", sourceRecordId: subjectId,
  statementVersion: "marketing-email-v1", evidenceRef: "capture:synthetic",
  actorType: "customer", actorId: subjectId, idempotencyKey: "decision-1",
});

describe("FS-234 consent decision provenance and idempotency", () => {
  it("accepts an exact evidenced grant and replays the same canonical decision", () => {
    expect(() => assertVerifiedConsentSource(input)).not.toThrow();
    const hash = fingerprintConsentDecision(input);
    expect(() => assertConsentReplayMatches(hash, { ...input, idempotencyKey: "decision-2" })).not.toThrow();
  });

  it("rejects a changed decision under the same idempotency key", () => {
    const hash = fingerprintConsentDecision(input);
    for (const changed of [
      { decision: "revoke" as const }, { statementVersion: "marketing-email-v2" },
      { evidenceRef: "another-capture" }, { key: { ...input.key, purpose: "appointment" as const } },
      { key: { ...input.key, contact: "different@example.com" } },
      { key: { ...input.key, companyId: "22222222-2222-4222-8222-222222222222" } },
    ]) {
      expect(() => assertConsentReplayMatches(hash, { ...input, ...changed })).toThrow();
    }
  });

  it("blocks inferred grants, silent booking transfer, and unverified revocations", () => {
    expect(() => assertVerifiedConsentSource({ ...input, sourceKind: "preference" })).toThrow();
    expect(() => assertVerifiedConsentSource({ ...input, sourceRecordId: "44444444-4444-4444-8444-444444444444" })).toThrow();
    expect(() => assertVerifiedConsentSource({ ...input, key: { ...input.key, subjectType: "booking_request" } })).toThrow();
    expect(() => assertVerifiedConsentSource({ ...input, decision: "revoke", sourceKind: "proposal_edit" })).toThrow();
    expect(() => assertVerifiedConsentSource({ ...input, decision: "revoke", sourceKind: "operator_revoke" })).toThrow();
  });

  it("allows a new evidenced regrant after revocation only as a new ordered decision", () => {
    const revoke = { ...input, decision: "revoke" as const, sourceKind: "customer_revoke", idempotencyKey: "revoke-1" };
    expect(() => assertVerifiedConsentSource(revoke)).not.toThrow();
    expect(fingerprintConsentDecision(revoke)).not.toBe(fingerprintConsentDecision(input));
    expect(() => assertVerifiedConsentSource({ ...input, idempotencyKey: "regrant-1", evidenceRef: "new-capture" })).not.toThrow();
  });
});
