import type { Job, Processor } from "bullmq";
import pino from "pino";

import {
  assertImportBundleObjectKeyBelongsToTenant,
  buildImportBundleObjectKey
} from "@fsm/config/import-bundle-storage";
import { logMigrateFileBatchTrace } from "@fsm/jobs";
import {
  IMPORT_QUEUE_JOB_NAMES,
  MigrateFileBatchJobDataSchema,
  assertMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobId,
  buildMigrateFileBatchJobProgress,
  buildMigrateFileBatchTraceObjects,
  parseMigrateFileBatchJobProgress,
  type MigrateFileBatchFailedObject,
  type MigrateFileBatchJobData
} from "@fsm/types";

import { emitImportWorkflowStepReceipt } from "../lib/import-workflow-step-receipt.js";
import { processMigrateFileBatchObject } from "./migrate-file-batch-object.js";

const logger = pino({
  name: "migrate-file-batch-processor"
});

export class MigrateFileBatchPartialFailureError extends Error {
  readonly failures: MigrateFileBatchFailedObject[];

  constructor(failures: MigrateFileBatchFailedObject[]) {
    super(`migrate-file-batch: ${failures.length} object(s) failed`);
    this.name = "MigrateFileBatchPartialFailureError";
    this.failures = failures;
  }
}

export async function handleMigrateFileBatch(job: Job<MigrateFileBatchJobData>): Promise<void> {
  const payload = MigrateFileBatchJobDataSchema.parse(job.data);
  assertMigrateFileBatchIdempotencyKey(
    payload.importSessionId,
    payload.batchIndex,
    payload.idempotencyKey,
  );
  const bullJobId = String(job.id ?? buildMigrateFileBatchJobId(payload.importSessionId, payload.batchIndex));

  try {
    await runMigrateFileBatch(job, payload, bullJobId);
  } catch (error: unknown) {
    if (error instanceof MigrateFileBatchPartialFailureError) {
      await emitImportWorkflowStepReceipt({
        companyId: payload.companyId,
        importSessionId: payload.importSessionId,
        importBundleId: payload.importBundleId,
        stepKind: IMPORT_QUEUE_JOB_NAMES.migrateFileBatch,
        idempotencyKey: payload.idempotencyKey,
        state: "failed",
        batchIndex: payload.batchIndex,
      jobId: bullJobId,
      summary: `migrate-file-batch ${payload.batchIndex} failed (${error.failures.length} object(s))`,
      });
    }
    throw error;
  }
}

async function runMigrateFileBatch(
  job: Job<MigrateFileBatchJobData>,
  payload: MigrateFileBatchJobData,
  bullJobId: string,
): Promise<void> {
  const resolveR2Key = (relativePath: string) =>
    buildImportBundleObjectKey(payload.companyId, payload.importBundleId, relativePath);
  const traceObjects = buildMigrateFileBatchTraceObjects(payload.objects, resolveR2Key);

  const previousProgress = parseMigrateFileBatchJobProgress(job.progress);
  if (previousProgress?.status === "stub_complete") {
    await emitImportWorkflowStepReceipt({
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      importBundleId: payload.importBundleId,
      stepKind: IMPORT_QUEUE_JOB_NAMES.migrateFileBatch,
      idempotencyKey: payload.idempotencyKey,
      state: "deduped_completed",
      batchIndex: payload.batchIndex,
      jobId: bullJobId,
      summary: `migrate-file-batch ${payload.batchIndex} deduped (already complete)`,
    });
    return;
  }

  for (const object of traceObjects) {
    assertImportBundleObjectKeyBelongsToTenant(object.r2Key, payload.companyId, payload.importBundleId);
  }

  logMigrateFileBatchTrace(
    {
      phase: "worker_start",
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      importBundleId: payload.importBundleId,
      bullJobId,
      batchIndex: payload.batchIndex,
      batchesTotal: payload.batchesTotal,
      idempotencyKey: payload.idempotencyKey,
      objects: traceObjects
    },
    "FS-MIGRATE migrate-file-batch worker started"
  );

  const succeeded = new Set(previousProgress?.objectsSucceeded ?? []);
  const failuresByVendorId = new Map<string, MigrateFileBatchFailedObject>();

  for (const failure of previousProgress?.objectsFailed ?? []) {
    if (!succeeded.has(failure.vendorFileId)) {
      failuresByVendorId.set(failure.vendorFileId, failure);
    }
  }

  for (const object of payload.objects) {
    if (succeeded.has(object.vendorFileId)) {
      continue;
    }

    try {
      await processMigrateFileBatchObject(object, payload);
      succeeded.add(object.vendorFileId);
      failuresByVendorId.delete(object.vendorFileId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "migrate-file-batch object failed";
      failuresByVendorId.set(object.vendorFileId, {
        vendorFileId: object.vendorFileId,
        errorMessage
      });
    }

    const objectsFailed = [...failuresByVendorId.values()];
    const status = objectsFailed.length > 0 ? "partial_failure" : "in_progress";

    await job.updateProgress(
      buildMigrateFileBatchJobProgress(payload, [...succeeded], objectsFailed, status)
    );
  }

  const objectsFailed = [...failuresByVendorId.values()];

  if (objectsFailed.length > 0) {
    await job.updateProgress(
      buildMigrateFileBatchJobProgress(payload, [...succeeded], objectsFailed, "partial_failure")
    );
    throw new MigrateFileBatchPartialFailureError(objectsFailed);
  }

  await job.updateProgress(
    buildMigrateFileBatchJobProgress(payload, [...succeeded], [], "stub_complete")
  );

  logMigrateFileBatchTrace(
    {
      phase: "worker_complete",
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      importBundleId: payload.importBundleId,
      bullJobId,
      batchIndex: payload.batchIndex,
      batchesTotal: payload.batchesTotal,
      idempotencyKey: payload.idempotencyKey,
      objects: traceObjects
    },
    "FS-MIGRATE migrate-file-batch worker completed (checkpoint reserved for Diego ingest)"
  );

  await emitImportWorkflowStepReceipt({
    companyId: payload.companyId,
    importSessionId: payload.importSessionId,
    importBundleId: payload.importBundleId,
    stepKind: IMPORT_QUEUE_JOB_NAMES.migrateFileBatch,
    idempotencyKey: payload.idempotencyKey,
    state: "completed",
    batchIndex: payload.batchIndex,
    jobId: bullJobId,
    summary: `migrate-file-batch ${payload.batchIndex} completed`,
  });

  logger.info(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      batchIndex: payload.batchIndex,
      objectCount: payload.objects.length
    },
    "migrate-file-batch completed"
  );
}

export function createMigrateFileBatchProcessor(): Processor<MigrateFileBatchJobData, void, string> {
  return async (job) => {
    if (job.name !== IMPORT_QUEUE_JOB_NAMES.migrateFileBatch) {
      logger.warn({ jobId: job.id ?? null, jobName: job.name }, "Unexpected job routed to migrate-file-batch handler");
      return;
    }

    await handleMigrateFileBatch(job);
  };
}
