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
}
