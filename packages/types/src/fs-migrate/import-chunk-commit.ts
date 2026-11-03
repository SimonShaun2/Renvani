import { z } from "zod";

export const IMPORT_CHUNK_COMMIT_JOB_NAME = "import-chunk-commit";

const importEntityTypeSchema = z.enum([
  "customers",
  "properties",
  "assets",
  "jobs",
  "estimates",
  "invoices",
]);

export const ImportChunkCommitCursorSchema = z.object({
  byteOffset: z.number().int().nonnegative().optional(),
  rowOffset: z.number().int().nonnegative().optional(),
  lastSourceId: z.string().optional(),
  payloadFingerprint: z.string().optional(),
});

export type ImportChunkCommitCursor = z.infer<typeof ImportChunkCommitCursorSchema>;

export const ImportChunkCommitPayloadSchema = z.object({
  companyId: z.string().uuid(),
  importSessionId: z.string().uuid(),
  importBundleId: z.string().uuid().optional(),
  sourceSystem: z.string().min(1).max(64),
  entityType: importEntityTypeSchema,
  chunkIndex: z.number().int().nonnegative(),
  chunksTotal: z.number().int().positive(),
  cursor: ImportChunkCommitCursorSchema,
  idempotencyKey: z.string().min(1).max(255),
  rowWindow: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .optional(),
});

export type ImportChunkCommitPayload = z.infer<typeof ImportChunkCommitPayloadSchema>;

export const ImportChunkCommitManifestChunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  chunksTotal: z.number().int().positive(),
  cursor: ImportChunkCommitCursorSchema.default({}),
  rowWindow: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .optional(),
});

export const ImportChunkCommitManifestSchema = z.object({
  importBundleId: z.string().uuid().optional(),
  sourceSystem: z.string().min(1).max(64),
  entityType: importEntityTypeSchema,
  chunks: z.array(ImportChunkCommitManifestChunkSchema).min(1),
});

export type ImportChunkCommitManifest = z.infer<typeof ImportChunkCommitManifestSchema>;

export function buildImportChunkIdempotencyKey(
  importSessionId: string,
  entityType: string,
  chunkIndex: number,
): string {
  return `${importSessionId}:${entityType}:${chunkIndex}`;
}

export function buildImportChunkCommitJobId(importSessionId: string, chunkIndex: number): string {
  return `import-chunk-commit-${importSessionId}-${chunkIndex}`;
}
