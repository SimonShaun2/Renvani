import { createHmac, timingSafeEqual } from "node:crypto";

/** Max clock skew accepted for svix-timestamp (seconds), matching svix's default. */
export const SVIX_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(raw, "base64");
}

export function signSvixPayload(secret: string, id: string, timestamp: string, payload: string): string {
  return createHmac("sha256", decodeSecret(secret)).update(`${id}.${timestamp}.${payload}`).digest("base64");
}

/** Verifies a svix (Clerk) webhook signature. Returns false on any mismatch. */
export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  payload: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  const timestamp = Number(headers.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > SVIX_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = Buffer.from(signSvixPayload(secret, headers.id, headers.timestamp, payload));

  return headers.signature.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) {
      return false;
    }
    const candidate = Buffer.from(signature);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
