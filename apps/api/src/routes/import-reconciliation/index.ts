import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { getImportReconciliationHandler } from "./handlers.js";
import {
  getImportReconciliationRouteSchema,
  importReconciliationParamsValidation
} from "./schemas.js";

const importReconciliationRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.get("/imports/:id/reconciliation", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: importReconciliationParamsValidation,
    schema: getImportReconciliationRouteSchema
  }, getImportReconciliationHandler);
};

export default importReconciliationRoutes;
