import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  createIntegrationOutboxOperationHandler,
  listIntegrationOutboxAuditEventsHandler,
  listIntegrationOutboxOperationsHandler,
  recordIntegrationOutboxRetryHandler
} from "./handlers.js";
import {
  createIntegrationOutboxOperationRouteSchema,
  createIntegrationOutboxOperationValidation,
  listIntegrationOutboxAuditRouteSchema,
  listIntegrationOutboxAuditValidation,
  listIntegrationOutboxOperationsRouteSchema,
  listIntegrationOutboxOperationsValidation,
  recordIntegrationOutboxRetryRouteSchema,
  recordIntegrationOutboxRetryValidation
} from "./schemas.js";

const integrationOutboxRoutes: FastifyPluginAsync = async (fastify) => {
  const officeRoles = [fastify.authenticate, requireRole(["owner", "admin", "office", "dispatcher"])];

  fastify.get("/integration-outbox/operations", {
    preValidation: [listIntegrationOutboxOperationsValidation],
    preHandler: officeRoles,
    schema: listIntegrationOutboxOperationsRouteSchema
  }, listIntegrationOutboxOperationsHandler);

  fastify.get("/integration-outbox/operations/:operationId/audit-events", {
    preValidation: [listIntegrationOutboxAuditValidation],
    preHandler: officeRoles,
    schema: listIntegrationOutboxAuditRouteSchema
  }, listIntegrationOutboxAuditEventsHandler);

  fastify.post("/integration-outbox/operations", {
    preValidation: [createIntegrationOutboxOperationValidation],
    preHandler: officeRoles,
    schema: createIntegrationOutboxOperationRouteSchema
  }, createIntegrationOutboxOperationHandler);

  fastify.post("/integration-outbox/operations/:operationId/retry-receipts", {
    preValidation: [recordIntegrationOutboxRetryValidation],
    preHandler: officeRoles,
    schema: recordIntegrationOutboxRetryRouteSchema
  }, recordIntegrationOutboxRetryHandler);
};

export default integrationOutboxRoutes;
