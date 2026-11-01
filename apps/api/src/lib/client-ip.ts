import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import type { FastifyRequest } from "fastify";

import { env } from "@fsm/config";

export const ORIGIN_SECRET_HEADER = "x-origin-secret";

function headerValue(request: Pick<FastifyRequest, "headers">, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Constant-time compare; different lengths compare against a same-length buffer and return false. */
export function originSecretMatches(provided: string | undefined, expected: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided ?? "", "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf); // keep timing independent of where lengths differ
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

function firstValidIp(raw: string | undefined): string | null {
  const candidate = raw?.split(",")[0]?.trim() ?? "";
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

/**
 * Client IP for per-IP rate limits.
 * - ORIGIN_SECRET unset/blank: request.ip (TRUST_PROXY_HOPS), exactly as before.
 * - Set: only when `x-origin-secret` matches (constant time) is the visitor IP taken from
 *   x-vercel-forwarded-for, else x-real-ip (must be a valid IP). Otherwise forwarded headers are ignored.
 * Never logs the secret or header values.
 */
export function resolveClientIp(
  request: Pick<FastifyRequest, "headers" | "ip">,
  secret: string | undefined = env.ORIGIN_SECRET
): string {
  const expected = secret?.trim() ?? "";
  if (!expected) return request.ip;
  if (!originSecretMatches(headerValue(request, ORIGIN_SECRET_HEADER), expected)) return request.ip;
  return (
    firstValidIp(headerValue(request, "x-vercel-forwarded-for")) ??
    firstValidIp(headerValue(request, "x-real-ip")) ??
    request.ip
  );
}
