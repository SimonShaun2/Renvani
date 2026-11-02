import type { FastifyPluginAsync, preValidationHookHandler } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  enqueueGrowthCheckScanHandler,
  getGrowthCheckFindingHandler,
  getGrowthCheckScanHandler,
  listGrowthCheckScanFindingsHandler,
  listGrowthCheckScansHandler,
  reviewGrowthCheckFindingHandler
} from "./handlers.js";
import {
  enqueueGrowthCheckScanValidation,
  getGrowthCheckFindingValidation,
  getGrowthCheckScanValidation,
  listGrowthCheckScanFindingsValidation,
  listGrowthCheckScansValidation,
  reviewGrowthCheckFindingValidation
} from "./schemas.js";
import * as reportHandlers from "./report-handlers.js";
import * as reportSchemas from "./report-schemas.js";

const growthCheckRoles = requireRole(["owner", "admin", "dispatcher"]);
/** FS-56: findings review and audit history are owner/admin only (owner_* answers are owner-only in the service). */
const growthCheckReviewRoles = requireRole(["owner", "admin"]);

const growthCheckRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/growth-check/scans", {
    preHandler: [fastify.authenticate, growthCheckRoles],
    preValidation: [enqueueGrowthCheckScanValidation]
  }, enqueueGrowthCheckScanHandler);

  fastify.get("/growth-check/scans/:scanId", {
    preHandler: [fastify.authenticate, growthCheckRoles],
    preValidation: [getGrowthCheckScanValidation]
  }, getGrowthCheckScanHandler);

  fastify.get("/growth-check/scans", {
    // Auth and role run before validation so unauthenticated/forbidden callers never see schema errors.
    preHandler: [fastify.authenticate, growthCheckReviewRoles, listGrowthCheckScansValidation]
  }, listGrowthCheckScansHandler);

  fastify.get("/growth-check/scans/:scanId/findings", {
    // Auth and role run before validation so unauthenticated/forbidden callers never see schema errors.
    preHandler: [fastify.authenticate, growthCheckReviewRoles, listGrowthCheckScanFindingsValidation]
  }, listGrowthCheckScanFindingsHandler);

  fastify.get("/growth-check/findings/:findingId", {
    // Auth and role run before validation so unauthenticated/forbidden callers never see schema errors.
    preHandler: [fastify.authenticate, growthCheckReviewRoles, getGrowthCheckFindingValidation]
  }, getGrowthCheckFindingHandler);

  fastify.post("/growth-check/findings/:findingId/reviews", {
    // Auth and role run before validation so unauthenticated/forbidden callers never see schema errors.
    preHandler: [fastify.authenticate, growthCheckReviewRoles, reviewGrowthCheckFindingValidation]
  }, reviewGrowthCheckFindingHandler);

  // FS-57 owner report drafts, preview, export and share snapshots (owner/admin; auth + role before validation).
  const pre = (validation: preValidationHookHandler) => ({
    preHandler: [fastify.authenticate, growthCheckReviewRoles, validation]
  });
  fastify.post("/growth-check/scans/:scanId/report-draft", pre(reportSchemas.createReportDraftValidation), reportHandlers.createReportDraftHandler);
  fastify.get("/growth-check/scans/:scanId/report-draft", pre(reportSchemas.getScanReportDraftValidation), reportHandlers.getScanReportDraftHandler);
  fastify.get("/growth-check/report-drafts/:draftId", pre(reportSchemas.getReportDraftValidation), reportHandlers.getReportDraftHandler);
  fastify.patch("/growth-check/report-drafts/:draftId", pre(reportSchemas.editReportDraftValidation), reportHandlers.editReportDraftHandler);
  fastify.post("/growth-check/report-drafts/:draftId/approve", pre(reportSchemas.approveReportDraftValidation), reportHandlers.approveReportDraftHandler);
  fastify.get("/growth-check/report-drafts/:draftId/preview", pre(reportSchemas.getReportDraftValidation), reportHandlers.previewReportDraftHandler);
  fastify.get("/growth-check/report-drafts/:draftId/export", pre(reportSchemas.exportReportDraftValidation), reportHandlers.exportReportDraftHandler);
  fastify.post("/growth-check/report-drafts/:draftId/shares", pre(reportSchemas.createReportShareValidation), reportHandlers.createReportShareHandler);
  fastify.get("/growth-check/report-drafts/:draftId/shares", pre(reportSchemas.getReportDraftValidation), reportHandlers.listReportSharesHandler);
  fastify.post("/growth-check/report-shares/:shareId/revoke", pre(reportSchemas.revokeReportShareValidation), reportHandlers.revokeReportShareHandler);
  fastify.post("/growth-check/report-shares/:shareId/deliveries", pre(reportSchemas.reportDeliveryValidation), reportHandlers.reportDeliveryHandler);
};

export default growthCheckRoutes;
