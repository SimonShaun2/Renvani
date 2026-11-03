import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

import {
  IMPORT_QUEUE_JOB_NAMES,
  buildMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobProgress,
  type MigrateFileBatchJobData
} from "@fsm/types";

import {
  MigrateFileBatchPartialFailureError,
  handleMigrateFileBatch
} from "./migrate-file-batch.processor.js";

vi.mock("./migrate-file-batch-object.js", () => ({
  processMigrateFileBatchObject: vi.fn()
}));

vi.mock("../lib/import-workflow-step-receipt.js", () => ({
  emitImportWorkflowStepReceipt: vi.fn().mockResolvedValue(undefined)
}));

import { processMigrateFileBatchObject } from "./migrate-file-batch-object.js";

function createJob(
  data: MigrateFileBatchJobData,
  progress?: unknown
): Job<MigrateFileBatchJobData> {
  return {
    id: "job-1",
    name: IMPORT_QUEUE_JOB_NAMES.migrateFileBatch,
    data,
    progress,
    updateProgress: vi.fn().mockResolvedValue(undefined)
  } as Job<MigrateFileBatchJobData>;
}

describe("migrate-file-batch processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(processMigrateFileBatchObject).mockResolvedValue(undefined);
  });

  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  const basePayload: MigrateFileBatchJobData = {
    companyId,
    importSessionId,
    importBundleId,
    sourceSystem: "jobber",
    batchIndex: 0,
    batchesTotal: 1,
    idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
    objects: [
      { vendorFileId: "v-1", relativePath: "media/v-1.png" },
      { vendorFileId: "v-2", relativePath: "media/v-2.png" }
    ]
  };

  it("dedupes when batch progress is already stub_complete", async () => {
    const job = createJob(basePayload, buildMigrateFileBatchJobProgress(basePayload, ["v-1"], [], "stub_complete"));

    await handleMigrateFileBatch(job);

    expect(processMigrateFileBatchObject).not.toHaveBeenCalled();
  });

  it("records stub progress when all objects succeed", async () => {
    vi.mocked(processMigrateFileBatchObject).mockResolvedValue(undefined);
    const job = createJob({
      ...basePayload,
      objects: [{ vendorFileId: "v-1", relativePath: "media/v-1.png" }]
    });

    await handleMigrateFileBatch(job);

    expect(job.updateProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "stub_complete",
        objectsSucceeded: ["v-1"]
      })
    );
  });

  it("skips succeeded objects on BullMQ retry and only reprocesses failures", async () => {
    vi.mocked(processMigrateFileBatchObject).mockImplementation(async (object) => {
      if (object.vendorFileId === "v-2") {
        throw new Error("r2 timeout");
      }
    });

    const priorProgress = buildMigrateFileBatchJobProgress(
      basePayload,
      ["v-1"],
      [{ vendorFileId: "v-2", errorMessage: "r2 timeout" }],
      "partial_failure"
    );

    const job = createJob(basePayload, priorProgress);

    await expect(handleMigrateFileBatch(job)).rejects.toBeInstanceOf(MigrateFileBatchPartialFailureError);
    expect(processMigrateFileBatchObject).toHaveBeenCalledTimes(1);
    expect(processMigrateFileBatchObject).toHaveBeenCalledWith(
      expect.objectContaining({ vendorFileId: "v-2" }),
      basePayload
    );
  });

});
