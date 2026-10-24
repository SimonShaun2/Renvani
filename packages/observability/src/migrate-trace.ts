import {
  FS_MIGRATE_FILE_BATCH_TRACE_EVENT,
  type FsMigrateFileBatchTraceLogFields
} from "@fsm/types";

import { trackNodeProductEvent } from "./node/index.js";

/** Mirrors pino migrate-file-batch trace fields for PostHog / Sentry breadcrumbs. */
export function observeMigrateFileBatchTrace(
  fields: FsMigrateFileBatchTraceLogFields,
  message: string
): void {
  trackNodeProductEvent(
    FS_MIGRATE_FILE_BATCH_TRACE_EVENT,
    {
      phase: fields.phase,
      importBundleId: fields.importBundleId,
      batchIndex: fields.batchIndex,
      batchesTotal: fields.batchesTotal,
      idempotencyKey: fields.idempotencyKey,
      objectCount: fields.objectCount,
      logMessage: message
    },
    {
      companyId: fields.companyId,
      importSessionId: fields.importSessionId,
      jobId: fields.bullJobId
    }
  );
}
