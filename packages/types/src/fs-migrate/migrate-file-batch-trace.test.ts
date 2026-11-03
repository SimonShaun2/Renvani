import { describe, expect, it } from "vitest";

import { buildMigrateFileBatchIdempotencyKey, buildMigrateFileBatchJobId } from "./import-queue-jobs.js";
import {
  FS_MIGRATE_FILE_BATCH_TRACE_EVENT,
  buildMigrateFileBatchSessionTraceSummary,
  buildMigrateFileBatchTraceLogFields,
  buildMigrateFileBatchTraceObjects
} from "./migrate-file-batch-trace.js";

describe("migrate-file-batch trace log fields", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  it("builds per-batch trace with importSessionId, bull job id, and R2 keys", () => {
    const objects = buildMigrateFileBatchTraceObjects(
      [{ vendorFileId: "v-1", relativePath: "media/a.jpg", r2Key: `${companyId}/imports/${importBundleId}/media/a.jpg` }],
      (relativePath) => `${companyId}/imports/${importBundleId}/${relativePath}`
    );

    const fields = buildMigrateFileBatchTraceLogFields({
      phase: "enqueue",
      companyId,
      importSessionId,
      importBundleId,
      bullJobId: buildMigrateFileBatchJobId(importSessionId, 0),
      batchIndex: 0,
      batchesTotal: 1,
      idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
      objects
    });

    expect(fields.fsMigrateTraceEvent).toBe(FS_MIGRATE_FILE_BATCH_TRACE_EVENT);
    expect(fields.importSessionId).toBe(importSessionId);
    expect(fields.bullJobId).toBe(`migrate-file-batch-${importSessionId}-0`);
    expect(fields.r2Keys).toEqual([`${companyId}/imports/${importBundleId}/media/a.jpg`]);
  });

  it("builds session summary linking batches to job ids and keys", () => {
    const bullJobId = buildMigrateFileBatchJobId(importSessionId, 0);
    const r2Key = `${companyId}/imports/${importBundleId}/media/a.jpg`;

    const summary = buildMigrateFileBatchSessionTraceSummary({
      companyId,
      importSessionId,
      importBundleId,
      batches: [
        {
          bullJobId,
          batchIndex: 0,
          batchesTotal: 1,
          idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
          r2Keys: [r2Key],
          objects: [{ vendorFileId: "v-1", relativePath: "media/a.jpg", r2Key }]
        }
      ]
    });

    expect(summary.phase).toBe("enqueue_summary");
    expect(summary.batches[0]?.bullJobId).toBe(bullJobId);
    expect(summary.batches[0]?.r2Keys).toEqual([r2Key]);
  });
});
