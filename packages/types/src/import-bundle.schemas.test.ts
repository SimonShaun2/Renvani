import { describe, expect, it } from "vitest";

import {
  ImportBundleContractSchema,
  ImportBundleFileDescriptorSchema,
  ImportSessionChunkProgressSchema
} from "./import-bundle.schemas.js";

describe("import-bundle.schemas", () => {
  it("accepts a valid bundle file descriptor", () => {
    const parsed = ImportBundleFileDescriptorSchema.parse({
      fileName: "customers.csv",
      role: "customers",
      mimeType: "text/csv",
      byteSize: 1024,
      importSessionId: null
    });
    expect(parsed.role).toBe("customers");
  });

  it("accepts chunk progress aligned with ADR ingest contract", () => {
    const parsed = ImportSessionChunkProgressSchema.parse({
      entityType: "customers",
      chunksTotal: 4,
      chunksDone: 2,
      rowsOk: 800,
      rowsFailed: 3,
      lastCursor: { rowOffset: 1000, lastSourceId: "sf-991" },
      lastIdempotencyKey: "sess:customers:1"
    });
    expect(parsed.chunksDone).toBe(2);
  });

  it("rejects bundle contracts with invalid status", () => {
    expect(() =>
      ImportBundleContractSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        companyId: "00000000-0000-4000-8000-000000000002",
        status: "uploaded",
        sourceSystem: "service_fusion",
        files: [],
        progress: {
          filesTotal: 0,
          filesMapped: 0,
          chunksCommitted: 0,
          chunksTotal: null
        },
        createdAt: "2026-10-23T00:00:00.000Z",
        updatedAt: "2026-10-23T00:00:00.000Z"
      })
    ).toThrow();
  });
});
