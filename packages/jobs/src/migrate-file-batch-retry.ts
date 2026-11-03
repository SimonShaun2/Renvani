import {
  MigrateFileBatchJobDataSchema,
  buildMigrateFileBatchIdempotencyKey,
  type MigrateFileBatchJobData,
  type MigrateFileBatchJobProgress,
  vendorFileIdsPendingRetry
} from "@fsm/types";

export function buildMigrateFileBatchFailedObjectsRetryPayload(
  payload: MigrateFileBatchJobData,
  progress: MigrateFileBatchJobProgress | null
): MigrateFileBatchJobData | null {
  const pendingVendorFileIds = vendorFileIdsPendingRetry(payload.objects, progress);

  if (pendingVendorFileIds.length === 0) {
    return null;
  }

  const pendingSet = new Set(pendingVendorFileIds);
  const objects = payload.objects.filter((object) => pendingSet.has(object.vendorFileId));

  if (objects.length === 0) {
    return null;
  }

  const retryGeneration = (progress?.objectsFailed.length ?? 0) + 1;

  return MigrateFileBatchJobDataSchema.parse({
    ...payload,
    objects,
    idempotencyKey: `${buildMigrateFileBatchIdempotencyKey(payload.importSessionId, payload.batchIndex)}:failed-objects:${retryGeneration}`
  });
}

export function buildMigrateFileBatchRetryJobId(
  importSessionId: string,
  batchIndex: number,
  retryGeneration: number
): string {
  return `migrate-file-batch-retry-${importSessionId}-${batchIndex}-${retryGeneration}`;
}
