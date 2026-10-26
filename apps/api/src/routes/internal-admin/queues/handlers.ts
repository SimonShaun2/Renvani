import type { FastifyReply, FastifyRequest } from "fastify";

import { DeadLetterRecoveryRequestV1Schema, QUEUE_PLATFORM_CONTRACT_VERSION } from "@fsm/types";

import {
  fetchPlatformDeadLetterJobs,
  fetchPlatformFailedJobsWithReplayMetadata,
  fetchPlatformQueueMonitoringSnapshot,
  recoverPlatformDeadLetterJob
} from "../../../services/queue-monitoring.service.js";
import {
  queueNameParamsSchema,
  recoverDeadLetterJobParamsSchema,
  tenantScopedQueueJobsQuerySchema
} from "./schemas.js";

export async function getPlatformQueueMonitoringHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const snapshot = await fetchPlatformQueueMonitoringSnapshot();
  return reply.send(snapshot);
}

export async function listPlatformDeadLetterJobsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = queueNameParamsSchema.parse(request.params);
  const query = tenantScopedQueueJobsQuerySchema.parse(request.query);
  const jobs = await fetchPlatformDeadLetterJobs(params.queueName, {
    companyId: query.companyId,
    ...(query.start !== undefined ? { start: query.start } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {})
  });
  return reply.send(jobs);
}

export async function listPlatformFailedJobsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = queueNameParamsSchema.parse(request.params);
  const query = tenantScopedQueueJobsQuerySchema.parse(request.query);
  const jobs = await fetchPlatformFailedJobsWithReplayMetadata(params.queueName, {
    companyId: query.companyId,
    ...(query.start !== undefined ? { start: query.start } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {})
  });
  return reply.send(jobs);
}

export async function recoverPlatformDeadLetterJobHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = recoverDeadLetterJobParamsSchema.parse(request.params);
  const body = DeadLetterRecoveryRequestV1Schema.parse({
    contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
    sourceQueue: params.queueName,
    deadLetterJobId: params.deadLetterJobId,
    requestedByUserId: request.user?.id
  });
  const result = await recoverPlatformDeadLetterJob(params.queueName, body);
  return reply.code(202).send(result);
}
