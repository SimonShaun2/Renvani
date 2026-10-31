import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  checkSavedCardApplyMappingsRateLimit,
  checkSavedCardFallbackEmailRateLimit
} from "../../lib/public-booking-rate-limit.js";
import {
  applySavedCardMigrationMappingsHandler,
  confirmStripeImportHandler,
  getSavedCardMigrationHandler,
  sendSavedCardFallbackEmailHandler,
  startSavedCardMigrationHandler
} from "./handlers.js";
import {
  applyMappingsRouteSchema,
  applyMappingsValidation,
  confirmStripeImportRouteSchema,
  confirmStripeImportValidation,
  getSavedCardMigrationRouteSchema,
  getSavedCardMigrationValidation,
  sendFallbackEmailRouteSchema,
  sendFallbackEmailValidation,
  startSavedCardMigrationRouteSchema,
  startSavedCardMigrationValidation
} from "./schemas.js";

async function sendRateLimited(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.status(429).send({
    error: "RATE_LIMITED",
    message: "Too many requests. Please try again later.",
    requestId: request.id
  });
}

async function applyMappingsRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await checkSavedCardApplyMappingsRateLimit(request.company.id))) {
    await sendRateLimited(request, reply);
  }
}

async function fallbackEmailRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await checkSavedCardFallbackEmailRateLimit(request.company.id))) {
    await sendRateLimited(request, reply);
  }
}

const savedCardMigrationRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.post("/migrate/onboarding/sessions/:bundleId/saved-card-migration", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: startSavedCardMigrationValidation,
    schema: startSavedCardMigrationRouteSchema
  }, startSavedCardMigrationHandler);

  fastify.get("/migrate/onboarding/sessions/:bundleId/saved-card-migration", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: getSavedCardMigrationValidation,
    schema: getSavedCardMigrationRouteSchema
  }, getSavedCardMigrationHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/saved-card-migration/confirm-stripe-import", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: confirmStripeImportValidation,
    schema: confirmStripeImportRouteSchema
  }, confirmStripeImportHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/saved-card-migration/apply-mappings", {
    preHandler: [authenticate, requireOwnerOrAdmin, applyMappingsRateLimit],
    preValidation: applyMappingsValidation,
    schema: applyMappingsRouteSchema
  }, applySavedCardMigrationMappingsHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/saved-card-migration/send-fallback-email", {
    preHandler: [authenticate, requireOwnerOrAdmin, fallbackEmailRateLimit],
    preValidation: sendFallbackEmailValidation,
    schema: sendFallbackEmailRouteSchema
  }, sendSavedCardFallbackEmailHandler);
};

export default savedCardMigrationRoutes;
