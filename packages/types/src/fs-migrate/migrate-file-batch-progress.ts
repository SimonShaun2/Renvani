import { z } from "zod";

export const MigrateFileBatchFailedObjectSchema = z.object({
  vendorFileId: z.string().min(1).max(256),
  errorMessage: z.string().min(1).max(2_000)
});

export type MigrateFileBatchFailedObject = z.infer<typeof MigrateFileBatchFailedObjectSchema>;

export const MigrateFileBatchJobProgressSchema = z.object({
  batchIndex: z.number().int().nonnegative(),
  batchesTotal: z.number().int().positive(),
  objectsTotal: z.number().int().nonnegative(),
  objectsSucceeded: z.array(z.string().min(1).max(256)),
  objectsFailed: z.array(MigrateFileBatchFailedObjectSchema),
  status: z.enum(["in_progress", "partial_failure", "complete", "stub_complete"])
});

export type MigrateFileBatchJobProgress = z.infer<typeof MigrateFileBatchJobProgressSchema>;

export function parseMigrateFileBatchJobProgress(value: unknown): MigrateFileBatchJobProgress | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = MigrateFileBatchJobProgressSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function vendorFileIdsPendingRetry(
  objects: readonly { vendorFileId: string }[],
  progress: MigrateFileBatchJobProgress | null
): string[] {
  const succeeded = new Set(progress?.objectsSucceeded ?? []);
  return objects.map((object) => object.vendorFileId).filter((vendorFileId) => !succeeded.has(vendorFileId));
}

export function buildMigrateFileBatchJobProgress(
  payload: {
    batchIndex: number;
    batchesTotal: number;
    objects: readonly unknown[];
  },
  objectsSucceeded: readonly string[],
  objectsFailed: readonly MigrateFileBatchFailedObject[],
  status: MigrateFileBatchJobProgress["status"]
): MigrateFileBatchJobProgress {
  return {
    batchIndex: payload.batchIndex,
    batchesTotal: payload.batchesTotal,
    objectsTotal: payload.objects.length,
    objectsSucceeded: [...objectsSucceeded],
    objectsFailed: [...objectsFailed],
    status
  };
}
