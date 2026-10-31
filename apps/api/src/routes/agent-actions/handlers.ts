import type { FastifyReply, FastifyRequest } from "fastify";

import type { AgentActionState } from "../../services/agent-action.service.js";
import {
  approveAgentAction,
  executeAgentAction,
  getAgentAction,
  listAgentActions,
  rejectAgentAction
} from "../../services/agent-action.service.js";
import type { AgentActionStateChangeBody, ListAgentActionsQuery } from "./schemas.js";

export async function listAgentActionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as ListAgentActionsQuery;
  const filters: { state?: AgentActionState; agentProduct?: string } = {};
  if (query.state !== undefined) {
    filters.state = query.state;
  }
  if (query.agentProduct !== undefined) {
    filters.agentProduct = query.agentProduct;
  }

  const actions = await listAgentActions(request.company.id, filters);
  return reply.send({ items: actions });
}

export async function getAgentActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const action = await getAgentAction(request.company.id, id);
  return reply.send(action);
}

export async function approveAgentActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const action = await approveAgentAction(request.company.id, id, request.user.id, request.body as AgentActionStateChangeBody);
  return reply.send(action);
}

export async function rejectAgentActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const action = await rejectAgentAction(request.company.id, id, request.user.id, request.body as AgentActionStateChangeBody);
  return reply.send(action);
}

export async function executeAgentActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const action = await executeAgentAction(request.company.id, id, request.user.id, request.body as AgentActionStateChangeBody);
  return reply.send(action);
}
