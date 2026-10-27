import type { FastifyReply, FastifyRequest } from "fastify";

import {
  enqueueIntegrationOutboxOperation,
  getIntegrationOutboxAuditTrail,
  getIntegrationOutboxOperationsForCompany,
  recordIntegrationOutboxRetry
} from "../../services/integration-outbox-audit.service.js";
import type {
  CreateIntegrationOutboxOperationBody,
  IntegrationOutboxOperationIdParams,
  ListIntegrationOutboxAuditQuery,
  ListIntegrationOutboxOperationsQuery,
  RecordIntegrationOutboxRetryBody
} from "./schemas.js";

export async function listIntegrationOutboxOperationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const query = request.query as ListIntegrationOutboxOperationsQuery;
  const data = await getIntegrationOutboxOperationsForCompany(request.company.id, {
    ...(query.correlationId !== undefined ? { correlationId: query.correlationId } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {})
  });
  return reply.send({ data });
}

export async function listIntegrationOutboxAuditEventsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { operationId } = request.params as IntegrationOutboxOperationIdParams;
  const query = request.query as ListIntegrationOutboxAuditQuery;
  const data = await getIntegrationOutboxAuditTrail(request.company.id, operationId, query.limit);
  return reply.send({ data });
}

export async function createIntegrationOutboxOperationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const body = request.body as CreateIntegrationOutboxOperationBody;
  const result = await enqueueIntegrationOutboxOperation(request.company.id, body);
  if (!result.created) {
    // Duplicate suppression is logged only (no audit row); ids only, no payload/PII.
    request.log.info(
      { outboxOperationId: result.operation.id, kind: body.kind, adapterId: body.adapterId },
      "integration_outbox.duplicate_suppressed"
    );
  }
  return reply.code(result.created ? 201 : 200).send(result);
}

export async function recordIntegrationOutboxRetryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { operationId } = request.params as IntegrationOutboxOperationIdParams;
  const body = request.body as RecordIntegrationOutboxRetryBody;
  const result = await recordIntegrationOutboxRetry(request.company.id, operationId, body);
  return reply.send(result);
}
