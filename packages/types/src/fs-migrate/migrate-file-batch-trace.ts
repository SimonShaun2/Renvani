import type { MigrateFileBatchObject } from "./import-queue-jobs.js";

/** Stable log field for filtering FS-MIGRATE file-batch traces in pino / log drains. */
export const FS_MIGRATE_FILE_BATCH_TRACE_EVENT = "fs_migrate.file_batch.trace";

export type FsMigrateFileBatchTracePhase = "enqueue" | "worker_start" | "worker_complete";

export interface FsMigrateFileBatchTraceObject {
  vendorFileId: string;
  relativePath: string;
  r2Key: string;
}

export interface FsMigrateFileBatchBatchTrace {
  bullJobId: string;
  batchIndex: number;
  batchesTotal: number;
  idempotencyKey: string;
  r2Keys: string[];
  objects: FsMigrateFileBatchTraceObject[];
}

export interface FsMigrateFileBatchSessionTraceSummary {
  fsMigrateTraceEvent: typeof FS_MIGRATE_FILE_BATCH_TRACE_EVENT;
  phase: "enqueue_summary";
  companyId: string;
  importSessionId: string;
  importBundleId: string;
  enqueuedBatches: number;
  batches: FsMigrateFileBatchBatchTrace[];
}

export interface FsMigrateFileBatchTraceLogFields {
  fsMigrateTraceEvent: typeof FS_MIGRATE_FILE_BATCH_TRACE_EVENT;
  phase: FsMigrateFileBatchTracePhase;
  companyId: string;
  importSessionId: string;
  importBundleId: string;
  bullJobId: string;
  batchIndex: number;
  batchesTotal: number;
  idempotencyKey: string;
  objectCount: number;
  r2Keys: string[];
  objects: FsMigrateFileBatchTraceObject[];
}

export function resolveMigrateFileBatchObjectR2Key(
  object: MigrateFileBatchObject,
  resolveFromRelativePath: (relativePath: string) => string
): string {
  return object.r2Key ?? resolveFromRelativePath(object.relativePath);
}

export function buildMigrateFileBatchTraceObjects(
  objects: MigrateFileBatchObject[],
  resolveFromRelativePath: (relativePath: string) => string
): FsMigrateFileBatchTraceObject[] {
  return objects.map((object) => ({
    vendorFileId: object.vendorFileId,
    relativePath: object.relativePath,
    r2Key: resolveMigrateFileBatchObjectR2Key(object, resolveFromRelativePath)
  }));
}

export function buildMigrateFileBatchTraceLogFields(input: {
  phase: FsMigrateFileBatchTracePhase;
  companyId: string;
  importSessionId: string;
  importBundleId: string;
  bullJobId: string;
  batchIndex: number;
  batchesTotal: number;
  idempotencyKey: string;
  objects: FsMigrateFileBatchTraceObject[];
}): FsMigrateFileBatchTraceLogFields {
  const r2Keys = input.objects.map((object) => object.r2Key);

  return {
    fsMigrateTraceEvent: FS_MIGRATE_FILE_BATCH_TRACE_EVENT,
    phase: input.phase,
    companyId: input.companyId,
    importSessionId: input.importSessionId,
    importBundleId: input.importBundleId,
    bullJobId: input.bullJobId,
    batchIndex: input.batchIndex,
    batchesTotal: input.batchesTotal,
    idempotencyKey: input.idempotencyKey,
    objectCount: input.objects.length,
    r2Keys,
    objects: input.objects
  };
}

export function buildMigrateFileBatchSessionTraceSummary(input: {
  companyId: string;
  importSessionId: string;
  importBundleId: string;
  batches: FsMigrateFileBatchBatchTrace[];
}): FsMigrateFileBatchSessionTraceSummary {
  return {
    fsMigrateTraceEvent: FS_MIGRATE_FILE_BATCH_TRACE_EVENT,
    phase: "enqueue_summary",
    companyId: input.companyId,
    importSessionId: input.importSessionId,
    importBundleId: input.importBundleId,
    enqueuedBatches: input.batches.length,
    batches: input.batches
  };
}
