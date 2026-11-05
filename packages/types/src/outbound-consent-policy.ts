import { outboundConsentKeySchema, type OutboundConsentCheck, type OutboundConsentKey } from "./outbound-consent.types.js";

export interface ConsentSubjectFacts {
  companyId: string;
  contact: string | null;
  doNotContact: boolean;
}

export interface ConsentStateFacts extends OutboundConsentKey {
  state: "granted" | "revoked";
  version: number;
  lastEventId: string;
}

/** A preview can display eligibility at check time; execution/provider must call again. */
export function evaluateCurrentOutboundConsent(input: {
  key: OutboundConsentKey;
  subject: ConsentSubjectFacts | null;
  state: ConsentStateFacts | null;
  expectedVersion?: number;
  checkedAt: Date;
}): OutboundConsentCheck {
  const { key, subject, state, expectedVersion, checkedAt } = input;
  const actual = subject?.contact
    ? outboundConsentKeySchema.safeParse({ ...key, contact: subject.contact })
    : null;
  if (!subject || subject.companyId !== key.companyId || !actual?.success || actual.data.contact !== key.contact) {
    return { eligible: false, reason: "subject_unavailable", checkedAt };
  }
  if (subject.doNotContact) return { eligible: false, reason: "contact_restricted", checkedAt };
  if (!state || state.companyId !== key.companyId || state.subjectType !== key.subjectType ||
    state.subjectId !== key.subjectId || state.channel !== key.channel || state.purpose !== key.purpose ||
    state.contact !== key.contact) {
    return { eligible: false, reason: "grant_missing", checkedAt };
  }
  if (state.state !== "granted") return { eligible: false, reason: "grant_revoked", checkedAt };
  if (expectedVersion !== undefined && state.version !== expectedVersion) {
    return { eligible: false, reason: "version_changed", checkedAt };
  }
  return { eligible: true, version: state.version, eventId: state.lastEventId, checkedAt };
}
