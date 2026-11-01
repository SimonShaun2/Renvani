import { createHash } from "node:crypto";

import { hitFixedWindowRateLimit, normalizeRateLimitIp } from "./fixed-window-rate-limit.js";

/**
 * Public hosted-checkout fallback (POST /public/pay/:token/hosted-checkout) creates Stripe Checkout Sessions
 * unauthenticated, so it is limited per IP and per payment token with the shared FS-66 fixed-window limiter
 * (Redis via the BullMQ connection, atomic Lua; per-process memory fallback only if Redis is down).
 */
export const HOSTED_CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
export const HOSTED_CHECKOUT_IP_LIMIT = 20;
export const HOSTED_CHECKOUT_TOKEN_LIMIT = 10;

export type HostedCheckoutRateLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "ip" | "token"; retryAfterSeconds: number };

function tokenKey(token: string): string {
  // Never put the bearer payment token itself in a Redis key.
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

export async function checkHostedCheckoutRateLimit(ipAddress: string, token: string): Promise<HostedCheckoutRateLimitResult> {
  const ip = await hitFixedWindowRateLimit({
    key: `fsm:public-hosted-checkout:rate:ip:${normalizeRateLimitIp(ipAddress)}`,
    limit: HOSTED_CHECKOUT_IP_LIMIT,
    windowMs: HOSTED_CHECKOUT_WINDOW_MS
  });
  if (!ip.allowed) return { allowed: false, scope: "ip", retryAfterSeconds: ip.retryAfterSeconds };
  const byToken = await hitFixedWindowRateLimit({
    key: `fsm:public-hosted-checkout:rate:token:${tokenKey(token)}`,
    limit: HOSTED_CHECKOUT_TOKEN_LIMIT,
    windowMs: HOSTED_CHECKOUT_WINDOW_MS
  });
  if (!byToken.allowed) return { allowed: false, scope: "token", retryAfterSeconds: byToken.retryAfterSeconds };
  return { allowed: true };
}
