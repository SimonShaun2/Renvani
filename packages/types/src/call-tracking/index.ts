import { z } from "zod";

/**
 * Growth: call tracking + recording (FS-200). Provider-agnostic; the only built-in adapter is `disabled`.
 * Registries (records keyed by id), not enums, so new providers, consent modes and call outcomes are additive.
 * Caller phone numbers are never returned: only a masked last-4. Recordings are stored by reference only.
 */

export const CALL_TRACKING_DISABLED_PROVIDER_ID = "disabled";
export const CALL_TRACKING_PROVIDER_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;

/** Recording consent regimes. `all_party` is the safe default; Legal decides per-state mapping. */
export const CALL_RECORDING_CONSENT_MODE_REGISTRY: Readonly<Record<string, { label: string }>> = {
  all_party: { label: "All-party consent (announce recording to every caller)" },
  one_party: { label: "One-party consent" }
};

/** What we know about the caller's consent for a given call. */
export const CALLER_CONSENT_REGISTRY: Readonly<Record<string, { label: string }>> = {
  unknown: { label: "Unknown" },
  granted: { label: "Caller stayed on after the recording notice" },
  declined: { label: "Caller declined recording" },
  not_required: { label: "Recording off; consent not required" }
};

/** Normalized call outcome reported by an adapter. */
export const CALL_OUTCOME_REGISTRY: Readonly<Record<string, { label: string }>> = {
  answered: { label: "Answered" },
  missed: { label: "Missed" },
  voicemail: { label: "Voicemail" },
  busy: { label: "Busy" },
  failed: { label: "Failed" }
};

/**
 * Ownership verification of a tracking number with its provider. Only `verified` numbers may receive or attribute
 * calls; the built-in disabled adapter can never verify, so every number stays `unverified`.
 */
export const CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY: Readonly<Record<string, { label: string; canReceiveCalls: boolean }>> = {
  unverified: { label: "Not verified with the provider", canReceiveCalls: false },
  pending: { label: "Verification in progress", canReceiveCalls: false },
  verified: { label: "Ownership verified with the provider", canReceiveCalls: true },
  failed: { label: "Verification failed", canReceiveCalls: false }
};
export const CALL_TRACKING_NUMBER_DEFAULT_VERIFICATION_STATUS = "unverified";

/** True only for a known status whose registry entry allows calls. Unknown text fails closed. */
export function callTrackingNumberCanReceiveCalls(status: string): boolean {
  return Object.prototype.hasOwnProperty.call(CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY, status)
    ? CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY[status]!.canReceiveCalls
    : false;
}

/** Webhook events must be stamped within this many ms of server time (either side); duplicates still replay. */
export const CALL_TRACKING_WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;

/**
 * A provider recording reference may be stored/exposed only if the disclosure was played AND the consent regime
 * is satisfied: all-party needs explicit `granted`; one-party needs anything except `declined`.
 */
export function callRecordingRefAllowed(input: { consentMode: string; recordingDisclosurePlayed: boolean; callerConsent: string }): boolean {
  if (!input.recordingDisclosurePlayed) return false;
  if (input.consentMode === "one_party") return input.callerConsent === "granted" || input.callerConsent === "unknown";
  return input.callerConsent === "granted";
}

const registryKey = (registry: Readonly<Record<string, unknown>>, name: string) =>
  z.string().refine((value) => Object.prototype.hasOwnProperty.call(registry, value), { message: `Unknown ${name}` });

/** E.164 business number (tracking number or forwarding target). */
export const e164PhoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/u, "Must be an E.164 phone number");
/** Two-letter US state/territory code whose recording notice applies. */
export const recordingNoticeStateSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/u, "Must be a 2-letter state code");
const marketingToken = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[\p{L}\p{N} ._~+-]+$/u, "Letters, digits, space and ._~+- only");
const providerIdSchema = z.string().regex(CALL_TRACKING_PROVIDER_ID_PATTERN, "Invalid provider id");

export const callTrackingSettingsUpdateSchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(1_000_000),
    provider: providerIdSchema.optional(),
    enabled: z.boolean().optional(),
    recordingEnabled: z.boolean().optional(),
    recordingDisclosureEnabled: z.boolean().optional(),
    consentMode: registryKey(CALL_RECORDING_CONSENT_MODE_REGISTRY, "consent mode").optional(),
    recordingNoticeState: recordingNoticeStateSchema.nullable().optional()
  })
  .strict();
