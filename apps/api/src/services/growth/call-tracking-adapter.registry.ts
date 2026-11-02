import {
  CALL_TRACKING_DISABLED_PROVIDER_ID,
  CALL_TRACKING_NUMBER_DEFAULT_VERIFICATION_STATUS,
  CALL_TRACKING_PROVIDER_ID_PATTERN
} from "@fsm/types";

/**
 * FS-200 Growth: call tracking + recording adapter registry. Same plug-in pattern as the GBP and geo registries:
 * text ids, no pgEnum. The only built-in adapter is `disabled`: it makes no network calls, reads no env vars or
 * keys, rejects every webhook signature and never yields a call. A real provider registers itself here later
 * (with its own lazily-read credentials) and a shop selects it in settings.
 */
export interface CallTrackingWebhookInput {
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: string;
  /** Public URL the provider signed, when the provider signs the URL. */
  url: string;
}

export interface CallTrackingNumberOwnershipInput {
  trackingNumber: string;
  providerNumberId: string | null;
}

/**
 * Ownership result. A bare status string is still accepted. When the provider reports when it verified the
 * number (`verifiedAt`, ISO-8601), the service only honors `verified` while that timestamp is fresh
 * (see CALL_TRACKING_OWNERSHIP_MAX_AGE_MS); a missing/invalid/future/stale timestamp fails closed.
 */
export type CallTrackingNumberOwnershipResult = string | { status: string; verifiedAt?: string | null };

export interface CallTrackingAdapter {
  id: string;
  /** False for the disabled adapter: the webhook rejects before touching the payload. */
  enabled: boolean;
  /**
   * Must be constant-time (timingSafeEqual) and fail closed. Real adapters should use
   * verifySignedWebhook() from lib/webhook-signature.ts, which signs `${timestamp}.${rawBody}`.
   */
  verifyWebhookSignature(input: CallTrackingWebhookInput): boolean;
  /**
   * Provider's signed timestamp (ms since epoch) for this delivery, read from the signed header. When an adapter
   * implements this, the replay window uses it instead of the body's occurredAt, and a missing value is rejected.
   * Only called after verifyWebhookSignature returned true.
   */
  signedTimestampMs?(input: CallTrackingWebhookInput): number | null;
  /** Maps the provider payload to the normalized inbound call shape (validated by the caller). */
  parseInboundCall(rawBody: string): unknown;
  /**
   * Confirms with the provider that this account owns the number. Returns a key of
   * CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY; anything else is treated as unverified.
   */
  verifyNumberOwnership(number: CallTrackingNumberOwnershipInput): Promise<CallTrackingNumberOwnershipResult>;
}

const adapters = new Map<string, CallTrackingAdapter>();

export function registerCallTrackingAdapter(adapter: CallTrackingAdapter): void {
  if (!CALL_TRACKING_PROVIDER_ID_PATTERN.test(adapter.id)) {
    throw new Error(`Invalid call tracking adapter id: ${adapter.id}`);
  }
  adapters.set(adapter.id, adapter);
}

/** Test/support hook: remove a registered adapter. The disabled adapter can never be removed. */
export function unregisterCallTrackingAdapter(id: string): void {
  if (id !== CALL_TRACKING_DISABLED_PROVIDER_ID) adapters.delete(id);
}

export function findCallTrackingAdapter(id: string): CallTrackingAdapter | null {
  return adapters.get(id) ?? null;
}

export function listCallTrackingAdapterIds(): string[] {
  return [...adapters.keys()];
}

export const disabledCallTrackingAdapter: CallTrackingAdapter = {
  id: CALL_TRACKING_DISABLED_PROVIDER_ID,
  enabled: false,
  verifyWebhookSignature: () => false,
  parseInboundCall: () => {
    throw new Error("Call tracking adapter is disabled");
  },
  // No provider to ask: ownership can never be verified, so numbers stay unverified and receive no calls.
  verifyNumberOwnership: () => Promise.resolve(CALL_TRACKING_NUMBER_DEFAULT_VERIFICATION_STATUS)
};

registerCallTrackingAdapter(disabledCallTrackingAdapter);
