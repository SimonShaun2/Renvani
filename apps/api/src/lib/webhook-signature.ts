import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shared webhook signature check for provider adapters (FS-200 review nit). The adapter passes its own secret
 * (read lazily by the adapter, never at boot) and the provider's signature + signed timestamp headers.
 * - HMAC-SHA256 over `${timestamp}.${rawBody}` (the common Stripe/Twilio-style scheme; adapters may prefix).
 * - Constant-time comparison (timingSafeEqual) with an explicit length check; any malformed input fails closed.
 * - The signed timestamp must be within `toleranceMs` of now, so the replay window rests on a value the
 *   provider signed rather than on a body field.
 */
export interface SignedWebhookInput {
  secret: string | null | undefined;
  rawBody: string;
  /** Provider signature header value: hex or base64 digest (as configured by `encoding`). */
  signature: string | null | undefined;
  /** Provider signed timestamp header value: unix seconds or milliseconds. */
  timestamp: string | null | undefined;
  toleranceMs: number;
  nowMs?: number;
  encoding?: "hex" | "base64";
}

export type SignedWebhookResult =
  | { ok: true; signedAtMs: number }
  | { ok: false; reason: "missing_secret" | "missing_signature" | "missing_timestamp" | "timestamp_outside_window" | "signature_mismatch" };

export function parseSignedTimestampMs(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,16}$/.test(value.trim())) return null;
  const n = Number(value.trim());
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  // Seconds until year ~5138; anything larger is already milliseconds.
  return n < 100_000_000_000 ? n * 1000 : n;
}

export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function verifySignedWebhook(input: SignedWebhookInput): SignedWebhookResult {
  if (!input.secret) return { ok: false, reason: "missing_secret" };
  if (!input.signature) return { ok: false, reason: "missing_signature" };
  const signedAtMs = parseSignedTimestampMs(input.timestamp);
  if (signedAtMs === null) return { ok: false, reason: "missing_timestamp" };
  const now = input.nowMs ?? Date.now();
  if (Math.abs(now - signedAtMs) > input.toleranceMs) return { ok: false, reason: "timestamp_outside_window" };
  const encoding = input.encoding ?? "hex";
  const expected = createHmac("sha256", input.secret).update(`${input.timestamp!.trim()}.${input.rawBody}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(input.signature.trim(), encoding);
  } catch {
    return { ok: false, reason: "signature_mismatch" };
  }
  return constantTimeEqual(expected, provided) ? { ok: true, signedAtMs } : { ok: false, reason: "signature_mismatch" };
}
