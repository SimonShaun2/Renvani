import type { FastifyReply, FastifyRequest } from "fastify";

import type { CaptureJobSignatureBody, SubmitFieldWorkSyncBatchBody } from "@fsm/types";

import { captureJobSignature, submitFieldWorkSyncBatch } from "../../services/field-work-sync.service.js";

export async function submitFieldWorkSyncBatchHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as SubmitFieldWorkSyncBatchBody;

  const response = await submitFieldWorkSyncBatch(
    {
      companyId: request.company.id,
      userId: request.user.id,
      role: request.user.role
    },
    body
  );

  return reply.code(200).send(response);
}

/** Dedicated signature endpoint: same validation, idempotency and technician scope as job.signature.capture. */
export async function captureJobSignatureHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as { jobId: string };
  const signature = await captureJobSignature(
    { companyId: request.company.id, userId: request.user.id, role: request.user.role },
    jobId,
    request.body as CaptureJobSignatureBody
  );
  return reply.code(200).send({ signature });
}
