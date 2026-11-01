import type { Queue } from "bullmq";

import { UuidSchema } from "@fsm/types";

import { isJobExhausted } from "./dead-letter-job.js";
import { QUEUE_NAMES } from "./queue-names.js";

export class JobReplayError extends Error {
  readonly code: "NOT_FOUND" | "INVALID_STATE" | "FORBIDDEN" | "VALIDATION_ERROR" | "DEAD_LETTER_ONLY";

  constructor(code: JobReplayError["code"], message: string) {
    super(message);
    this.name = "JobReplayError";
    this.code = code;
  }
}

export type ReplayFailedJobInput = {
  queueName: (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
  jobId: string;
  /** Equality guard only. Authorization is owned by the trusted operations caller. */
  expectedCompanyId: string;
  requestedByUserId: string;
  reason: string;
};

export function resolveCompanyIdFromJobData(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const companyId = (data as { companyId?: unknown }).companyId;

  return typeof companyId === "string" && companyId.length > 0 ? companyId : undefined;
}

export async function replayFailedJobById(
  queue: Pick<Queue, "getJob">,
  input: ReplayFailedJobInput
): Promise<{
  jobId: string;
  queueName: string;
  companyId: string;
  requestedByUserId: string;
  reason: string;
}> {
  const jobId = input.jobId.trim();

  if (!jobId) {
    throw new JobReplayError("VALIDATION_ERROR", "jobId is required");
  }
  const expectedCompanyId = input.expectedCompanyId.trim();
  if (!UuidSchema.safeParse(expectedCompanyId).success) {
    throw new JobReplayError("VALIDATION_ERROR", "expectedCompanyId must be a valid UUID");
  }
  const requestedByUserId = input.requestedByUserId.trim();
  if (!UuidSchema.safeParse(requestedByUserId).success) {
    throw new JobReplayError("VALIDATION_ERROR", "requestedByUserId must be a valid UUID");
  }
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new JobReplayError("VALIDATION_ERROR", "reason must contain between 10 and 500 characters");
  }

  const job = await queue.getJob(jobId);

  if (!job) {
    throw new JobReplayError("NOT_FOUND", `Job ${jobId} was not found on queue ${input.queueName}`);
  }

  const payloadCompanyId = resolveCompanyIdFromJobData(job.data);
  if (
    !payloadCompanyId
    || !UuidSchema.safeParse(payloadCompanyId).success
    || payloadCompanyId !== expectedCompanyId
  ) {
    throw new JobReplayError("FORBIDDEN", "Job does not belong to the expected tenant scope");
  }

  const state = await job.getState();
  if (state !== "failed") {
    throw new JobReplayError(
      "INVALID_STATE",
      `Job ${jobId} is in state "${state}" and cannot be replayed (only failed jobs)`
    );
  }

  // Exhausted jobs already have a retained dead-letter copy. Replaying the source
  // job as well would create a second runnable copy, so the authenticated DLQ
  // recovery path is the sole authority for exhausted work.
  if (isJobExhausted(job)) {
    throw new JobReplayError(
      "DEAD_LETTER_ONLY",
      "Exhausted jobs must be recovered through the dead-letter recovery endpoint"
    );
  }

  // BullMQ atomically checks the failed state, so competing source replays cannot
  // both move the same original job back to waiting.
  await job.retry("failed");

  return {
    jobId,
    queueName: input.queueName,
    companyId: expectedCompanyId,
    requestedByUserId,
    reason
  };
}

export function getQueueByName(
  queues: Record<(typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES], Pick<Queue, "getJob">>,
  queueName: ReplayFailedJobInput["queueName"]
): Pick<Queue, "getJob"> {
  const queue = queues[queueName];

  if (!queue) {
    throw new JobReplayError("VALIDATION_ERROR", `Unknown queue name: ${queueName}`);
  }

  return queue;
}
