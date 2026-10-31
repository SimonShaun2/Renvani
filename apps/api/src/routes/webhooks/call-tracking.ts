import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { hitFixedWindowRateLimit, normalizeRateLimitIp } from "../../lib/fixed-window-rate-limit.js";
import {
  CALL_TRACKING_WEBHOOK_IP_LIMIT,
  CALL_TRACKING_WEBHOOK_WINDOW_MS,
  ingestInboundCall
} from "../../services/growth/call-tracking.service.js";

const providerParams = z.object({ providerId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u) }).strict();

/**
 * FS-200: inbound call events. POST /api/v1/webhooks/call-tracking/:providerId
 * The built-in `disabled` adapter rejects with 503 before the body is touched. No payload or caller data is logged.
 */
const callTrackingWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Keep the raw body: providers sign the exact bytes.
  fastify.addContentTypeParser(
    ["application/json", "application/x-www-form-urlencoded"],
    { parseAs: "string", bodyLimit: 64 * 1024 },
    (_request, body, done) => done(null, body)
  );

  fastify.post("/call-tracking/:providerId", async (request, reply) => {
    // Per-IP limit first, before any provider lookup, signature check or parsing.
    const ipLimit = await hitFixedWindowRateLimit({
      key: `fsm:webhook:call-tracking:ip:${normalizeRateLimitIp(request.ip)}`,
      limit: CALL_TRACKING_WEBHOOK_IP_LIMIT,
      windowMs: CALL_TRACKING_WEBHOOK_WINDOW_MS
    });
    if (!ipLimit.allowed) {
      reply.header("Retry-After", String(ipLimit.retryAfterSeconds));
      return reply.status(429).send({ error: "RATE_LIMITED" });
    }
    const params = providerParams.safeParse(request.params);
    if (!params.success) return reply.status(404).send({ error: "UNKNOWN_PROVIDER" });
    const headers: Record<string, string | undefined> = {};
    for (const [name, value] of Object.entries(request.headers)) headers[name] = Array.isArray(value) ? value[0] : value;
    const result = await ingestInboundCall(params.data.providerId, {
      headers,
      rawBody: typeof request.body === "string" ? request.body : "",
      url: `${request.protocol}://${request.hostname}${request.url}`
    });
    if ("error" in result) {
      if (result.httpStatus === 429) reply.header("Retry-After", String(result.retryAfterSeconds));
      return reply.status(result.httpStatus).send({ error: result.error });
    }
    return reply.status(result.httpStatus).send(result.body);
  });
};

export default callTrackingWebhookRoutes;
