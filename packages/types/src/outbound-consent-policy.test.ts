import { describe, expect, it } from "vitest";
import { evaluateCurrentOutboundConsent } from "./outbound-consent-policy.js";
import { outboundConsentDecisionInputSchema, outboundConsentIntentSchema, outboundConsentKeySchema } from "./outbound-consent.types.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const otherCompany = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
const eventId = "44444444-4444-4444-8444-444444444444";
const checkedAt = new Date("2026-11-02T00:00:00Z");
const key = outboundConsentKeySchema.parse({
  companyId, subjectType: "customer", subjectId, contact: " TEST@EXAMPLE.COM ", channel: "email", purpose: "marketing",
});
const subject = { companyId, contact: "test@example.com", doNotContact: false };
const state = { ...key, state: "granted" as const, version: 2, lastEventId: eventId };

const evaluate = (overrides: Partial<Parameters<typeof evaluateCurrentOutboundConsent>[0]> = {}) =>
  evaluateCurrentOutboundConsent({ key, subject, state, checkedAt, ...overrides });

describe("FS-234 outbound consent authority", () => {
  it("normalizes email, rejects malformed SMS and never defaults channel or purpose", () => {
    expect(key.contact).toBe("test@example.com");
    expect(outboundConsentKeySchema.safeParse({ ...key, channel: "sms", contact: "5551234567" }).success).toBe(false);
    expect(outboundConsentKeySchema.safeParse({ ...key, purpose: undefined }).success).toBe(false);
    expect(outboundConsentKeySchema.safeParse({ ...key, channel: undefined }).success).toBe(false);
  });

  it("requires current exact grant and active destination; preferences and snapshots do not grant", () => {
    expect(evaluate({ state: null })).toMatchObject({ eligible: false, reason: "grant_missing" });
    expect(evaluate({ subject: { ...subject, contact: "new@example.com" } })).toMatchObject({ eligible: false, reason: "subject_unavailable" });
    expect(evaluate({ subject: null })).toMatchObject({ eligible: false, reason: "subject_unavailable" });
    expect(evaluate({ subject: { ...subject, doNotContact: true } })).toMatchObject({ eligible: false, reason: "contact_restricted" });
    expect(evaluate({ state: { ...state, state: "revoked" } })).toMatchObject({ eligible: false, reason: "grant_revoked" });
  });

  it("denies wrong tenant, subject, channel, purpose and destination", () => {
    expect(evaluate({ subject: { ...subject, companyId: otherCompany } })).toMatchObject({ eligible: false, reason: "subject_unavailable" });
    for (const wrong of [
      { companyId: otherCompany }, { subjectType: "booking_request" as const },
      { subjectId: eventId }, { channel: "sms" as const },
      { purpose: "appointment" as const }, { contact: "other@example.com" },
    ]) {
      expect(evaluate({ state: { ...state, ...wrong } })).toMatchObject({ eligible: false, reason: "grant_missing" });
    }
  });

  it("rechecks queued grant version at provider handoff and fails closed after revocation or regrant", () => {
    expect(evaluate({ expectedVersion: 2 })).toMatchObject({ eligible: true, version: 2, eventId });
    expect(evaluate({ expectedVersion: 1 })).toMatchObject({ eligible: false, reason: "version_changed" });
    expect(evaluate({ expectedVersion: 2, state: { ...state, state: "revoked", version: 3 } })).toMatchObject({ eligible: false, reason: "grant_revoked" });
    expect(evaluate({ expectedVersion: 2, state: { ...state, version: 4 } })).toMatchObject({ eligible: false, reason: "version_changed" });
  });

  it("requires explicit evidenced decision input and rejects unknown/default sources", () => {
    const input = {
      key, decision: "grant", sourceKind: "customer_capture", sourceRecordId: subjectId,
      statementVersion: "marketing-email-v1", evidenceRef: "capture:synthetic",
      actorType: "customer", actorId: subjectId, idempotencyKey: "capture-1",
    };
    expect(outboundConsentDecisionInputSchema.safeParse(input).success).toBe(true);
    expect(outboundConsentDecisionInputSchema.safeParse({ ...input, statementVersion: "" }).success).toBe(false);
    expect(outboundConsentDecisionInputSchema.safeParse({ ...input, evidenceRef: "" }).success).toBe(false);
    expect(outboundConsentDecisionInputSchema.safeParse({ ...input, actorId: null }).success).toBe(false);
    expect(outboundConsentDecisionInputSchema.safeParse({ ...input, idempotencyKey: "" }).success).toBe(false);
    expect(outboundConsentIntentSchema.safeParse({ key, decision: "grant", idempotencyKey: "capture-1" }).success).toBe(true);
    expect(outboundConsentIntentSchema.safeParse(input).success).toBe(false);
  });
});