export type CallTrackingSettingsUpdate = z.infer<typeof callTrackingSettingsUpdateSchema>;

export const callTrackingNumberCreateSchema = z
  .object({
    trackingNumber: e164PhoneSchema,
    label: z.string().trim().min(1).max(100),
    marketingSource: marketingToken(64),
    marketingCampaign: marketingToken(100).nullable().optional(),
    forwardingNumber: e164PhoneSchema,
    providerNumberId: z.string().trim().regex(/^[A-Za-z0-9._~-]{1,128}$/u).nullable().optional()
  })
  .strict();
export type CallTrackingNumberCreate = z.infer<typeof callTrackingNumberCreateSchema>;

export const callTrackingNumberUpdateSchema = z
  .object({
    expectedVersion: z.number().int().min(1).max(1_000_000),
    label: z.string().trim().min(1).max(100).optional(),
    marketingSource: marketingToken(64).optional(),
    marketingCampaign: marketingToken(100).nullable().optional(),
    forwardingNumber: e164PhoneSchema.optional(),
    active: z.boolean().optional()
  })
  .strict();
export type CallTrackingNumberUpdate = z.infer<typeof callTrackingNumberUpdateSchema>;

export const callRecordListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    trackingNumberId: z.string().uuid().optional()
  })
  .strict();
export type CallRecordListQuery = z.infer<typeof callRecordListQuerySchema>;

/** Normalized inbound call event every enabled adapter must produce from its webhook payload. */
export const inboundCallEventSchema = z
  .object({
    providerCallId: z.string().trim().regex(/^[A-Za-z0-9._~:-]{1,128}$/u),
    trackingNumber: e164PhoneSchema,
    callerNumber: e164PhoneSchema,
    startedAt: z.string().datetime({ offset: true }),
    /** When the provider emitted this event; checked against the replay window. */
    occurredAt: z.string().datetime({ offset: true }),
    durationSeconds: z.number().int().min(0).max(86_400),
    outcome: registryKey(CALL_OUTCOME_REGISTRY, "call outcome"),
    /** Provider-side recording id/URI only; audio is never stored by Renvani. */
    recordingRef: z.string().trim().min(1).max(512).nullable().optional(),
    recordingDisclosurePlayed: z.boolean().optional(),
    callerConsent: registryKey(CALLER_CONSENT_REGISTRY, "caller consent").optional()
  })
  .strict();
export type InboundCallEvent = z.infer<typeof inboundCallEventSchema>;

export interface CallTrackingSettings {
  provider: string;
  enabled: boolean;
  /** True when the selected adapter is a real (enabled) adapter. */
  providerReady: boolean;
  recordingEnabled: boolean;
  recordingDisclosureEnabled: boolean;
  consentMode: string;
  recordingNoticeState: string | null;
  availableProviders: string[];
  version: number;
  updatedAt: string | null;
}

export interface CallTrackingNumber {
  id: string;
  provider: string;
  trackingNumber: string;
  label: string;
  marketingSource: string;
  marketingCampaign: string | null;
  forwardingNumber: string;
  active: boolean;
  /** Key of CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY, resolved through the provider adapter. */
  verificationStatus: string;
  /** False until the number is verified; unverified numbers never receive or attribute calls. */
  canReceiveCalls: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  trackingNumberId: string;
  provider: string;
  /** Masked caller number, e.g. "***1234". The full number is never stored. */
  callerMasked: string;
  startedAt: string;
  durationSeconds: number;
  outcome: string;
  leadAttribution: Record<string, string> | null;
  recordingRef: string | null;
  recordingDisclosurePlayed: boolean;
  callerConsent: string;
  recordingNoticeState: string | null;
  createdAt: string;
}

export interface CallTrackingSettingsResponse {
  settings: CallTrackingSettings;
}
export interface CallTrackingNumberResponse {
  number: CallTrackingNumber;
}
export interface CallTrackingNumberListResponse {
  numbers: CallTrackingNumber[];
}
export interface CallRecordListResponse {
  calls: CallRecord[];
}
export interface InboundCallWebhookResponse {
  status: "accepted" | "duplicate" | "ignored";
  /** Set on `ignored` when the number exists but is not ownership-verified. */
  reason?: "number_unverified";
  /** True when the provider sent a recording ref that was dropped (no disclosure or consent not satisfied). */
  recordingRefDropped?: boolean;
}
