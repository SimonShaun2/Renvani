import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IMPORT_QUEUE_JOB_NAMES,
  buildMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobId
} from "@fsm/types";

const { add } = vi.hoisted(() => ({
  add: vi.fn()
}));

vi.mock("./queues.js", () => ({
  importsQueue: {
    add
  }
}));

import { enqueueMigrateFileBatchJob } from "./enqueue-migrate-file-batch.js";

describe("enqueueMigrateFileBatchJob", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    add.mockReset();
  });

  it("enqueues migrate-file-batch on fsm:imports with deterministic job id", async () => {
    await enqueueMigrateFileBatchJob({
      companyId,
      importSessionId,
      importBundleId,
      sourceSystem: "manual_csv",
      batchIndex: 1,
      batchesTotal: 3,
      idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 1),
      objects: [{ vendorFileId: "f-1", relativePath: "media/f-1.pdf" }]
    });

    expect(add).toHaveBeenCalledTimes(1);
    const [jobName, payload, options] = add.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { jobId?: string }
    ];

    expect(jobName).toBe(IMPORT_QUEUE_JOB_NAMES.migrateFileBatch);
    expect(payload.companyId).toBe(companyId);
    expect(options.jobId).toBe(buildMigrateFileBatchJobId(importSessionId, 1));
  });
});
