import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { captureJobSignatureHandler, submitFieldWorkSyncBatchHandler } from "./handlers.js";
import { captureJobSignatureRouteSchema, captureJobSignatureValidation, submitFieldWorkSyncBatchValidation } from "./schemas.js";

const fieldWorkRoles = requireRole(["owner", "admin", "dispatcher", "technician"]);

const fieldWorkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/field-work/sync/batches", {
    preHandler: [fastify.authenticate, fieldWorkRoles],
    preValidation: [submitFieldWorkSyncBatchValidation]
  }, submitFieldWorkSyncBatchHandler);

  fastify.post("/field-work/jobs/:jobId/signature", {
    preHandler: [fastify.authenticate, fieldWorkRoles],
    preValidation: [captureJobSignatureValidation],
    schema: captureJobSignatureRouteSchema
  }, captureJobSignatureHandler);
};

export default fieldWorkRoutes;
