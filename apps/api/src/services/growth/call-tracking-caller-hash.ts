import { createHash, createHmac } from "node:crypto";

/**
 * Per-tenant key for caller hashing.
 * - Preferred: HMAC-SHA256(JWT_SECRET, "call-tracking:caller-key:v2:<companyId>"), using the existing
 *   server secret (read lazily at call time, never at boot; no new env var).
 * - Fallback when no secret is configured: SHA-256("call-tracking:caller-key:v2:fallback:<companyId>").
 *   This deterministic salt is NOT secret; hashes are then pseudonymous only. Configure JWT_SECRET in prod.
 */
export function deriveCallerHashKey(companyId: string, secret: string | undefined = process.env.JWT_SECRET): Buffer {
  if (secret && secret.length > 0) {
    return createHmac("sha256", secret).update(`call-tracking:caller-key:v2:${companyId}`).digest();
  }
  return createHash("sha256").update(`call-tracking:caller-key:v2:fallback:${companyId}`).digest();
}

/** Keyed HMAC-SHA256 of the caller number with the per-tenant derived key (hex). */
export function hashCallerNumber(companyId: string, callerNumber: string, secret?: string): string {
  const key = secret === undefined ? deriveCallerHashKey(companyId) : deriveCallerHashKey(companyId, secret);
  return createHmac("sha256", key).update(callerNumber).digest("hex");
}
