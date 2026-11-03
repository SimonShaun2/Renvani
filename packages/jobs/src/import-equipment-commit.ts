import { z } from "zod";

export const IMPORT_EQUIPMENT_COMMIT_JOB_NAME = "import-equipment-commit";

export const ImportEquipmentCommitPayloadSchema = z.object({
  companyId: z.string().uuid(),
  importSessionId: z.string().uuid(),
  sourceSystem: z.string().min(1).max(64),
  chunkIndex: z.number().int().nonnegative().default(0),
  chunksTotal: z.number().int().positive().default(1),
  rowWindow: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .optional(),
  lineageMaps: z
    .object({
      customers: z.record(z.string(), z.string().uuid()).optional(),
      properties: z.record(z.string(), z.string().uuid()).optional(),
      jobs: z
        .record(
          z.string(),
          z.object({
            id: z.string().uuid(),
            completedAt: z.string().datetime().optional().nullable(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type ImportEquipmentCommitPayload = z.infer<typeof ImportEquipmentCommitPayloadSchema>;

export function buildImportEquipmentCommitJobId(importSessionId: string, chunkIndex: number): string {
  return `import-equipment-commit-${importSessionId}-${chunkIndex}`;
}
