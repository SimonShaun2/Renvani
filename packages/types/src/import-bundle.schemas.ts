import { z } from "zod";

export const ImportBundleStatusSchema = z.enum([
  "open",
  "preview",
  "importing",
  "completed",
  "failed"
]);
export type ImportBundleStatusSchemaValue = z.infer<typeof ImportBundleStatusSchema>;

export const ImportBundleFileRoleSchema = z.enum([
  "customers",
  "properties",
  "jobs",
  "invoices",
  "equipment",
  "payments",
  "unknown"
]);
export type ImportBundleFileRoleSchemaValue = z.infer<typeof ImportBundleFileRoleSchema>;

export const ImportBundleFileDescriptorSchema = z.object({
  fileName: z.string().min(1),
  role: ImportBundleFileRoleSchema,
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  importSessionId: z.string().uuid().nullable().optional()
});

export const ImportBundleProgressSchema = z.object({
  filesTotal: z.number().int().nonnegative(),
  filesMapped: z.number().int().nonnegative(),
  chunksCommitted: z.number().int().nonnegative(),
  chunksTotal: z.number().int().nonnegative().nullable()
});

export const ImportBundleContractSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  status: ImportBundleStatusSchema,
  sourceSystem: z.string().min(1).nullable(),
  files: z.array(ImportBundleFileDescriptorSchema),
  progress: ImportBundleProgressSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ImportRowChunkWindowSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative()
});

export const ImportSessionChunkProgressSchema = z.object({
  entityType: z.string().min(1),
  chunksTotal: z.number().int().nonnegative(),
  chunksDone: z.number().int().nonnegative(),
  rowsOk: z.number().int().nonnegative(),
  rowsFailed: z.number().int().nonnegative(),
  lastCursor: z
    .object({
      rowOffset: z.number().int().nonnegative().optional(),
      lastSourceId: z.string().min(1).optional()
    })
    .optional(),
  lastIdempotencyKey: z.string().min(1).optional()
});

export const ImportSessionIngestProgressResponseSchema = z.object({
  importSessionId: z.string().uuid(),
  status: z.string().min(1),
  entityType: z.string().min(1),
  fileName: z.string().min(1),
  chunk: ImportSessionChunkProgressSchema.nullable()
});

export const MigrateOnboardingIngestProgressSessionSchema = z.object({
  importSessionId: z.string().uuid(),
  entityType: z.string().min(1),
  status: z.string().min(1),
  fileName: z.string().min(1),
  chunk: ImportSessionChunkProgressSchema.nullable()
});

export const MigrateOnboardingIngestProgressResponseSchema = z.object({
  bundleId: z.string().uuid(),
  progress: ImportBundleProgressSchema,
  sessions: z.array(MigrateOnboardingIngestProgressSessionSchema)
});
