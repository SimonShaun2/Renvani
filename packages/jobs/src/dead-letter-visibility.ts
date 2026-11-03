import type { Job } from "bullmq";

import {
  DeadLetterJobEnvelopeV1Schema,
  DeadLetterJobListV1Schema,
  QUEUE_PLATFORM_CONTRACT_VERSION,
  type DeadLetterJobListV1,
  type DeadLetterJobSummaryV1,
  type PlatformQueueNameV1
} from "@fsm/types";

import { buildDeadLetterQueueName } from "./dead-letter-job.js";
import type { QueueMonitoringProbe } from "./queue-monitoring.js";

export type DeadLetterListProbe = Pick<QueueMonitoringProbe, "getWaiting" | "getDelayed" | "getFailed">;

function envelopeToSummary(
  sourceQueue: PlatformQueueNameV1,
  job: Job
): DeadLetterJobSummaryV1 | null {
  const parsed = DeadLetterJobEnvelopeV1Schema.safeParse(job.data);

  if (!parsed.success) {
    return null;
  }

  const envelope = parsed.data;

  return {
    deadLetterJobId: String(job.id),
    sourceQueue,
    sourceJobId: envelope.sourceJobId,
    jobName: envelope.jobName,
    companyId: envelope.companyId,
    attemptsMade: envelope.attemptsMade,
    failedAt: envelope.failedAt,
    failureClass: envelope.failureClass,
    errorMessage: envelope.errorMessage
  };
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function listDeadLetterJobs(
  sourceQueue: PlatformQueueNameV1,
  deadLetterQueue: DeadLetterListProbe,
  options: { start?: number; limit?: number; companyId?: string } = {}
): Promise<DeadLetterJobListV1> {
  const start = options.start ?? 0;
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);

  const waiting = await deadLetterQueue.getWaiting(start, start + limit);
  const hasMore = waiting.length > limit;
  const page = hasMore ? waiting.slice(0, limit) : waiting;
  const jobs = page
    .map((job) => envelopeToSummary(sourceQueue, job))
    .filter((row): row is DeadLetterJobSummaryV1 => row !== null)
    .filter((row) => {
      if (!options.companyId) {
        return true;
      }

      return row.companyId === options.companyId;
    });

  const nextCursor = hasMore ? String(start + limit) : null;

  return DeadLetterJobListV1Schema.parse({
    contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
    sourceQueue,
    deadLetterQueueName: buildDeadLetterQueueName(sourceQueue),
    jobs,
    nextCursor
  });
}
