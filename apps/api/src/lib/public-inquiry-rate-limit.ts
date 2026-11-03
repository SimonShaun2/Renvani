import { hitFixedWindowRateLimit, normalizeRateLimitIp } from "./fixed-window-rate-limit.js";

/**
 * Growth — public service-page inquiry limits. Uses the shared FS-66 fixed-window limiter (Redis via the BullMQ
 * connection, atomic Lua; per-process memory fallback only if Redis is down), so limits hold across instances.
 */
export const PUBLIC_INQUIRY_WINDOW_MS = 10 * 60 * 1000;
export const PUBLIC_INQUIRY_IP_LIMIT = 5;
export const PUBLIC_INQUIRY_SHOP_LIMIT = 60;

export type PublicInquiryRateLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "ip" | "shop"; retryAfterSeconds: number; limit: number };

export async function checkPublicInquiryRateLimit(ipAddress: string, slug: string): Promise<PublicInquiryRateLimitResult> {
  const ip = await hitFixedWindowRateLimit({
    key: `fsm:public-inquiry:rate:ip:${normalizeRateLimitIp(ipAddress)}`,
    limit: PUBLIC_INQUIRY_IP_LIMIT,
    windowMs: PUBLIC_INQUIRY_WINDOW_MS
  });
  if (!ip.allowed) {
    return { allowed: false, scope: "ip", retryAfterSeconds: ip.retryAfterSeconds, limit: PUBLIC_INQUIRY_IP_LIMIT };
  }
  const shop = await hitFixedWindowRateLimit({
    key: `fsm:public-inquiry:rate:shop:${slug.trim().toLowerCase()}`,
    limit: PUBLIC_INQUIRY_SHOP_LIMIT,
    windowMs: PUBLIC_INQUIRY_WINDOW_MS
  });
  if (!shop.allowed) {
    return { allowed: false, scope: "shop", retryAfterSeconds: shop.retryAfterSeconds, limit: PUBLIC_INQUIRY_SHOP_LIMIT };
  }
  return { allowed: true };
}
