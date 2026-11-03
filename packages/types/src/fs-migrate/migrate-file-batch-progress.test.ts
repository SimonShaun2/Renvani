import { describe, expect, it } from "vitest";

import {
  buildMigrateFileBatchJobProgress,
  parseMigrateFileBatchJobProgress,
  vendorFileIdsPendingRetry
} from "./migrate-file-batch-progress.js";

describe("migrate-file-batch progress", () => {
  it("skips vendor file ids already marked succeeded on retry", () => {
    const objects = [{ vendorFileId: "a" }, { vendorFileId: "b" }, { vendorFileId: "c" }];
    const progress = buildMigrateFileBatchJobProgress(
      { batchIndex: 0, batchesTotal: 1, objects },
      ["a", "c"],
      [{ vendorFileId: "b", errorMessage: "timeout" }],
      "partial_failure"
    );

    expect(vendorFileIdsPendingRetry(objects, progress)).toEqual(["b"]);
  });

  it("parses persisted worker progress", () => {
    const progress = {
      batchIndex: 1,
      batchesTotal: 3,
      objectsTotal: 2,
      objectsSucceeded: ["x"],
      objectsFailed: [],
      status: "in_progress"
    };

    expect(parseMigrateFileBatchJobProgress(progress)).toEqual(progress);
    expect(parseMigrateFileBatchJobProgress({ invalid: true })).toBeNull();
  });
});
