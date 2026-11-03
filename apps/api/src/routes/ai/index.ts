import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  actionRecommendationHandler,
  checkRevenueProposalConsentHandler,
  dismissRecommendationHandler,
  generateRevenueProposalsHandler,
  proposeRecommendationHandler,
  getRecommendationHandler,
  getRevenueSummaryHandler,
  labelPhotoHandler,
  listRecommendationsHandler,
  snoozeRecommendationHandler
} from "./handlers.js";
import {
  actionRecommendationValidation,
  getRecommendationRouteSchema,
  labelPhotoRouteSchema,
  labelPhotoValidation,
  listRecommendationsRouteSchema,
  listRecommendationsValidation,
  mutateRecommendationRouteSchema,
  recommendationIdValidation,
  revenueSummaryRouteSchema,
  snoozeRecommendationValidation,
  dismissRecommendationValidation,
  generateRevenueProposalsRouteSchema,
  generateRevenueProposalsValidation,
  proposeRecommendationRouteSchema,
  proposeRecommendationValidation
} from "./schemas.js";

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);
  const requireRevenueAgentReviewer = requireRole(["owner", "admin", "dispatcher"]);

  fastify.post("/label-photo", {
    preHandler: [authenticate],
    preValidation: [labelPhotoValidation],
    schema: labelPhotoRouteSchema
  }, labelPhotoHandler);

  fastify.get("/revenue-summary", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    schema: revenueSummaryRouteSchema
  }, getRevenueSummaryHandler);

  fastify.get("/recommendations", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: listRecommendationsValidation,
    schema: listRecommendationsRouteSchema
  }, listRecommendationsHandler);

  fastify.get("/recommendations/:id", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: recommendationIdValidation,
    schema: getRecommendationRouteSchema
  }, getRecommendationHandler);

  fastify.post("/recommendations/:id/action", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: actionRecommendationValidation,
    schema: mutateRecommendationRouteSchema
  }, actionRecommendationHandler);

  fastify.post("/recommendations/:id/dismiss", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: dismissRecommendationValidation,
    schema: mutateRecommendationRouteSchema
  }, dismissRecommendationHandler);

  fastify.post("/recommendations/:id/snooze", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: snoozeRecommendationValidation,
    schema: mutateRecommendationRouteSchema
  }, snoozeRecommendationHandler);

  // Revenue Agent: turn recommendations into approval-gated agent-action proposals (idempotent rec:<id>).
  fastify.post("/recommendations/:id/propose", {
    preHandler: [authenticate, requireRevenueAgentReviewer],
    preValidation: proposeRecommendationValidation,
    schema: proposeRecommendationRouteSchema
  }, proposeRecommendationHandler);

  fastify.post("/revenue-agent/proposals/generate", {
    preHandler: [authenticate, requireRevenueAgentReviewer],
    preValidation: generateRevenueProposalsValidation,
    schema: generateRevenueProposalsRouteSchema
  }, generateRevenueProposalsHandler);

  fastify.get("/revenue-agent/proposals/:id/consent", {
    preHandler: [authenticate, requireRevenueAgentReviewer],
    preValidation: proposeRecommendationValidation
  }, checkRevenueProposalConsentHandler);
};

export default aiRoutes;
