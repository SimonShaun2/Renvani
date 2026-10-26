import { z } from "zod";

export const IMPORT_QUEUE_JOB_NAMES = {
  mapCsvColumns: "map-csv-columns",
  validateCsvRows: "validate-csv-rows",
  executeImport: "execute-import",
  importChunkCommit: "import-chunk-commit",
  migrateFileBatch: "migrate-file-batch"
} as const;

export type ImportQueueJobName =
  (typeof IMPORT_QUEUE_JOB_NAMES)[keyof typeof IMPORT_QUEUE_JOB_NAMES];

export const MigrateFileBatchCursorSchema = z.object({
  byteOffset: z.number().int().nonnegative().optional(),
  lastVendorFileId: z.string().max(256).optional()
});

export type MigrateFileBatchCursor = z.infer<typeof MigrateFileBatchCursorSchema>;

export const MigrateFileBatchObjectSchema = z.object({
  vendorFileId: z.string().min(1).max(256),
  relativePath: z.string().min(1).max(1024),
  r2Key: z.string().min(1).max(2048).optional(),
  mimeType: z.string().max(128).optional()
});

export type MigrateFileBatchObject = z.infer<typeof MigrateFileBatchObjectSchema>;

export const MigrateFileBatchJobDataSchema = z.object({
  companyId: z.string().uuid(),
  importSessionId: z.string().uuid(),
  importBundleId: z.string().uuid(),
  sourceSystem: z.string().min(1).max(64),
  batchIndex: z.number().int().nonnegative(),
  batchesTotal: z.number().int().positive(),
  idempotencyKey: z.string().min(1).max(256),
  cursor: MigrateFileBatchCursorSchema.optional(),
  objects: z.array(MigrateFileBatchObjectSchema).min(1).max(500)
});

export type MigrateFileBatchJobData = z.infer<typeof MigrateFileBatchJobDataSchema>;

export const MigrateFileBatchManifestBatchSchema = z.object({
  batchIndex: z.number().int().nonnegative(),
  batchesTotal: z.number().int().positive(),
  cursor: MigrateFileBatchCursorSchema.optional(),
  objects: z.array(MigrateFileBatchObjectSchema).min(1).max(500)
});

export const MigrateFileBatchManifestSchema = z.object({
  importBundleId: z.string().uuid(),
  sourceSystem: z.string().min(1).max(64),
  batches: z.array(MigrateFileBatchManifestBatchSchema).min(1)
});

export type MigrateFileBatchManifest = z.infer<typeof MigrateFileBatchManifestSchema>;

export function buildMigrateFileBatchIdempotencyKey(importSessionId: string, batchIndex: number): string {
  return `${importSessionId}:migrate-file-batch:${batchIndex}`;
}

export function buildMigrateFileBatchJobId(importSessionId: string, batchIndex: number): string {
  return `migrate-file-batch-${importSessionId}-${batchIndex}`;
}

export function buildMapCsvColumnsIdempotencyKey(importSessionId: string): string {
  return `${importSessionId}:map-csv-columns`;
}

export function buildMapCsvColumnsJobId(importSessionId: string): string {
  return `map-csv-columns-${importSessionId}`;
}
