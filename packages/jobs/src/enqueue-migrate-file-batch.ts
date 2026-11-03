import { buildImportBundleObjectKey } from "@fsm/config/import-bundle-storage";
import {
  MigrateFileBatchJobDataSchema,
  buildMigrateFileBatchJobId,
  buildMigrateFileBatchTraceObjects,
  IMPORT_QUEUE_JOB_NAMES,
  type MigrateFileBatchJobData
} from "@fsm/types";

import { logMigrateFileBatchTrace } from "./migrate-file-batch-trace-log.js";
import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import { importsQueue } from "./queues.js";

export async function enqueueMigrateFileBatchJob(data: MigrateFileBatchJobData): Promise<void> {
  const payload = MigrateFileBatchJobDataSchema.parse(data);
  const bullJobId = buildMigrateFileBatchJobId(payload.importSessionId, payload.batchIndex);
  const traceObjects = buildMigrateFileBatchTraceObjects(payload.objects, (relativePath) =>
    buildImportBundleObjectKey(payload.companyId, payload.importBundleId, relativePath)
  );

  await importsQueue.add(
    IMPORT_QUEUE_JOB_NAMES.migrateFileBatch,
    payload,
    buildDefaultEnqueueJobOptions({
      jobId: bullJobId
    })
  );

  logMigrateFileBatchTrace(
    {
      phase: "enqueue",
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      importBundleId: payload.importBundleId,
      bullJobId,
      batchIndex: payload.batchIndex,
      batchesTotal: payload.batchesTotal,
      idempotencyKey: payload.idempotencyKey,
      objects: traceObjects
    },
    "FS-MIGRATE migrate-file-batch enqueued"
  );
}
