import { describe, expect, it } from "vitest";
import {
  ImportChunkCommitPayloadSchema,
  buildImportChunkIdempotencyKey,
} from "./import-chunk-commit.js";

describe("ImportChunkCommitPayloadSchema", () => {
  it("accepts a minimal valid chunk payload", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const parsed = ImportChunkCommitPayloadSchema.parse({
      companyId: "22222222-2222-4222-8222-222222222222",
      importSessionId: sessionId,
      sourceSystem: "jobber",
      entityType: "customers",
      chunkIndex: 0,
      chunksTotal: 10,
      cursor: { rowOffset: 0 },
      idempotencyKey: buildImportChunkIdempotencyKey(sessionId, "customers", 0),
    });
    expect(parsed.chunkIndex).toBe(0);
    expect(parsed.idempotencyKey).toBe(`${sessionId}:customers:0`);
  });

  it("rejects chunksTotal below 1", () => {
    expect(() =>
      ImportChunkCommitPayloadSchema.parse({
        companyId: "22222222-2222-4222-8222-222222222222",
        importSessionId: "11111111-1111-4111-8111-111111111111",
        sourceSystem: "jobber",
        entityType: "jobs",
        chunkIndex: 0,
        chunksTotal: 0,
        cursor: {},
        idempotencyKey: "x",
      }),
    ).toThrow();
  });
});
