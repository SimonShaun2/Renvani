import "../../services/revenue-agent/revenue-proposal.kinds.js";
import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  approveAgentActionHandler,
  executeAgentActionHandler,
  getAgentActionHandler,
  listAgentActionsHandler,
  rejectAgentActionHandler
} from "./handlers.js";
import {
  agentActionGuardedStateChangeValidation,
  agentActionIdValidation,
  agentActionStateChangeValidation,
  listAgentActionsValidation
} from "./schemas.js";

const agentActionRoles = requireRole(["owner", "admin", "dispatcher"]);

const agentActionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/agent-actions", {
    onRequest: [fastify.authenticate, agentActionRoles],
    preValidation: [listAgentActionsValidation]
  }, listAgentActionsHandler);

  fastify.get("/agent-actions/:id", {
    onRequest: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionIdValidation]
  }, getAgentActionHandler);

  fastify.post("/agent-actions/:id/approve", {
    onRequest: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionGuardedStateChangeValidation]
  }, approveAgentActionHandler);

  fastify.post("/agent-actions/:id/reject", {
    onRequest: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionStateChangeValidation]
  }, rejectAgentActionHandler);

  fastify.post("/agent-actions/:id/execute", {
    onRequest: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionGuardedStateChangeValidation]
  }, executeAgentActionHandler);
};

export default agentActionRoutes;
