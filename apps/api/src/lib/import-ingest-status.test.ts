import { describe, expect, it } from "vitest";

import { buildImportSessionIngestStatus } from "./import-ingest-status.js";

describe("import-ingest-status", () => {
  it("surfaces chunked job history progress for the wizard", () => {
    const status = buildImportSessionIngestStatus({
      id: "00000000-0000-4000-8000-000000000010",
      entityType: "jobs",
      fileName: "jobs-history.csv",
      status: "importing",
      progress: {
        entityType: "jobs",
        chunksTotal: 5,
        chunksDone: 2,
        rowsOk: 400,
        rowsFailed: 1
      },
      aiInferences: {},
      importedRows: 400
    });

    expect(status.chunkProgress?.chunksDone).toBe(2);
    expect(status.chunkProgress?.chunksTotal).toBe(5);
  });
});
