import { randomBytes } from "node:crypto";

import { AppError, ErrorCode, webAssistantRequestSchema, webAssistantResponseSchema } from "@fsm/types";
import { isWebAssistantEnabled } from "@fsm/config/feature-flags";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { checkPublicAssistantAnswerRateLimit, checkPublicInquiryRateLimit } from "../../../lib/public-inquiry-rate-limit.js";
import { resolvePublicZipServiceability } from "../../../services/booking.service.js";
import {
  buildServiceInquiryNotes,
  SERVICE_INQUIRY_LEAD_SOURCE,
  validateServiceInquiry
} from "../../../services/public-service-inquiry.logic.js";
import { hitFixedWindowRateLimit, normalizeRateLimitIp } from "../../../lib/fixed-window-rate-limit.js";
import { getPublicStructuredData } from "../../../services/company-home-services.service.js";
import { intakeServicePageInquiry } from "../../../services/revenue-inquiry-intake.service.js";
import { decidePublicWebAssistant } from "../../../services/public-web-assistant.service.js";

import { publicSiteSlugParamsSchema, serviceInquiryBodySchema, zodIssuesToFieldErrors } from "./schemas.js";

const errorBody = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" }
  }
} as const;

// The existing inquiry idempotency column is varchar(128); reserve 14 chars for `web-assistant:`.
const assistantIdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{1,114}$/u);

export const webAssistantRouteSchema = {
  tags: ["public-site"],
  response: {
    200: {
      oneOf: [
        { type: "object", additionalProperties: false, required: ["kind", "verified", "answer", "source"], properties: {
          kind: { type: "string", enum: ["answer"] }, verified: { type: "boolean" },
          answer: { type: "string" }, source: { type: "string", enum: ["public_booking_settings", "zip_serviceability", "unverified"] }
        } },
        { type: "object", additionalProperties: false, required: ["kind", "status", "referenceNumber", "reason", "message"], properties: {
          kind: { type: "string", enum: ["handoff"] }, status: { type: "string", enum: ["pending"] },
          referenceNumber: { type: "string" }, reason: { type: "string" }, message: { type: "string" }
        } }
      ]
    },
    201: { type: "object", additionalProperties: false, required: ["kind", "status", "referenceNumber", "reason", "message"], properties: {
      kind: { type: "string", enum: ["handoff"] }, status: { type: "string", enum: ["pending"] },
      referenceNumber: { type: "string" }, reason: { type: "string" }, message: { type: "string" }
    } },
    400: errorBody,
    404: errorBody,
    409: errorBody,
    429: errorBody,
    503: errorBody
  }
} as const;

export const serviceInquiryRouteSchema = {
  tags: ["public-site"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["inquiry"],
      properties: {
        inquiry: {
          type: "object",
          additionalProperties: false,
          required: ["status", "referenceNumber"],
          properties: {
            status: { type: "string", enum: ["received"] },
            referenceNumber: { type: "string" }
          }
        }
      }
    },
    400: {
      type: "object",
      additionalProperties: false,
      required: ["error", "message", "errors", "requestId"],
      properties: {
        error: { type: "string" },
        message: { type: "string" },
        errors: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["field", "message"],
            properties: { field: { type: "string" }, message: { type: "string" } }
          }
        },
        requestId: { type: "string" }
      }
    },
    404: errorBody,
    429: errorBody
  }
} as const;

/** Per-IP limit for the public JSON-LD endpoint (each call does unauthenticated DB lookups). */
export const PUBLIC_STRUCTURED_DATA_IP_RATE_LIMIT = 30;
export const PUBLIC_STRUCTURED_DATA_WINDOW_MS = 60_000;

async function structuredDataRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = await hitFixedWindowRateLimit({
    key: `fsm:public:structured-data:ip:${normalizeRateLimitIp(request.ip)}`,
    limit: PUBLIC_STRUCTURED_DATA_IP_RATE_LIMIT,
    windowMs: PUBLIC_STRUCTURED_DATA_WINDOW_MS
  });
  if (!result.allowed) {
    reply.header("Retry-After", String(result.retryAfterSeconds));
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      requestId: request.id
    });
  }
}

function decoyReferenceNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/gu, "");
  return `BK-${datePart}-${randomBytes(12).toString("base64url")}`;
}

function notFound(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send({ error: "NOT_FOUND", message: "Shop not found", requestId: request.id });
}

