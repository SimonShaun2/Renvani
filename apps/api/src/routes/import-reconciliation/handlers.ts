import type { FastifyReply, FastifyRequest } from "fastify";

import { getImportSessionReconciliation } from "../../services/import-session-reconciliation.service.js";

export async function getImportReconciliationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const importSessionId = (request.params as { id: string }).id;
  const response = await getImportSessionReconciliation(request.company.id, importSessionId);
  return reply.code(200).send(response);
}
