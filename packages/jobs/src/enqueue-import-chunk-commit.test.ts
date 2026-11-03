import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IMPORT_QUEUE_JOB_NAMES,
  buildImportChunkCommitJobId,
  buildImportChunkIdempotencyKey,
} from "@fsm/types";

const { add } = vi.hoisted(() => ({
  add: vi.fn(),
}));

vi.mock("./queues.js", () => ({
  importsQueue: {
    add,
  },
}));

import { enqueueImportChunkCommitJob } from "./enqueue-import-chunk-commit.js";

describe("enqueueImportChunkCommitJob", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    add.mockReset();
  });

  it("enqueues import-chunk-commit on fsm:imports with deterministic job id", async () => {
    await enqueueImportChunkCommitJob({
      companyId,
      importSessionId,
      sourceSystem: "housecall_pro",
      entityType: "customers",
      chunkIndex: 2,
      chunksTotal: 5,
      cursor: { rowOffset: 200 },
      idempotencyKey: buildImportChunkIdempotencyKey(importSessionId, "customers", 2),
    });

    expect(add).toHaveBeenCalledTimes(1);
    const [jobName, payload, options] = add.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { jobId?: string },
    ];

    expect(jobName).toBe(IMPORT_QUEUE_JOB_NAMES.importChunkCommit);
    expect(payload.chunkIndex).toBe(2);
    expect(options.jobId).toBe(buildImportChunkCommitJobId(importSessionId, 2));
  });
});
