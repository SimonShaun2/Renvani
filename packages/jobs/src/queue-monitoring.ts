import type { Job, Queue } from "bullmq";

import {
  PlatformQueueMonitoringSnapshotV1Schema,
  type PlatformQueueMetricsV1,
  type PlatformQueueMonitoringSnapshotV1,
  type PlatformQueueNameV1,
  QUEUE_PLATFORM_CONTRACT_VERSION
} from "@fsm/types";

import { buildDeadLetterQueueName } from "./dead-letter-job.js";
import { QUEUE_NAMES } from "./queue-names.js";

export type QueueMonitoringProbe = Pick<
  Queue,
  "getJobCounts" | "getWaiting" | "getDelayed" | "getActive" | "getFailed"
>;

export type PlatformQueueMonitoringDeps = {
  queues: Record<PlatformQueueNameV1, QueueMonitoringProbe>;
  getDeadLetterQueue: (sourceQueueName: string) => QueueMonitoringProbe;
};

function computeBacklog(counts: {
  waiting: number;
  active: number;
  delayed: number;
}): number {
  return counts.waiting + counts.active + counts.delayed;
}

function jobTimestampMs(job: Job | undefined): number | null {
  if (!job) {
    return null;
  }

  const timestamp = job.timestamp;

  return typeof timestamp === "number" && timestamp > 0 ? timestamp : null;
}

async function oldestJobTimestampMs(
  queue: QueueMonitoringProbe
): Promise<number | null> {
  const [waitingHead, delayedHead, activeHead, failedHead] = await Promise.all([
    queue.getWaiting(0, 0),
    queue.getDelayed(0, 0),
    queue.getActive(0, 0),
    queue.getFailed(0, 0)
  ]);

  const timestamps = [
    jobTimestampMs(waitingHead[0]),
    jobTimestampMs(delayedHead[0]),
    jobTimestampMs(activeHead[0]),
    jobTimestampMs(failedHead[0])
  ].filter((value): value is number => value !== null);

  if (timestamps.length === 0) {
    return null;
  }

  return Math.min(...timestamps);
}

function ageSecondsFromTimestamp(timestampMs: number | null, nowMs: number): number | null {
  if (timestampMs === null) {
    return null;
  }

  const ageMs = Math.max(0, nowMs - timestampMs);

  return Math.floor(ageMs / 1000);
}

async function collectQueueMetrics(
  queueName: PlatformQueueNameV1,
  queue: QueueMonitoringProbe,
  deadLetterQueue: QueueMonitoringProbe,
  nowMs: number
): Promise<PlatformQueueMetricsV1> {
  const rawCounts = await queue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "failed",
    "paused"
  );

  const waiting = rawCounts.waiting ?? 0;
  const active = rawCounts.active ?? 0;
  const delayed = rawCounts.delayed ?? 0;
  const failed = rawCounts.failed ?? 0;
  const paused = rawCounts.paused ?? 0;

  const oldestTimestampMs = await oldestJobTimestampMs(queue);
  const dlqCounts = await deadLetterQueue.getJobCounts("waiting", "active", "delayed", "failed");
  const dlqTotal =
    (dlqCounts.waiting ?? 0) +
    (dlqCounts.active ?? 0) +
    (dlqCounts.delayed ?? 0) +
    (dlqCounts.failed ?? 0);
  const dlqOldestTimestampMs = await oldestJobTimestampMs(deadLetterQueue);

  return {
    queueName,
    counts: {
      waiting,
      active,
      delayed,
      failed,
      paused,
      backlog: computeBacklog({ waiting, active, delayed })
    },
    oldestJobAgeSeconds: ageSecondsFromTimestamp(oldestTimestampMs, nowMs),
    deadLetter: {
      queueName: buildDeadLetterQueueName(queueName),
      count: dlqTotal,
      oldestJobAgeSeconds: ageSecondsFromTimestamp(dlqOldestTimestampMs, nowMs)
    }
  };
}

export async function collectPlatformQueueMonitoringSnapshot(
  deps: PlatformQueueMonitoringDeps,
  collectedAt: Date = new Date()
): Promise<PlatformQueueMonitoringSnapshotV1> {
  const nowMs = collectedAt.getTime();
  const queueNames = Object.values(QUEUE_NAMES) as PlatformQueueNameV1[];

  const queues = await Promise.all(
    queueNames.map(async (queueName) => {
      const queue = deps.queues[queueName];
      const deadLetterQueue = deps.getDeadLetterQueue(queueName);

      return collectQueueMetrics(queueName, queue, deadLetterQueue, nowMs);
    })
  );

  return PlatformQueueMonitoringSnapshotV1Schema.parse({
    contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
    collectedAt: collectedAt.toISOString(),
    queues
  });
}
