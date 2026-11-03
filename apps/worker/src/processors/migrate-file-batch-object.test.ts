import { describe, expect, it } from "vitest";

import { buildMigrateFileBatchIdempotencyKey, type MigrateFileBatchJobData } from "@fsm/types";

import { processMigrateFileBatchObject } from "./migrate-file-batch-object.js";

describe("processMigrateFileBatchObject", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  const payload: MigrateFileBatchJobData = {
    companyId,
    importSessionId,
    importBundleId,
    sourceSystem: "jobber",
    batchIndex: 0,
    batchesTotal: 1,
    idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
    objects: []
  };

  it("rejects object keys outside tenant bundle scope", async () => {
    await expect(
      processMigrateFileBatchObject(
        {
          vendorFileId: "v-2",
          relativePath: "media/v-2.png",
          r2Key: "other-tenant/imports/other/file.png"
        },
        payload
      )
    ).rejects.toThrow(/tenant scope/);
  });
});
