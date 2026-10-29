import type { Queue } from "bullmq";

import { QUEUE_NAMES } from "./queues.js";

export class JobReplayError extends Error {
  readonly code: "NOT_FOUND" | "INVALID_STATE" | "FORBIDDEN" | "VALIDATION_ERROR";

  constructor(code: JobReplayError["code"], message: string) {
    super(message);
    this.name = "JobReplayError";
    this.code = code;
  }
}

export type ReplayFailedJobInput = {
  queueName: (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
  jobId: string;
  /** Job payload must include the same `companyId` (tenant-safe replay). */
  expectedCompanyId: string;
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
): Promise<{ jobId: string; queueName: string }> {
  const jobId = input.jobId.trim();

  if (!jobId) {
    throw new JobReplayError("VALIDATION_ERROR", "jobId is required");
  }
  const expectedCompanyId = input.expectedCompanyId.trim();
  if (!expectedCompanyId) {
    throw new JobReplayError("VALIDATION_ERROR", "expectedCompanyId is required");
  }

  const job = await queue.getJob(jobId);

  if (!job) {
    throw new JobReplayError("NOT_FOUND", `Job ${jobId} was not found on queue ${input.queueName}`);
  }

  const state = await job.getState();

  if (state !== "failed") {
    throw new JobReplayError(
      "INVALID_STATE",
      `Job ${jobId} is in state "${state}" and cannot be replayed (only failed jobs)`
    );
  }

  const payloadCompanyId = resolveCompanyIdFromJobData(job.data);
  if (!payloadCompanyId || payloadCompanyId !== expectedCompanyId) {
    throw new JobReplayError("FORBIDDEN", "Job payload companyId does not match expected tenant scope");
  }

  // A failed job at its attempt limit would fail again immediately after replay.
  // BullMQ atomically checks the failed state during retry, so competing replays
  // cannot both move the same job back to waiting.
  const attemptLimit = job.opts.attempts ?? 0;
  const exhausted = attemptLimit > 0 && job.attemptsMade >= attemptLimit;
  await job.retry("failed", exhausted ? { resetAttemptsMade: true } : {});

  return {
    jobId,
    queueName: input.queueName
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
