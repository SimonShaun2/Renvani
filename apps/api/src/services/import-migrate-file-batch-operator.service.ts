import {
  buildMigrateFileBatchFailedObjectsRetryPayload,
  enqueueMigrateFileBatchFailedObjectsRetry,
  findLatestMigrateFileBatchJob
} from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  MigrateFileBatchJobDataSchema,
  MigrateFileBatchOperatorRetryResultV1Schema,
  MigrateFileBatchOperatorStatusV1Schema,
  parseMigrateFileBatchJobProgress,
  vendorFileIdsPendingRetry,
  type MigrateFileBatchOperatorRetryResultV1,
  type MigrateFileBatchOperatorStatusV1
} from "@fsm/types";

import { getImportSession } from "./import.service.js";

export async function getMigrateFileBatchOperatorStatus(
  companyId: string,
  importSessionId: string,
  batchIndex: number
): Promise<MigrateFileBatchOperatorStatusV1> {
  await getImportSession(companyId, importSessionId);

  const job = await findLatestMigrateFileBatchJob(importSessionId, batchIndex);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "No migrate-file-batch job found for this import batch");
  }

  const payload = MigrateFileBatchJobDataSchema.parse(job.data);

  if (payload.companyId !== companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Import batch job is outside tenant scope");
  }

  if (payload.importSessionId !== importSessionId || payload.batchIndex !== batchIndex) {
    throw new AppError(ErrorCode.NOT_FOUND, "No migrate-file-batch job found for this import batch");
  }

  const progress = parseMigrateFileBatchJobProgress(job.progress);
  const queueState = await job.getState();
  const pending = vendorFileIdsPendingRetry(payload.objects, progress);

  return MigrateFileBatchOperatorStatusV1Schema.parse({
    importSessionId,
    batchIndex,
    queueJobId: job.id ? String(job.id) : null,
    queueState,
    progress,
    retryAvailable: pending.length > 0
  });
}

export async function retryMigrateFileBatchFailedObjects(
  companyId: string,
  importSessionId: string,
  batchIndex: number
): Promise<MigrateFileBatchOperatorRetryResultV1> {
  await getImportSession(companyId, importSessionId);

  const job = await findLatestMigrateFileBatchJob(importSessionId, batchIndex);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "No migrate-file-batch job found for this import batch");
  }

  const payload = MigrateFileBatchJobDataSchema.parse(job.data);

  if (payload.companyId !== companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Import batch job is outside tenant scope");
  }

  const retryPayload = buildMigrateFileBatchFailedObjectsRetryPayload(
    payload,
    parseMigrateFileBatchJobProgress(job.progress)
  );

  if (!retryPayload) {
    throw new AppError(ErrorCode.CONFLICT, "No failed file objects remain to retry for this batch");
  }

  const enqueuedQueueJobId = await enqueueMigrateFileBatchFailedObjectsRetry(payload, job.progress);

  if (!enqueuedQueueJobId) {
    throw new AppError(ErrorCode.CONFLICT, "No failed file objects remain to retry for this batch");
  }

  return MigrateFileBatchOperatorRetryResultV1Schema.parse({
    importSessionId,
    batchIndex,
    enqueuedQueueJobId,
    idempotencyKey: retryPayload.idempotencyKey
  });
}
