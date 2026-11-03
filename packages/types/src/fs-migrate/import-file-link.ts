import { z } from "zod";

export const AI_QUEUE_JOB_NAMES = {
  importFileLink: "import-file-link"
} as const;

export type AiQueueJobName = (typeof AI_QUEUE_JOB_NAMES)[keyof typeof AI_QUEUE_JOB_NAMES];

export const importFileLinkEntityTypeSchema = z.enum(["customer", "job", "asset", "unlinked"]);

export type ImportFileLinkEntityType = z.infer<typeof importFileLinkEntityTypeSchema>;

export const importFileLinkMatchMethodSchema = z.enum([
  "folder_heuristic",
  "filename_heuristic",
  "unresolved"
]);

export const importFileLinkProposalSchema = z.object({
  proposalId: z.string().uuid(),
  relativePath: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(255),
  suggestedEntityType: importFileLinkEntityTypeSchema,
  suggestedSourceId: z.string().max(256).nullable(),
  suggestedLabel: z.string().max(500),
  confidence: z.number().min(0).max(1),
  matchMethod: importFileLinkMatchMethodSchema,
  operatorStatus: z.enum(["pending", "confirmed", "rejected"]).default("pending"),
  operatorEntityType: importFileLinkEntityTypeSchema.optional(),
  operatorSourceId: z.string().max(256).nullable().optional()
});

export type ImportFileLinkProposal = z.infer<typeof importFileLinkProposalSchema>;

export const importFileLinkMatchTargetSchema = z.object({
  entityType: z.enum(["customer", "job", "asset"]),
  sourceId: z.string().min(1).max(256),
  label: z.string().min(1).max(500)
});

export const importFileLinkJobDataSchema = z.object({
  companyId: z.string().uuid(),
  importBundleId: z.string().uuid(),
  sourceSystem: z.string().min(1).max(64),
  targets: z.object({
    customers: z.array(
      z.object({
        sourceId: z.string().min(1).max(256),
        displayName: z.string().min(1).max(500)
      })
    ),
    jobs: z.array(
      z.object({
        sourceId: z.string().min(1).max(256),
        label: z.string().min(1).max(500)
      })
    ),
    assets: z.array(
      z.object({
        sourceId: z.string().min(1).max(256),
        label: z.string().min(1).max(500)
      })
    )
  }),
  objects: z
    .array(
      z.object({
        vendorFileId: z.string().min(1).max(256),
        relativePath: z.string().min(1).max(1024)
      })
    )
    .min(1)
    .max(500),
  idempotencyKey: z.string().min(1).max(256)
});

export type ImportFileLinkJobData = z.infer<typeof importFileLinkJobDataSchema>;

export const importFileLinkPreviewResponseSchema = z.object({
  bundleId: z.string().uuid(),
  status: z.enum(["idle", "processing", "ready", "failed"]),
  proposals: z.array(importFileLinkProposalSchema),
  unresolvedCount: z.number().int().nonnegative(),
  lastRunAt: z.string().datetime().nullable()
});

export type ImportFileLinkPreviewResponse = z.infer<typeof importFileLinkPreviewResponseSchema>;

export const confirmImportFileLinkDecisionsBodySchema = z.object({
  decisions: z
    .array(
      z.object({
        proposalId: z.string().uuid(),
        action: z.enum(["confirm", "reject"]),
        entityType: importFileLinkEntityTypeSchema.optional(),
        sourceId: z.string().max(256).nullable().optional()
      })
    )
    .min(1)
});

export type ConfirmImportFileLinkDecisionsBody = z.infer<typeof confirmImportFileLinkDecisionsBodySchema>;

export function buildImportFileLinkIdempotencyKey(importBundleId: string): string {
  return `${importBundleId}:import-file-link:v1`;
}

export function buildImportFileLinkJobId(importBundleId: string): string {
  return `import-file-link-${importBundleId}`;
}
