import { describe, expect, it } from "vitest";

import {
  buildMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobProgress,
  type MigrateFileBatchJobData
} from "@fsm/types";

import {
  buildMigrateFileBatchFailedObjectsRetryPayload,
  buildMigrateFileBatchRetryJobId
} from "./migrate-file-batch-retry.js";

describe("migrate-file-batch failed-object retry", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  const basePayload: MigrateFileBatchJobData = {
    companyId,
    importSessionId,
    importBundleId,
    sourceSystem: "service_fusion",
    batchIndex: 0,
    batchesTotal: 1,
    idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
    objects: [
      { vendorFileId: "ok-1", relativePath: "media/ok-1.jpg" },
      { vendorFileId: "fail-1", relativePath: "media/fail-1.jpg" }
    ]
  };

  it("builds a retry payload containing only objects that did not succeed", () => {
    const progress = buildMigrateFileBatchJobProgress(
      basePayload,
      ["ok-1"],
      [{ vendorFileId: "fail-1", errorMessage: "r2 timeout" }],
      "partial_failure"
    );

    const retryPayload = buildMigrateFileBatchFailedObjectsRetryPayload(basePayload, progress);

    expect(retryPayload?.objects).toHaveLength(1);
    expect(retryPayload?.objects[0]?.vendorFileId).toBe("fail-1");
    expect(retryPayload?.idempotencyKey).toContain("failed-objects");
  });

  it("returns null when every object succeeded", () => {
    const progress = buildMigrateFileBatchJobProgress(basePayload, ["ok-1", "fail-1"], [], "stub_complete");

    expect(buildMigrateFileBatchFailedObjectsRetryPayload(basePayload, progress)).toBeNull();
  });

  it("builds stable retry job ids per generation", () => {
    expect(buildMigrateFileBatchRetryJobId(importSessionId, 0, 2)).toBe(
      `migrate-file-batch-retry-${importSessionId}-0-2`
    );
  });
});
