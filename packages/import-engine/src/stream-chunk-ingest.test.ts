import { describe, expect, it } from "vitest";

import { iterateSheetRowChunks } from "./stream-chunk-ingest.js";

describe("iterateSheetRowChunks", () => {
  it("returns chunked row batches aligned with ingest plans", () => {
    const rows = [["a"], ["b"], ["c"], ["d"], ["e"]];
    const batches = iterateSheetRowChunks(rows, 2);

    expect(batches).toHaveLength(3);
    expect(batches[0]?.rows).toEqual([["a"], ["b"]]);
    expect(batches[2]?.window).toEqual({ start: 4, end: 5 });
  });
});
