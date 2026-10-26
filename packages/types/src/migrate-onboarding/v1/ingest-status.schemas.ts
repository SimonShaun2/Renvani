import { z } from "zod";

import { ImportSessionChunkProgressSchema } from "../../import-bundle.schemas.js";

export const importSessionIngestStatusSchema = z.object({
  importSessionId: z.string().uuid(),
  entityType: z.string().min(1),
  fileName: z.string().min(1),
  status: z.string().min(1),
  chunkProgress: ImportSessionChunkProgressSchema.nullable(),
  priceBookLineSeeds: z.number().int().nonnegative().nullable(),
  importedRows: z.number().int().nonnegative().nullable()
});

export type ImportSessionIngestStatus = z.infer<typeof importSessionIngestStatusSchema>;

export const migrateOnboardingIngestStatusResponseSchema = z.object({
  bundleId: z.string().uuid(),
  sessions: z.array(importSessionIngestStatusSchema)
});

export type MigrateOnboardingIngestStatusResponse = z.infer<
  typeof migrateOnboardingIngestStatusResponseSchema
>;
