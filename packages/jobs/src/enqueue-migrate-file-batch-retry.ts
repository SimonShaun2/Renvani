import {
  IMPORT_QUEUE_JOB_NAMES,
  parseMigrateFileBatchJobProgress,
  type MigrateFileBatchJobData
} from "@fsm/types";

import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import {
  buildMigrateFileBatchFailedObjectsRetryPayload,
  buildMigrateFileBatchRetryJobId
} from "./migrate-file-batch-retry.js";
import { importsQueue } from "./queues.js";

export async function enqueueMigrateFileBatchFailedObjectsRetry(
  originalPayload: MigrateFileBatchJobData,
  progress: unknown
): Promise<string | null> {
  const parsedProgress = parseMigrateFileBatchJobProgress(progress);
  const retryPayload = buildMigrateFileBatchFailedObjectsRetryPayload(originalPayload, parsedProgress);

  if (!retryPayload) {
    return null;
  }

  const retryGeneration = parsedProgress?.objectsFailed.length ?? 1;
  const jobId = buildMigrateFileBatchRetryJobId(
    retryPayload.importSessionId,
    retryPayload.batchIndex,
    retryGeneration
  );

  const job = await importsQueue.add(
    IMPORT_QUEUE_JOB_NAMES.migrateFileBatch,
    retryPayload,
    buildDefaultEnqueueJobOptions({ jobId })
  );

  return job.id ? String(job.id) : null;
}
