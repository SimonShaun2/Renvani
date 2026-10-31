import type { FastifyPluginAsync } from "fastify";

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
};

export default growthCheckRoutes;
