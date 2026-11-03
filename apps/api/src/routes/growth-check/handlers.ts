import type { GrowthCheckFindingReviewBody } from "@fsm/types";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  enqueueGrowthCheckPublicScan,
  getGrowthCheckScan
} from "../../services/growth-check.service.js";
import {
  getGrowthCheckFindingDetail,
  listGrowthCheckScanFindings,
  listGrowthCheckScanHistory,
  reviewGrowthCheckFinding
} from "../../services/growth-check-findings-review.service.js";
import type { EnqueueGrowthCheckScanBody } from "./schemas.js";

export async function enqueueGrowthCheckScanHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as EnqueueGrowthCheckScanBody;

  const scan = await enqueueGrowthCheckPublicScan(request.company.id, request.user.id, {
    targetUrl: body.targetUrl,
    ...(body.rubricId === undefined ? {} : { rubricId: body.rubricId }),
    ...(body.idempotencyKey === undefined ? {} : { idempotencyKey: body.idempotencyKey })
  });

  return reply.code(201).send(scan);
}

export async function getGrowthCheckScanHandler(request: FastifyRequest, reply: FastifyReply) {
  const { scanId } = request.params as { scanId: string };

  const scan = await getGrowthCheckScan(request.company.id, scanId);

  return reply.send(scan);
}

export async function listGrowthCheckScansHandler(request: FastifyRequest, reply: FastifyReply) {
  const { limit } = request.query as { limit?: number };
  return reply.send(await listGrowthCheckScanHistory(request.company.id, limit ?? 20));
}

export async function listGrowthCheckScanFindingsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { scanId } = request.params as { scanId: string };
  return reply.send(await listGrowthCheckScanFindings(request.company.id, scanId));
}

export async function getGrowthCheckFindingHandler(request: FastifyRequest, reply: FastifyReply) {
  const { findingId } = request.params as { findingId: string };
  return reply.send(await getGrowthCheckFindingDetail(request.company.id, findingId));
}

export async function reviewGrowthCheckFindingHandler(request: FastifyRequest, reply: FastifyReply) {
  const { findingId } = request.params as { findingId: string };
  const result = await reviewGrowthCheckFinding(
    { companyId: request.company.id, userId: request.user.id, role: request.user.role },
    findingId,
    request.body as GrowthCheckFindingReviewBody
  );
  return reply.code(result.replayed ? 200 : 201).send(result);
}
