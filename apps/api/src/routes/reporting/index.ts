import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { getDirectDemandHandler, getJobSourceReportingHandler, getRevenueOutcomesHandler } from "./handlers.js";
import {
  directDemandRouteSchema,
  directDemandValidation,
  jobSourceReportingRouteSchema,
  jobSourceReportingValidation,
  revenueOutcomesRouteSchema,
  revenueOutcomesValidation
} from "./schemas.js";

const ownerOrAdmin = requireRole(["owner", "admin"]);
const directDemandRoles = requireRole(["owner", "admin", "dispatcher"]);

const reportingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/reporting/job-sources", {
    preValidation: [jobSourceReportingValidation],
    preHandler: [fastify.authenticate, ownerOrAdmin],
    schema: jobSourceReportingRouteSchema
  }, getJobSourceReportingHandler);

  // Growth (source tracking): Command Center "Direct demand" card.
  fastify.get("/reporting/direct-demand", {
    preValidation: [directDemandValidation],
    preHandler: [fastify.authenticate, directDemandRoles],
    schema: directDemandRouteSchema
  }, getDirectDemandHandler);

  // FS-22 Command Center: revenue outcome instrumentation (owner/admin only).
  fastify.get("/reporting/revenue-outcomes", {
    preValidation: [revenueOutcomesValidation],
    preHandler: [fastify.authenticate, ownerOrAdmin],
    schema: revenueOutcomesRouteSchema
  }, getRevenueOutcomesHandler);
};

export default reportingRoutes;
