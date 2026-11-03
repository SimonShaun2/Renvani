/**
 * Lean in-memory fixed-window limiter for the public inquiry gate. PER INSTANCE ONLY: each server instance /
 * serverless isolate has its own map, so this is a speed bump, not a guarantee. A shared store (or the API's
 * public-booking IP limit) is the follow-up.
 */
export interface RateLimiter {
  check(key: string, now?: number): { ok: boolean; retryAfterSeconds: number };
}

export function createFixedWindowLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) hits.delete(hits.keys().next().value as string);
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterSeconds: 0 };
      }
      entry.count += 1;
      return entry.count <= limit
        ? { ok: true, retryAfterSeconds: 0 }
        : { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
  };
}

export const HONEYPOT_FIELD = "website";

/**
 * Client IP for the limiter key. Prefers headers the edge sets itself (`x-vercel-forwarded-for`, `x-real-ip`), which
 * a client cannot spoof behind Vercel. Raw `x-forwarded-for` is only a fallback and uses the RIGHT-most value (the hop
 * appended by the nearest proxy); the left-most value is client-controlled when no trusted proxy rewrites the header.
 */
export function clientKey(headers: Headers): string {
  const trusted = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  if (trusted) return trusted;
  const hops = (headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return hops[hops.length - 1] ?? "unknown";
}
