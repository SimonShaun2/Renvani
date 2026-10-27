import type { FastifyReply, FastifyRequest } from "fastify";

import {
  fetchQboCatalog,
  getQboMappingBoard,
  getQboSyncStatus,
  retryQboSyncIssue,
  upsertQboMappings
} from "../../services/qbo-sync.service.js";
import { qboCatalogQuerySchema, qboIssueParamsSchema, upsertQboMappingsBodySchema } from "./schemas.js";

export async function getQboSyncStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const status = await getQboSyncStatus(request.company.id);
  return reply.send(status);
}

export async function getQboMappingBoardHandler(request: FastifyRequest, reply: FastifyReply) {
  const board = await getQboMappingBoard(request.company.id);
  return reply.send(board);
}

export async function putQboMappingsHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = upsertQboMappingsBodySchema.parse(request.body);
  const board = await upsertQboMappings(request.company.id, request.user.id, body);
  return reply.send(board);
}

export async function getQboCatalogHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = qboCatalogQuerySchema.parse(request.query);
  const catalog = await fetchQboCatalog(request.company.id, query.kind);
  return reply.send(catalog);
}

export async function postQboIssueRetryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = qboIssueParamsSchema.parse(request.params);
  const issue = await retryQboSyncIssue(request.company.id, request.user.id, params.issueId);
  return reply.send(issue);
}
