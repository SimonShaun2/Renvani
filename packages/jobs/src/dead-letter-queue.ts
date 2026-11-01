import { createHash } from "node:crypto";

import type { Job, Queue } from "bullmq";
import { Queue as BullQueue } from "bullmq";

import {
  DeadLetterJobEnvelopeV1Schema,
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
  sourceJobId: string
): string {
  const digest = createHash("sha256")
    .update(sourceQueueName)
    .update("\0")
    .update(sourceJobId)
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
  sourceJobId: string
): string {
  return buildDeadLetterOperationJobId("recover", sourceQueueName, sourceJobId);
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
  const dlq = deps.getDeadLetterQueue(request.sourceQueue);
  const deadLetterJob = await dlq.getJob(request.deadLetterJobId);

  if (!deadLetterJob) {
    throw new Error("Dead-letter job not found");
  }

  const envelope = DeadLetterJobEnvelopeV1Schema.parse(deadLetterJob.data);

  if (envelope.sourceQueue !== request.sourceQueue) {
    throw new Error("Dead-letter job source queue mismatch");
  }

  const recovered = await sourceQueue.add(envelope.jobName, envelope.payload, {
    ...platformDefaultJobOptions(),
    jobId: buildDeadLetterRecoveryJobId(request.sourceQueue, envelope.sourceJobId)
  });

  if (!recovered.id) {
    throw new Error("Failed to re-queue recovered job");
  }

  await deadLetterJob.remove();
  return String(recovered.id);
}
