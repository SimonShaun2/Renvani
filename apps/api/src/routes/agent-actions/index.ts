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
  agentActionIdValidation,
  listAgentActionsValidation
} from "./schemas.js";

const agentActionRoles = requireRole(["owner", "admin", "dispatcher"]);

const agentActionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/agent-actions", {
    preHandler: [fastify.authenticate, agentActionRoles],
    preValidation: [listAgentActionsValidation]
  }, listAgentActionsHandler);

  fastify.get("/agent-actions/:id", {
    preHandler: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionIdValidation]
  }, getAgentActionHandler);

  fastify.post("/agent-actions/:id/approve", {
    preHandler: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionIdValidation]
  }, approveAgentActionHandler);

  fastify.post("/agent-actions/:id/reject", {
    preHandler: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionIdValidation]
  }, rejectAgentActionHandler);

  fastify.post("/agent-actions/:id/execute", {
    preHandler: [fastify.authenticate, agentActionRoles],
    preValidation: [agentActionIdValidation]
  }, executeAgentActionHandler);
};

export default agentActionRoutes;
