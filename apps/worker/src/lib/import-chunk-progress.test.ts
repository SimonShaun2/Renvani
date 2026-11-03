import { describe, expect, it } from "vitest";

import type { ImportChunkCommitPayload } from "@fsm/jobs";

import { mergeImportChunkSessionProgress, parseImportChunkSessionProgress } from "./import-chunk-progress.js";

const basePayload: ImportChunkCommitPayload = {
  companyId: "22222222-2222-4222-8222-222222222222",
  importSessionId: "11111111-1111-4111-8111-111111111111",
  sourceSystem: "jobber",
  entityType: "customers",
  chunkIndex: 1,
  chunksTotal: 4,
  cursor: { rowOffset: 100 },
  idempotencyKey: "11111111-1111-4111-8111-111111111111:customers:1",
};

describe("import-chunk-progress", () => {
  it("parses empty progress as defaults", () => {
    expect(parseImportChunkSessionProgress(null)).toEqual({});
  });

  it("merges chunk counters when incrementing chunksDone", () => {
    const merged = mergeImportChunkSessionProgress(
      { chunksDone: 1, rowsOk: 50, rowsFailed: 2 },
      basePayload,
      { rowsOk: 25, rowsFailed: 1 },
      true,
    );

    expect(merged).toMatchObject({
      entityType: "customers",
      chunksTotal: 4,
      chunksDone: 2,
      rowsOk: 75,
      rowsFailed: 3,
      lastIdempotencyKey: basePayload.idempotencyKey,
      lastCursor: { rowOffset: 100 },
    });
  });

  it("does not increment chunksDone on idempotent replay", () => {
    const merged = mergeImportChunkSessionProgress(
      { chunksDone: 2, rowsOk: 75 },
      basePayload,
      { rowsOk: 0, rowsFailed: 0 },
      false,
    );

    expect(merged.chunksDone).toBe(2);
    expect(merged.rowsOk).toBe(75);
  });
});
