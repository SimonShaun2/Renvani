import type { Queue } from "bullmq";

import type { PlatformQueueNameV1 } from "@fsm/types";

import { getDeadLetterQueue } from "./dead-letter-queue.js";
import { QUEUE_NAMES } from "./queue-names.js";
import {
  agreementsQueue,
  aiQueue,
  exportsQueue,
  growthQueue,
  importsQueue,
  invoicesQueue,
  notificationsQueue,
  operatorQueue,
  webhooksQueue
} from "./queues.js";
import { listDeadLetterJobs } from "./dead-letter-visibility.js";
import { listFailedJobsWithReplayMetadata } from "./failed-job-replay-visibility.js";
import type { PlatformQueueMonitoringDeps, QueueMonitoringProbe } from "./queue-monitoring.js";
import { collectPlatformQueueMonitoringSnapshot } from "./queue-monitoring.js";

export const platformQueuesByName: Record<PlatformQueueNameV1, Queue> = {
  [QUEUE_NAMES.imports]: importsQueue,
  [QUEUE_NAMES.ai]: aiQueue,
  [QUEUE_NAMES.notifications]: notificationsQueue,
  [QUEUE_NAMES.invoices]: invoicesQueue,
  [QUEUE_NAMES.agreements]: agreementsQueue,
  [QUEUE_NAMES.webhooks]: webhooksQueue,
  [QUEUE_NAMES.operator]: operatorQueue,
  [QUEUE_NAMES.exports]: exportsQueue,
  [QUEUE_NAMES.growth]: growthQueue
};

export function createDefaultPlatformQueueMonitoringDeps(): PlatformQueueMonitoringDeps {
  return {
    queues: platformQueuesByName,
    getDeadLetterQueue: (sourceQueueName) => getDeadLetterQueue(sourceQueueName) as QueueMonitoringProbe
  };
}

export async function getPlatformQueueMonitoringSnapshot(collectedAt?: Date) {
  return collectPlatformQueueMonitoringSnapshot(createDefaultPlatformQueueMonitoringDeps(), collectedAt);
}

export async function listPlatformDeadLetterJobs(
  sourceQueue: PlatformQueueNameV1,
  options: { start?: number; limit?: number; companyId?: string } = {}
) {
  const deadLetterQueue = getDeadLetterQueue(sourceQueue);
  return listDeadLetterJobs(sourceQueue, deadLetterQueue, options);
}

export async function listPlatformFailedJobsWithReplayMetadata(
  sourceQueue: PlatformQueueNameV1,
  options: { companyId: string; start?: number; limit?: number }
) {
  const queue = platformQueuesByName[sourceQueue];
  return listFailedJobsWithReplayMetadata(sourceQueue, queue, options);
}
