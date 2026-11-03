import type { FastifyReply, FastifyRequest } from "fastify";

import { listOpenQboSyncIssues, resolveQboSyncIssue } from "../../../services/qbo-sync-issue.service.js";
import { listQboSyncIssuesQuerySchema, resolveQboSyncIssueParamsSchema } from "./schemas.js";

export async function listQboSyncIssuesHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = listQboSyncIssuesQuerySchema.parse(request.query);
  const issues = await listOpenQboSyncIssues({
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {})
  });
  return reply.send({ issues });
}

export async function resolveQboSyncIssueHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = resolveQboSyncIssueParamsSchema.parse(request.params);
  await resolveQboSyncIssue({ issueId: params.issueId, resolvedById: request.user.id });
  return reply.code(204).send();
}
