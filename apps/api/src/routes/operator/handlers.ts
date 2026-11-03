import type { FastifyReply, FastifyRequest } from "fastify";

import type { AgentActionState } from "../../services/agent-action.service.js";
import { editAgentActionParameters } from "../../services/agent-action.service.js";
import {
  countOperatorInbox,
  getJobTimelineForProvenance,
  getOperatorInboxTimeline,
  getOperatorInboxItem,
  listOperatorInbox
} from "../../services/operator-inbox.service.js";
import type { ListAgentActionsQuery } from "../agent-actions/schemas.js";
import type { EscalateAgentActionBody } from "@fsm/types";

import { escalateAgentAction } from "../../services/agent-action-escalation.service.js";
import type { EditAgentActionBody } from "./schemas.js";

export async function listOperatorInboxHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as ListAgentActionsQuery;
  const filters: { state?: AgentActionState; agentProduct?: string } = {};
  if (query.state !== undefined) {
    filters.state = query.state;
  }
  if (query.agentProduct !== undefined) {
    filters.agentProduct = query.agentProduct;
  }

  const items = await listOperatorInbox(request.company.id, filters);
  return reply.send({ contractVersion: "0.1.0", items });
}

export async function getOperatorInboxItemHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const item = await getOperatorInboxItem(request.company.id, id);
  return reply.send(item);
}

export async function editOperatorInboxItemHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as EditAgentActionBody;
  const patch: { channel?: "sms" | "email"; subject?: string | null; body: string } = { body: body.body };
  if (body.channel !== undefined) {
    patch.channel = body.channel;
  }
  if (body.subject !== undefined) {
    patch.subject = body.subject;
  }

  const action = await editAgentActionParameters(request.company.id, id, request.user.id, patch, {
    expectedVersion: body.expectedVersion
  });
  const item = await getOperatorInboxItem(request.company.id, action.id);
  return reply.send(item);
}

export async function getJobProvenanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string };
  const { eventIds } = request.query as { eventIds: string };
  const parsedIds = eventIds
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const events = await getJobTimelineForProvenance(request.company.id, jobId, parsedIds);
  return reply.send({ items: events });
}

export async function countOperatorInboxHandler(request: FastifyRequest, reply: FastifyReply) {
  const { agentProduct } = request.query as { agentProduct?: string };
  const result = await countOperatorInbox(request.company.id, agentProduct ? { agentProduct } : {});
  return reply.send(result);
}

export async function getOperatorInboxTimelineHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const items = await getOperatorInboxTimeline(request.company.id, id);
  return reply.send({ items });
}

export async function escalateAgentActionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as EscalateAgentActionBody;
  const input: { reason?: string; expectedVersion?: number } = {};
  if (body.reason !== undefined) input.reason = body.reason;
  if (body.expectedVersion !== undefined) input.expectedVersion = body.expectedVersion;
  await escalateAgentAction(request.company.id, id, request.user.id, input);
  const item = await getOperatorInboxItem(request.company.id, id);
  return reply.send(item);
}
