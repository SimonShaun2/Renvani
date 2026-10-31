/** Growth — public marketing-site intake (platform-level, unauthenticated, NOT tenant-scoped). */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { MarketingDemoRequestBodySchema, MarketingGrowthCheckBodySchema } from "@fsm/types";

import { hitFixedWindowRateLimit, normalizeRateLimitIp } from "../../../lib/fixed-window-rate-limit.js";
import { submitMarketingDemoRequest, submitMarketingGrowthCheck } from "../../../services/marketing-intake.service.js";
import { withZodValidation } from "../../shared/validation.js";

export const MARKETING_INTAKE_IP_RATE_LIMIT = 5;
export const MARKETING_INTAKE_WINDOW_MS = 60_000;
export const MARKETING_INTAKE_BODY_LIMIT_BYTES = 8 * 1024;

const successSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "confirmationId"],
  properties: { ok: { type: "boolean" }, confirmationId: { type: "string" } }
} as const;

function rateLimit(bucket: "demo" | "growth-check") {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await hitFixedWindowRateLimit({
      key: `fsm:public:marketing:${bucket}:ip:${normalizeRateLimitIp(request.ip)}`,
      limit: MARKETING_INTAKE_IP_RATE_LIMIT,
      windowMs: MARKETING_INTAKE_WINDOW_MS
    });
    if (!result.allowed) {
      reply.header("Retry-After", String(result.retryAfterSeconds));
      await reply.status(429).send({
        error: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        requestId: request.id
      });
    }
  };
}

const publicMarketingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/demo-requests", {
    bodyLimit: MARKETING_INTAKE_BODY_LIMIT_BYTES,
    preValidation: [rateLimit("demo"), withZodValidation({ body: MarketingDemoRequestBodySchema })],
    schema: { tags: ["marketing"], response: { 201: successSchema } }
  }, async (request, reply) => {
    const result = await submitMarketingDemoRequest(request.body as never, request.ip);
    return reply.status(201).send(result);
  });

  fastify.post("/growth-checks", {
    bodyLimit: MARKETING_INTAKE_BODY_LIMIT_BYTES,
    preValidation: [rateLimit("growth-check"), withZodValidation({ body: MarketingGrowthCheckBodySchema })],
    schema: { tags: ["marketing"], response: { 201: successSchema } }
  }, async (request, reply) => {
    const result = await submitMarketingGrowthCheck(request.body as never, request.ip);
    return reply.status(201).send(result);
  });
};

export default publicMarketingRoutes;
