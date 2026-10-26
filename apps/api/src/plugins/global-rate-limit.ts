import { env } from "@fsm/config";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { hitFixedWindowRateLimit, normalizeRateLimitIp } from "../lib/fixed-window-rate-limit.js";

/**
 * FS-66 — global per-IP rate limit for the API.
 * Health checks, inbound webhooks (Clerk/svix; Stripe lands on apps/webhook) and CORS preflights are never throttled.
 */
export interface GlobalRateLimitOptions {
  enabled?: boolean;
  max?: number;
  windowMs?: number;
}

/** Inbound webhook routes (Clerk/svix). Stripe webhooks are served by apps/webhook, not this API. */
const EXCLUDED_PREFIXES = ["/api/v1/webhooks/"];

export function isGlobalRateLimitExcluded(request: Pick<FastifyRequest, "method" | "url">): boolean {
  if (request.method === "OPTIONS") return true;
  const path = request.url.split("?")[0] ?? "";
  if (path === "/health" || path.startsWith("/health/")) return true;
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function resolveGlobalRateLimitConfig(): Required<GlobalRateLimitOptions> {
  const flag = env.GLOBAL_RATE_LIMIT_ENABLED;
  return {
    enabled: flag === undefined ? env.NODE_ENV !== "test" : flag === "true",
    max: env.GLOBAL_RATE_LIMIT_MAX,
    windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_SECONDS * 1000
  };
}

const globalRateLimitPlugin = fp<GlobalRateLimitOptions>(async (fastify, options) => {
  const defaults = resolveGlobalRateLimitConfig();
  const config = {
    enabled: options.enabled ?? defaults.enabled,
    max: options.max ?? defaults.max,
    windowMs: options.windowMs ?? defaults.windowMs
  };
  if (!config.enabled) return;

  fastify.addHook("onRequest", async (request, reply) => {
    if (isGlobalRateLimitExcluded(request)) return;
    const result = await hitFixedWindowRateLimit({
      key: `fsm:global:rate:ip:${normalizeRateLimitIp(request.ip)}`,
      limit: config.max,
      windowMs: config.windowMs
    });
    reply.header("X-RateLimit-Limit", String(result.limit));
    reply.header("X-RateLimit-Remaining", String(Math.max(0, result.limit - result.count)));
    if (!result.allowed) {
      reply.header("Retry-After", String(result.retryAfterSeconds));
      return reply.status(429).send({
        error: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        requestId: request.id
      });
    }
  });
});

export default globalRateLimitPlugin;
