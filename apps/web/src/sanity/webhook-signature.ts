import { createHmac, timingSafeEqual } from "node:crypto";

/** Sanity GROQ webhook signature header: `t=<unix ms>,v1=<base64url HMAC-SHA256 of "<t>.<raw body>">`. */
export const SANITY_SIGNATURE_HEADER = "sanity-webhook-signature";
const HEADER_PATTERN = /^t=(\d{13,16})[, ]+v1=([A-Za-z0-9_-]{43})$/;

export type SignatureCheck = "valid" | "missing" | "malformed" | "invalid" | "no-secret";

/** Fails closed: no secret, no header, wrong format or wrong HMAC are all rejections. Compared in constant time. */
export function verifySanitySignature(rawBody: string, header: string | null, secret: string | undefined | null): SignatureCheck {
  if (!secret) return "no-secret";
  if (!header) return "missing";
  const match = HEADER_PATTERN.exec(header.trim());
  if (!match) return "malformed";
  const [, timestamp, provided] = match;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const given = Buffer.from(provided!, "base64url");
  if (given.length !== expected.length) return "malformed";
  return timingSafeEqual(given, expected) ? "valid" : "invalid";
}

/** Test/helper: build a header the way Sanity does. */
export function signSanityPayload(rawBody: string, secret: string, timestamp = Date.now()): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("base64url");
  return `t=${timestamp},v1=${sig}`;
}
