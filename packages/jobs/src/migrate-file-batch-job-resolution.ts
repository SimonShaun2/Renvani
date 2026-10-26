import type { Job } from "bullmq";

import {
  buildMigrateFileBatchJobId,
  type MigrateFileBatchJobData
} from "@fsm/types";

import { buildMigrateFileBatchRetryJobId } from "./migrate-file-batch-retry.js";
import { importsQueue } from "./queues.js";

const MAX_RETRY_GENERATION_SCAN = 32;

/**
 * Returns the newest migrate-file-batch job for a session batch (primary or retry generation).
 */
export async function findLatestMigrateFileBatchJob(
  importSessionId: string,
  batchIndex: number
): Promise<Job<MigrateFileBatchJobData> | undefined> {
  let latest: Job<MigrateFileBatchJobData> | undefined;

  const primary = await importsQueue.getJob(buildMigrateFileBatchJobId(importSessionId, batchIndex));
  if (primary) {
    latest = primary as Job<MigrateFileBatchJobData>;
  }

  for (let generation = 1; generation <= MAX_RETRY_GENERATION_SCAN; generation += 1) {
    const retryJob = await importsQueue.getJob(
      buildMigrateFileBatchRetryJobId(importSessionId, batchIndex, generation)
    );

    if (retryJob) {
      latest = retryJob as Job<MigrateFileBatchJobData>;
    }
  }

  return latest;
}
