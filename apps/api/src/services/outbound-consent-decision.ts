import { createHash } from "node:crypto";
import { AppError, ErrorCode, type OutboundConsentDecisionInput } from "@fsm/types";

/** Canonical server-side decision identity. Idempotency key itself is deliberately excluded. */
export function fingerprintConsentDecision(input: OutboundConsentDecisionInput): string {
  const { key, decision, sourceKind, sourceRecordId, statementVersion, evidenceRef, actorType, actorId } = input;
  return createHash("sha256").update(JSON.stringify([
    key.companyId, key.subjectType, key.subjectId, key.channel, key.purpose, key.contact,
    decision, sourceKind, sourceRecordId, statementVersion, evidenceRef, actorType, actorId,
  ])).digest("hex");
}

export function assertVerifiedConsentSource(input: OutboundConsentDecisionInput): void {
  if (input.decision === "grant") {
    const expected = input.key.subjectType === "customer" ? "customer_capture" : "booking_request_capture";
    if (input.sourceKind !== expected || input.sourceRecordId !== input.key.subjectId ||
      (input.actorType !== "customer" && input.actorType !== "system")) {
      throw new AppError(ErrorCode.POLICY_DENIED, "Grant requires affirmative subject capture evidence");
    }
  } else if (
    !["customer_revoke", "operator_revoke", "inbound_revoke"].includes(input.sourceKind) ||
    (input.sourceKind === "operator_revoke" && (input.actorType !== "user" || input.sourceRecordId !== input.actorId)) ||
    (input.sourceKind !== "operator_revoke" && input.sourceRecordId !== input.key.subjectId)
  ) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Revocation source is not verified");
  }
}

/** Same key/payload returns the original event; a changed payload is a conflict. */
export function assertConsentReplayMatches(existingFingerprint: string, input: OutboundConsentDecisionInput): void {
  if (existingFingerprint !== fingerprintConsentDecision(input)) {
    throw new AppError(ErrorCode.CONFLICT, "Consent idempotency key has a different decision");
  }
}
