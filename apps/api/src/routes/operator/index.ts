import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  countOperatorInboxHandler,
  editOperatorInboxItemHandler,
  escalateAgentActionHandler,
  getOperatorInboxTimelineHandler,
  getJobProvenanceHandler,
  getOperatorInboxItemHandler,
  listOperatorInboxHandler
} from "./handlers.js";
import {
  editAgentActionValidation,
  escalateAgentActionValidation,
  jobProvenanceValidation,
  listOperatorInboxValidation,
  operatorInboxCountsValidation,
  operatorInboxIdValidation
} from "./schemas.js";

const operatorRoles = requireRole(["owner", "admin", "dispatcher"]);

const operatorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/operator/inbox", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [listOperatorInboxValidation]
  }, listOperatorInboxHandler);

  fastify.get("/operator/inbox/counts", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [operatorInboxCountsValidation]
  }, countOperatorInboxHandler);

  fastify.get("/operator/inbox/:id/timeline", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [operatorInboxIdValidation]
  }, getOperatorInboxTimelineHandler);

  fastify.get("/operator/inbox/:id", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [operatorInboxIdValidation]
  }, getOperatorInboxItemHandler);

  fastify.patch("/operator/inbox/:id", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [editAgentActionValidation]
  }, editOperatorInboxItemHandler);

  // Lives with the operator surface so it shares inbox mapping; path kept under /agent-actions per contract.
  fastify.post("/agent-actions/:id/escalate", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [escalateAgentActionValidation]
  }, escalateAgentActionHandler);

  fastify.get("/operator/jobs/:jobId/provenance", {
    preHandler: [fastify.authenticate, operatorRoles],
    preValidation: [jobProvenanceValidation]
  }, getJobProvenanceHandler);
};

export default operatorRoutes;
