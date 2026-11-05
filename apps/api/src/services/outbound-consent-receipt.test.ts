import { describe, expect, it } from "vitest";
import { outboundConsentIntentSchema } from "@fsm/types";
import {
  fingerprintConsentCaptureReceipt,
  verifyPersistedConsentReceipt,
  type ConsentCaptureReceiptFacts,
  type TrustedConsentActor,
} from "./outbound-consent-receipt.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const otherCompany = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";
const receiptId = "55555555-5555-4555-8555-555555555555";
const actor: TrustedConsentActor = { companyId, actorType: "customer", actorId };
const intent = outboundConsentIntentSchema.parse({
  key: { companyId, subjectType: "customer", subjectId, channel: "email", purpose: "appointment", contact: "test@example.com" },
  decision: "grant", receiptId, idempotencyKey: "capture-1",
});
const subject = { companyId, contact: "test@example.com", doNotContact: false };
const receiptBase: Omit<ConsentCaptureReceiptFacts, "payloadFingerprint"> = {
  id: receiptId, companyId, subjectType: "customer", subjectId,
  channel: "email", purpose: "appointment", contact: "test@example.com", decision: "grant",
  explicitChoice: true, statementVersion: "appointment-email-v1", sourceRecordId: subjectId,
  sourceSurface: "customer_portal", actorType: "customer", actorId,
  signedInboundIdentity: null, signatureVerifiedAt: null,
  capturedAt: new Date("2026-11-02T18:00:00Z"), idempotencyKey: "capture-1", deletedAt: null,
};
const receipt: ConsentCaptureReceiptFacts = { ...receiptBase, payloadFingerprint: fingerprintConsentCaptureReceipt(receiptBase) };
const verify = (overrides: Partial<Parameters<typeof verifyPersistedConsentReceipt>[0]> = {}) =>
  verifyPersistedConsentReceipt({ actor, intent, receipt, currentSubject: subject, ...overrides });

describe("FS-234 persisted consent capture receipt", () => {
  it("resolves only the exact persisted customer capture tuple", () => {
    expect(verify()).toEqual({
      sourceKind: "customer_capture", sourceRecordId: subjectId,
      statementVersion: "appointment-email-v1", evidenceRef: receiptId,
    });
  });

  it("denies absent, deleted, forged fingerprint and mismatched exact tuple", () => {
    expect(() => verify({ receipt: null })).toThrow();
    for (const changed of [
      { deletedAt: new Date() }, { payloadFingerprint: "0".repeat(64) }, { companyId: otherCompany },
      { subjectId: actorId }, { contact: "other@example.com" }, { channel: "sms" as const },
      { purpose: "marketing" as const }, { decision: "revoke" as const },
      { statementVersion: "fabricated" }, { sourceRecordId: actorId },
      { actorId: subjectId }, { idempotencyKey: "other" }, { explicitChoice: false },
    ]) {
      expect(() => verify({ receipt: { ...receipt, ...changed } })).toThrow();
    }
    // A recomputed fingerprint cannot turn a wrong-scope row into evidence for this intent.
    for (const changed of [
      { companyId: otherCompany }, { subjectId: actorId }, { contact: "other@example.com" },
      { channel: "sms" as const }, { purpose: "marketing" as const },
      { decision: "revoke" as const }, { actorId: subjectId }, { idempotencyKey: "other" },
    ]) {
      const wrong = { ...receiptBase, ...changed };
      expect(() => verify({ receipt: { ...wrong, payloadFingerprint: fingerprintConsentCaptureReceipt(wrong) } })).toThrow();
    }
  });

  it("denies inactive or changed subject, forbidden operator grant and unchecked public marketing", () => {
    expect(() => verify({ currentSubject: null })).toThrow();
    expect(() => verify({ currentSubject: { ...subject, contact: "changed@example.com" } })).toThrow();
    expect(() => verify({ currentSubject: { ...subject, doNotContact: true } })).toThrow();
    const operatorGrant = { ...receiptBase, sourceSurface: "operator" as const, actorType: "user", actorId,
      sourceRecordId: actorId };
    expect(() => verify({ actor: { companyId, actorType: "user", actorId },
      receipt: { ...operatorGrant, payloadFingerprint: fingerprintConsentCaptureReceipt(operatorGrant) } })).toThrow();
    const publicMarketing = { ...receiptBase, subjectType: "booking_request" as const,
      purpose: "marketing" as const, sourceSurface: "public_inquiry" as const,
      actorType: "system", actorId: null, sourceRecordId: subjectId };
    const publicIntent = outboundConsentIntentSchema.parse({
      ...intent, key: { ...intent.key, subjectType: "booking_request", purpose: "marketing" },
    });
    expect(() => verify({ actor: { companyId, actorType: "system", actorId: null }, intent: publicIntent,
      receipt: { ...publicMarketing, payloadFingerprint: fingerprintConsentCaptureReceipt(publicMarketing) } })).toThrow();
  });

  it("accepts only authenticated operator revocation and signature-verified inbound revocation", () => {
    const operator = { ...receiptBase, decision: "revoke" as const, sourceSurface: "operator" as const,
      actorType: "user", actorId, sourceRecordId: actorId };
    const revokeIntent = outboundConsentIntentSchema.parse({ ...intent, decision: "revoke" });
    expect(verify({ actor: { companyId, actorType: "user", actorId }, intent: revokeIntent,
      receipt: { ...operator, payloadFingerprint: fingerprintConsentCaptureReceipt(operator) } }).sourceKind).toBe("operator_revoke");
    const inbound = { ...receiptBase, decision: "revoke" as const, sourceSurface: "signed_inbound" as const,
      actorType: "system", actorId: null, signedInboundIdentity: "provider:verified:synthetic",
      signatureVerifiedAt: new Date("2026-11-02T18:01:00Z") };
    expect(verify({ actor: { companyId, actorType: "system", actorId: null }, intent: revokeIntent,
      receipt: { ...inbound, payloadFingerprint: fingerprintConsentCaptureReceipt(inbound) } }).sourceKind).toBe("inbound_revoke");
    expect(() => verify({ actor: { companyId, actorType: "system", actorId: null }, intent: revokeIntent,
      receipt: { ...inbound, signatureVerifiedAt: null, payloadFingerprint: fingerprintConsentCaptureReceipt({ ...inbound, signatureVerifiedAt: null }) } })).toThrow();
  });
});
