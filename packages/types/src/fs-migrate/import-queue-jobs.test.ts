import { describe, expect, it } from "vitest";

import {
  MigrateFileBatchJobDataSchema,
  buildMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobId
} from "./import-queue-jobs.js";

describe("FS-MIGRATE migrate-file-batch job contract", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  it("builds stable idempotency keys and job ids per batch index", () => {
    expect(buildMigrateFileBatchIdempotencyKey(importSessionId, 2)).toBe(
      `${importSessionId}:migrate-file-batch:2`
    );
    expect(buildMigrateFileBatchJobId(importSessionId, 2)).toBe(
      `migrate-file-batch-${importSessionId}-2`
    );
  });

  it("validates migrate-file-batch payload shape", () => {
    const parsed = MigrateFileBatchJobDataSchema.parse({
      companyId,
      importSessionId,
      importBundleId,
      sourceSystem: "service_fusion",
      batchIndex: 0,
      batchesTotal: 2,
      idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
      objects: [
        {
          vendorFileId: "photo-1",
          relativePath: "media/job-photos/photo-1.jpg",
          mimeType: "image/jpeg"
        }
      ]
    });

    expect(parsed.objects).toHaveLength(1);
    expect(parsed.sourceSystem).toBe("service_fusion");
  });
});
