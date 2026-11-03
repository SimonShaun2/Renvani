import { describe, expect, it } from "vitest";

import { buildMigrateFileBatchIdempotencyKey } from "@fsm/types";

import {
  ImportChunkCommitPayloadSchema,
  buildImportChunkIdempotencyKey
} from "./import-chunk-commit.js";

describe("FS-128 FS-MIGRATE import chunk + file-batch pipeline contracts", () => {
  const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const importSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const importBundleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("uses ADR idempotency key format for import-chunk-commit", () => {
    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "customers", 3);
    const payload = ImportChunkCommitPayloadSchema.parse({
      companyId,
      importSessionId,
      importBundleId,
      sourceSystem: "jobber",
      entityType: "customers",
      chunkIndex: 3,
      chunksTotal: 10,
      cursor: { rowOffset: 3000 },
      idempotencyKey
    });

    expect(payload.companyId).toBe(companyId);
    expect(idempotencyKey).toBe(`${importSessionId}:customers:3`);
  });

  it("aligns migrate-file-batch idempotency keys with session + batch index", () => {
    expect(buildMigrateFileBatchIdempotencyKey(importSessionId, 1)).toBe(
      `${importSessionId}:migrate-file-batch:1`
    );
  });
});
