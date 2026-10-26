import { z } from "zod";

import { MigrateFileBatchObjectSchema } from "./import-queue-jobs.js";

export const MIGRATE_PHOTO_LINK_PREVIEW_CONTRACT_ID = "fsm.fs-migrate.photo-link-preview.v1";

export const MigratePhotoUploadObjectSchema = MigrateFileBatchObjectSchema.extend({
  r2Key: z.string().min(1).max(2048),
  uploadedAt: z.string().datetime()
});

export type MigratePhotoUploadObject = z.infer<typeof MigratePhotoUploadObjectSchema>;

export const MigratePhotoMigrationStateSchema = z.object({
  mediaImportSessionId: z.string().uuid(),
  clientBatches: z.record(
    z.string().min(1).max(128),
    z.object({
      receivedAt: z.string().datetime(),
      objectCount: z.number().int().nonnegative()
    })
  ),
  objects: z.array(MigratePhotoUploadObjectSchema)
});

export type MigratePhotoMigrationState = z.infer<typeof MigratePhotoMigrationStateSchema>;

export const MigratePhotoLinkSuggestionSchema = z.object({
  vendorFileId: z.string().min(1).max(256),
  relativePath: z.string().min(1).max(1024),
  r2Key: z.string().min(1).max(2048),
  mimeType: z.string().max(128).optional(),
  confidence: z.number().min(0).max(1),
  suggestedCustomerId: z.string().uuid().nullable(),
  suggestedCustomerLabel: z.string().nullable(),
  suggestedJobId: z.string().uuid().nullable(),
  suggestedJobLabel: z.string().nullable(),
  suggestedAssetId: z.string().uuid().nullable(),
  suggestedAssetLabel: z.string().nullable(),
  matchReason: z.string().nullable()
});

export type MigratePhotoLinkSuggestion = z.infer<typeof MigratePhotoLinkSuggestionSchema>;

export const MigratePhotoLinkDecisionSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  skip: z.boolean().optional()
});

export type MigratePhotoLinkDecision = z.infer<typeof MigratePhotoLinkDecisionSchema>;

export const MigratePhotoLinkPreviewResponseSchema = z.object({
  bundleId: z.string().uuid(),
  importBundleId: z.string().uuid(),
  mediaImportSessionId: z.string().uuid(),
  upload: z.object({
    objectCount: z.number().int().nonnegative(),
    clientBatchCount: z.number().int().nonnegative()
  }),
  suggestions: z.array(MigratePhotoLinkSuggestionSchema),
  decisions: z.record(z.string(), MigratePhotoLinkDecisionSchema)
});

export type MigratePhotoLinkPreviewResponse = z.infer<typeof MigratePhotoLinkPreviewResponseSchema>;

export const ApplyMigratePhotoLinkDecisionsBodySchema = z.object({
  decisions: z.record(z.string().min(1).max(256), MigratePhotoLinkDecisionSchema)
});

export type ApplyMigratePhotoLinkDecisionsBody = z.infer<typeof ApplyMigratePhotoLinkDecisionsBodySchema>;

export const MigratePhotoUploadStatusResponseSchema = z.object({
  bundleId: z.string().uuid(),
  mediaImportSessionId: z.string().uuid(),
  objectCount: z.number().int().nonnegative(),
  clientBatchCount: z.number().int().nonnegative(),
  resumable: z.literal(true)
});

export type MigratePhotoUploadStatusResponse = z.infer<typeof MigratePhotoUploadStatusResponseSchema>;

export function buildMigratePhotoVendorFileId(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").trim();
  return normalized.length > 240 ? normalized.slice(-240) : normalized;
}