async function submitServiceInquiryHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = publicSiteSlugParamsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields.",
      errors: zodIssuesToFieldErrors(params.error),
      requestId: request.id
    });
  }
  const slug = params.data.slug;

  const limit = await checkPublicInquiryRateLimit(request.ip, slug);
  if (!limit.allowed) {
    void reply.header("Retry-After", String(limit.retryAfterSeconds));
    return reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many inquiries. Please try again later.",
      requestId: request.id
    });
  }

  const validation = validateServiceInquiry(request.body);
  if (validation.honeypot) {
    request.log.info({ slug }, "public service inquiry honeypot tripped; nothing created");
    return reply.status(201).send({ inquiry: { status: "received", referenceNumber: decoyReferenceNumber() } });
  }
  // AGENTS.md rule 7: strict zod shape gate (unknown keys / wrong types) after the honeypot check, so bots still get the decoy.
  const shape = serviceInquiryBodySchema.safeParse(request.body);
  if (!shape.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields.",
      errors: zodIssuesToFieldErrors(shape.error),
      requestId: request.id
    });
  }
  if (!validation.ok) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
      requestId: request.id
    });
  }

  let companyId: string;
  let serviceability: "in_area" | "out_of_area" | "unknown";
  try {
    ({ companyId, serviceability } = await resolvePublicZipServiceability(slug, validation.value.zip));
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) return notFound(request, reply);
    throw error;
  }

  // Inquiry acceptance must match the public serves-zip result: only a positive backend decision is serviceable.
  if (serviceability !== "in_area") {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Please fix the highlighted fields.",
      errors: [{ field: "zip", message: "We don't currently serve this ZIP code" }],
      requestId: request.id
    });
  }

  const value = validation.value;
  const { referenceNumber } = await intakeServicePageInquiry(companyId, {
    firstName: value.firstName,
    lastName: value.lastName,
    phone: value.phone,
    email: value.email,
    zip: value.zip,
    customerNotes: buildServiceInquiryNotes(value),
    leadSource: SERVICE_INQUIRY_LEAD_SOURCE,
    serviceability
  });

  return reply.status(201).send({ inquiry: { status: "received", referenceNumber } });
}

async function webAssistantHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  if (!isWebAssistantEnabled()) {
    return reply.status(503).send({ error: "FEATURE_DISABLED", message: "Web assistant is not available", requestId: request.id });
  }
  const params = publicSiteSlugParamsSchema.safeParse(request.params);
  if (!params.success) return notFound(request, reply);
  const claimedHandoff = request.body !== null && typeof request.body === "object" && !Array.isArray(request.body)
    && (request.body as { action?: unknown }).action === "handoff";
  const limit = await (claimedHandoff ? checkPublicInquiryRateLimit : checkPublicAssistantAnswerRateLimit)(request.ip, params.data.slug);
  if (!limit.allowed) {
    reply.header("Retry-After", String(limit.retryAfterSeconds));
    return reply.status(429).send({ error: "RATE_LIMITED", message: "Too many requests. Please try again later.", requestId: request.id });
  }
  const body = webAssistantRequestSchema.safeParse(request.body);
  if (!body.success) return reply.status(400).send({ error: "VALIDATION_ERROR", message: "Invalid assistant request", requestId: request.id });
  const key = request.headers["idempotency-key"];
  const idempotencyKey = typeof key === "string" ? assistantIdempotencyKeySchema.safeParse(key) : null;
  if (body.data.action === "handoff" && (!idempotencyKey || !idempotencyKey.success)) {
    return reply.status(400).send({ error: "VALIDATION_ERROR", message: "Valid Idempotency-Key header required", requestId: request.id });
  }
  const { created, response } = await decidePublicWebAssistant(params.data.slug, body.data,
    idempotencyKey?.success ? idempotencyKey.data : undefined);
  return reply.status(created ? 201 : 200).send(webAssistantResponseSchema.parse(response));
}

const publicSiteRoutes: FastifyPluginAsync = async (fastify) => {
  // schema.org LocalBusiness JSON-LD (public data only). `script` is pre-escaped for a <script type="application/ld+json">.
  fastify.get("/:slug/structured-data", { preHandler: [structuredDataRateLimit] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = publicSiteSlugParamsSchema.safeParse(request.params);
    if (!params.success) return notFound(request, reply);
    const data = await getPublicStructuredData(params.data.slug);
    return reply.header("Cache-Control", "public, max-age=300").send(data);
  });

  fastify.post("/:slug/inquiry", {
    schema: serviceInquiryRouteSchema,
    bodyLimit: 16 * 1024,
    handler: submitServiceInquiryHandler
  });

  fastify.post("/:slug/assistant", {
    schema: webAssistantRouteSchema,
    bodyLimit: 16 * 1024,
    handler: webAssistantHandler
  });
};

export default publicSiteRoutes;
