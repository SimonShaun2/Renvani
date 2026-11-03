import type { Job } from "bullmq";

import {
  FailedJobReplayListV1Schema,
  QUEUE_PLATFORM_CONTRACT_VERSION,
  type FailedJobReplayListV1,
  type PlatformQueueNameV1
} from "@fsm/types";

import { resolveCompanyIdFromJobData } from "./job-replay.js";
import type { QueueMonitoringProbe } from "./queue-monitoring.js";

function jobFailedAtIso(job: Job): string | null {
  const finishedOn = job.finishedOn;

  if (typeof finishedOn === "number" && finishedOn > 0) {
    return new Date(finishedOn).toISOString();
  }

  return null;
}

function toReplayRow(
  queueName: PlatformQueueNameV1,
  job: Job,
  companyId: string
): FailedJobReplayListV1["jobs"][number] | null {
  const payloadCompanyId = resolveCompanyIdFromJobData(job.data);

  if (!payloadCompanyId || payloadCompanyId !== companyId) {
    return null;
  }

  const jobName = typeof job.name === "string" && job.name.length > 0 ? job.name : "unknown";

  return {
    jobId: String(job.id),
    queueName,
    jobName,
    companyId: payloadCompanyId,
    attemptsMade: job.attemptsMade ?? 0,
    failedAt: jobFailedAtIso(job),
    failedReason: job.failedReason ?? null,
    replayable: true
  };
}

export async function listFailedJobsWithReplayMetadata(
  sourceQueue: PlatformQueueNameV1,
  queue: Pick<QueueMonitoringProbe, "getFailed">,
  options: { companyId: string; start?: number; limit?: number }
): Promise<FailedJobReplayListV1> {
  const start = options.start ?? 0;
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const companyId = options.companyId;

  const failed = await queue.getFailed(start, start + limit);
  const hasMore = failed.length > limit;
  const page = hasMore ? failed.slice(0, limit) : failed;

  const jobs = page
    .map((job) => toReplayRow(sourceQueue, job, companyId))
    .filter((row): row is FailedJobReplayListV1["jobs"][number] => row !== null);

  const nextCursor = hasMore ? String(start + limit) : null;

  return FailedJobReplayListV1Schema.parse({
    contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
    sourceQueue,
    companyId,
    jobs,
    nextCursor
  });
}
