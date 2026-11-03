import { describe, expect, it } from "vitest";

import {
  buildImportChunkIdempotencyKey,
  planImportRowChunks,
  sliceSheetRowsForWindow
} from "./chunk-ingest.js";

describe("chunk-ingest", () => {
  it("plans evenly sized row windows", () => {
    const plans = planImportRowChunks(5, 2);
    expect(plans).toEqual([
      { chunkIndex: 0, chunksTotal: 3, window: { start: 0, end: 2 } },
      { chunkIndex: 1, chunksTotal: 3, window: { start: 2, end: 4 } },
      { chunkIndex: 2, chunksTotal: 3, window: { start: 4, end: 5 } }
    ]);
  });

  it("returns no chunks for empty files", () => {
    expect(planImportRowChunks(0)).toEqual([]);
  });

  it("builds stable idempotency keys", () => {
    expect(buildImportChunkIdempotencyKey("sess-1", "customers", 0)).toBe("sess-1:customers:0");
  });

  it("slices parsed rows for a chunk window", () => {
    const rows = [["a"], ["b"], ["c"], ["d"]];
    expect(sliceSheetRowsForWindow(rows, { start: 1, end: 3 })).toEqual([["b"], ["c"]]);
  });
});
