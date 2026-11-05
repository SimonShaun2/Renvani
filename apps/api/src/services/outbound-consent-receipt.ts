import { createHash } from "node:crypto";
import { AppError, ErrorCode, outboundConsentKeySchema, type OutboundConsentIntent, type OutboundConsentDecisionInput } from "@fsm/types";

export interface TrustedConsentActor {
  companyId: string;
  actorType: "user" | "system" | "customer";
  actorId: string | null;
}

export interface ConsentCaptureReceiptFacts {
  id: string;
  companyId: string;
  subjectType: "customer" | "booking_request";
  subjectId: string;
  channel: "email" | "sms";
  purpose: "appointment" | "marketing";
  contact: string;
  decision: "grant" | "revoke";
  explicitChoice: boolean;
  statementVersion: string;
  sourceRecordId: string;
  sourceSurface: "public_inquiry" | "customer_portal" | "operator" | "signed_inbound";
  actorType: string;
  actorId: string | null;
  signedInboundIdentity: string | null;
  signatureVerifiedAt: Date | null;
  capturedAt: Date;
  idempotencyKey: string;
  payloadFingerprint: string;
  deletedAt: Date | null;
}

export type VerifiedConsentEvidence = Pick<
  OutboundConsentDecisionInput,
  "sourceKind" | "sourceRecordId" | "statementVersion" | "evidenceRef"
>;

/** Hash of the immutable capture tuple, excluding row ID, timestamps and the idempotency key. */
export function fingerprintConsentCaptureReceipt(receipt: Omit<ConsentCaptureReceiptFacts, "payloadFingerprint">): string {
  return createHash("sha256").update(JSON.stringify([
    receipt.companyId, receipt.subjectType, receipt.subjectId, receipt.channel, receipt.purpose,
    receipt.contact, receipt.decision, receipt.explicitChoice, receipt.statementVersion,
    receipt.sourceRecordId, receipt.sourceSurface, receipt.actorType, receipt.actorId,
    receipt.signedInboundIdentity, receipt.signatureVerifiedAt?.toISOString() ?? null,
  ])).digest("hex");
}

/** Verifies a *persisted* receipt; caller text can never construct consent evidence. */
export function verifyPersistedConsentReceipt(input: {
  actor: TrustedConsentActor;
  intent: OutboundConsentIntent;
  receipt: ConsentCaptureReceiptFacts | null;
  currentSubject: { companyId: string; contact: string | null; doNotContact: boolean } | null;
}): VerifiedConsentEvidence {
  const { actor, intent, receipt, currentSubject } = input;
  const key = intent.key;
  const deny = (): never => { throw new AppError(ErrorCode.POLICY_DENIED, "Consent receipt is not verified for this decision"); };
  if (!receipt) return deny();
  if (receipt.deletedAt || receipt.id !== intent.receiptId ||
    receipt.companyId !== actor.companyId || receipt.companyId !== key.companyId ||
    receipt.subjectType !== key.subjectType || receipt.subjectId !== key.subjectId ||
    receipt.channel !== key.channel || receipt.purpose !== key.purpose || receipt.contact !== key.contact ||
    receipt.decision !== intent.decision || receipt.idempotencyKey !== intent.idempotencyKey ||
    !receipt.explicitChoice || !receipt.statementVersion.trim() ||
    !Number.isFinite(receipt.capturedAt.getTime()) ||
    fingerprintConsentCaptureReceipt(receipt) !== receipt.payloadFingerprint) return deny();
  const actualDestination = currentSubject?.contact
    ? outboundConsentKeySchema.safeParse({ ...key, contact: currentSubject.contact })
    : null;
  if (!currentSubject || currentSubject.companyId !== actor.companyId ||
    !actualDestination?.success || actualDestination.data.contact !== key.contact ||
    (intent.decision === "grant" && currentSubject.doNotContact)) return deny();

  let sourceKind: VerifiedConsentEvidence["sourceKind"];
  if (receipt.sourceSurface === "public_inquiry") {
    if (receipt.subjectType !== "booking_request" || receipt.decision !== "grant" ||
      receipt.sourceRecordId !== receipt.subjectId || receipt.actorType !== "system" ||
      receipt.actorId !== null || actor.actorType !== "system" || actor.actorId !== null ||
      receipt.signedInboundIdentity !== null || receipt.signatureVerifiedAt !== null) deny();
    // Product/Legal have not approved anonymous marketing-checkbox sufficiency or copy.
    if (receipt.purpose === "marketing") deny();
    sourceKind = "booking_request_capture";
  } else if (receipt.sourceSurface === "customer_portal") {
    if (receipt.subjectType !== "customer" || receipt.sourceRecordId !== receipt.subjectId ||
      receipt.actorType !== "customer" || receipt.actorId === null ||
      actor.actorType !== "customer" || actor.actorId !== receipt.actorId ||
      receipt.signedInboundIdentity !== null || receipt.signatureVerifiedAt !== null) deny();
    sourceKind = receipt.decision === "grant" ? "customer_capture" : "customer_revoke";
  } else if (receipt.sourceSurface === "operator") {
    if (receipt.decision !== "revoke" || receipt.actorType !== "user" ||
      receipt.actorId === null || actor.actorType !== "user" || actor.actorId !== receipt.actorId ||
      receipt.sourceRecordId !== receipt.actorId ||
      receipt.signedInboundIdentity !== null || receipt.signatureVerifiedAt !== null) deny();
    sourceKind = "operator_revoke";
  } else if (receipt.sourceSurface === "signed_inbound") {
    if (receipt.decision !== "revoke" || receipt.sourceRecordId !== receipt.subjectId ||
      receipt.actorType !== "system" || receipt.actorId !== null ||
      actor.actorType !== "system" || actor.actorId !== null ||
      !receipt.signedInboundIdentity || !receipt.signatureVerifiedAt) deny();
    sourceKind = "inbound_revoke";
  } else return deny();

  return {
    sourceKind, sourceRecordId: receipt.sourceRecordId,
    statementVersion: receipt.statementVersion,
    evidenceRef: receipt.id,
  };
}
