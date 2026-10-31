import { CALL_TRACKING_DISABLED_PROVIDER_ID, CALL_TRACKING_PROVIDER_ID_PATTERN } from "@fsm/types";

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

export interface CallTrackingAdapter {
  id: string;
  /** False for the disabled adapter: the webhook rejects before touching the payload. */
  enabled: boolean;
  /** Must be constant-time and fail closed. */
  verifyWebhookSignature(input: CallTrackingWebhookInput): boolean;
  /** Maps the provider payload to the normalized inbound call shape (validated by the caller). */
  parseInboundCall(rawBody: string): unknown;
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
  }
};

registerCallTrackingAdapter(disabledCallTrackingAdapter);
