import { createHash } from "node:crypto";

import type { Job, Queue } from "bullmq";
import { Queue as BullQueue } from "bullmq";

import {
  AppError,
  DeadLetterJobEnvelopeV1Schema,
  ErrorCode,
  PlatformQueueNameV1Schema,
  type DeadLetterRecoveryRequestV1
} from "@fsm/types";

import {
  buildDeadLetterEnvelope,
  buildDeadLetterQueueName
} from "./dead-letter-job.js";
import { QUEUE_PREFIX } from "./queue-names.js";
import { queueBaseOptions } from "./queues.js";
import { platformDefaultJobOptions } from "./queue-retry-policy.js";

export { buildDeadLetterEnvelope, buildDeadLetterQueueName, isJobExhausted } from "./dead-letter-job.js";

const deadLetterQueues = new Map<string, Queue>();

type DeadLetterQueueProbe = Pick<Queue, "getJob">;

type DeadLetterRecoveryDeps = {
  getDeadLetterQueue: (sourceQueueName: string) => DeadLetterQueueProbe;
};

function buildDeadLetterOperationJobId(
  operation: "dlq" | "recover",
  sourceQueueName: string,
  operationIdentity: string
): string {
  const digest = createHash("sha256")
    .update(sourceQueueName)
    .update("\0")
    .update(operationIdentity)
    .digest("hex")
    .slice(0, 32);

  // BullMQ rejects custom job IDs containing colon-delimited queue-key parts.
  // A stable digest keeps forwarding/recovery idempotent without leaking raw
  // source identifiers into Redis keys or logs.
  return `${QUEUE_PREFIX}-${operation}-${digest}`;
}

export function buildDeadLetterForwardJobId(
  sourceQueueName: string,
  sourceJobId: string
): string {
  return buildDeadLetterOperationJobId("dlq", sourceQueueName, sourceJobId);
}

export function buildDeadLetterRecoveryJobId(
  sourceQueueName: string,
  deadLetterJobId: string
): string {
  return buildDeadLetterOperationJobId("recover", sourceQueueName, deadLetterJobId);
}

export function getDeadLetterQueue(sourceQueueName: string): Queue {
  const name = buildDeadLetterQueueName(sourceQueueName);
  const existing = deadLetterQueues.get(name);

  if (existing) {
    return existing;
  }

  const queue = new BullQueue(name, {
    ...queueBaseOptions,
    defaultJobOptions: platformDefaultJobOptions({ attempts: 1 })
  });

  deadLetterQueues.set(name, queue);
  return queue;
}

export async function forwardJobToDeadLetter(
  sourceQueueName: string,
  job: Job<Record<string, unknown>>,
  error: Error
): Promise<void> {
  const envelope = buildDeadLetterEnvelope(sourceQueueName, job, error);
  const dlq = getDeadLetterQueue(sourceQueueName);

  await dlq.add(
    envelope.jobName,
    envelope,
    {
      jobId: buildDeadLetterForwardJobId(sourceQueueName, String(job.id))
    }
  );
}

export async function recoverDeadLetterJob(
  sourceQueue: Queue,
  request: DeadLetterRecoveryRequestV1,
  deps: DeadLetterRecoveryDeps = { getDeadLetterQueue }
): Promise<string> {
  const sourceQueueName = PlatformQueueNameV1Schema.parse(request.sourceQueue);

  if (sourceQueue.name !== sourceQueueName) {
    throw new Error("Source queue object does not match recovery request");
  }

  const recoveredJobId = buildDeadLetterRecoveryJobId(
    sourceQueueName,
    request.deadLetterJobId
  );
  const dlq = deps.getDeadLetterQueue(sourceQueueName);
  const deadLetterJob = await dlq.getJob(request.deadLetterJobId);

  if (!deadLetterJob) {
    const existingRecoveredJob = await sourceQueue.getJob(recoveredJobId);

    if (existingRecoveredJob?.id) {
      return String(existingRecoveredJob.id);
    }

    throw new AppError(ErrorCode.NOT_FOUND, "Dead-letter job was not found or recovered");
  }

  const envelope = DeadLetterJobEnvelopeV1Schema.parse(deadLetterJob.data);

  if (envelope.sourceQueue !== sourceQueueName) {
    throw new Error("Dead-letter job source queue mismatch");
  }

  const recovered = await sourceQueue.add(envelope.jobName, envelope.payload, {
    ...platformDefaultJobOptions(),
    jobId: recoveredJobId
  });

  if (!recovered.id) {
    throw new Error("Failed to re-queue recovered job");
  }

  try {
    await deadLetterJob.remove();
  } catch (error: unknown) {
    // A client can retry after losing the first response while the original
    // recovery is still finishing. Both requests may observe the DLQ copy and
    // add the same deterministic source job, but only one can remove the DLQ
    // record. Treat the second removal failure as success only when fresh
    // probes prove that exact transition already completed.
    const [remainingDeadLetterJob, existingRecoveredJob] = await Promise.all([
      dlq.getJob(request.deadLetterJobId),
      sourceQueue.getJob(recoveredJobId)
    ]);

    if (remainingDeadLetterJob || !existingRecoveredJob?.id) {
      throw error;
    }
  }

  return String(recovered.id);
}
