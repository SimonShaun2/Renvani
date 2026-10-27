import { describe, expect, it } from "vitest";

import {
  buildImportSessionIngestStatus,
  isChunkedHistoryEntity,
  parseImportSessionChunkProgress
} from "./session-ingest-status.js";

describe("session-ingest-status", () => {
  it("parses ADR chunk progress from import_sessions.progress", () => {
    const progress = parseImportSessionChunkProgress({
      entityType: "jobs",
      chunksTotal: 4,
      chunksDone: 2,
      rowsOk: 800,
      rowsFailed: 3
    });

    expect(progress?.chunksDone).toBe(2);
    expect(progress?.rowsOk).toBe(800);
  });

  it("builds ingest status with price-book seed count", () => {
    const status = buildImportSessionIngestStatus({
      id: "00000000-0000-4000-8000-000000000001",
      entityType: "price_book",
      fileName: "price_book.csv",
      status: "completed",
      progress: {},
      aiInferences: { priceBookLineSeeds: 42 },
      importedRows: 42
    });

    expect(status.priceBookLineSeeds).toBe(42);
    expect(status.chunkProgress).toBeNull();
  });

  it("flags jobs and estimates as chunked history entities", () => {
    expect(isChunkedHistoryEntity("jobs")).toBe(true);
    expect(isChunkedHistoryEntity("estimates")).toBe(true);
    expect(isChunkedHistoryEntity("customers")).toBe(false);
  });
});
