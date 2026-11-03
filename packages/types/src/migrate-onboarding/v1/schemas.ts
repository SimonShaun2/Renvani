import { z } from "zod";

import { importFileLinkProposalSchema } from "../../fs-migrate/import-file-link.js";
import { savedCardMigrationWizardRefSchema } from "../../saved-card-migration/v1/schemas.js";
import { importEntityTypeSchema } from "../import-entity-bridge.js";

export const MIGRATE_ONBOARDING_CONTRACT_ID = "fsm.migrate-onboarding.v1";

/** Stable preset ids for FS-MIGRATE onboarding step 1 (ADR-FS-MIGRATE §1). */
export const migrateSourceSystemIdSchema = z.enum([
  "service_fusion",
  "jobber",
  "servicetitan",
  "housecall_pro",
  "qbo",
  "qbd",
  "manual_csv"
]);

export type MigrateSourceSystemId = z.infer<typeof migrateSourceSystemIdSchema>;

export const migrateOnboardingWizardStepSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);

export type MigrateOnboardingWizardStep = z.infer<typeof migrateOnboardingWizardStepSchema>;

export const migrateOnboardingBundleStatusSchema = z.enum([
  "active",
  "committing",
  "completed",
  "abandoned"
]);

export type MigrateOnboardingBundleStatus = z.infer<typeof migrateOnboardingBundleStatusSchema>;

export const importDuplicateActionSchema = z.enum(["skip", "update_existing", "import_new"]);

export type ImportDuplicateAction = z.infer<typeof importDuplicateActionSchema>;

export const migrateOnboardingFileRefSchema = z.object({
  importSessionId: z.string().uuid(),
  entityType: importEntityTypeSchema,
  fileName: z.string().min(1).max(255),
  label: z.string().max(120).optional()
});

export type MigrateOnboardingFileRef = z.infer<typeof migrateOnboardingFileRefSchema>;

export const migrateOnboardingStepStateSchema = z.object({
  sourceSystem: migrateSourceSystemIdSchema.optional(),
  files: z.array(migrateOnboardingFileRefSchema).default([]),
  mappingsConfirmedAt: z.string().datetime().optional(),
  fileLinkStatus: z.enum(["idle", "processing", "ready", "failed"]).optional(),
  fileLinkProposals: z.array(importFileLinkProposalSchema).optional(),
  fileLinkLastRunAt: z.string().datetime().optional(),
  fileLinkConfirmedAt: z.string().datetime().optional(),
  previewReviewedAt: z.string().datetime().optional(),
  commitStartedAt: z.string().datetime().optional(),
  commitCompletedAt: z.string().datetime().optional(),
  savedCardMigration: savedCardMigrationWizardRefSchema.optional()
});

export type MigrateOnboardingStepState = z.infer<typeof migrateOnboardingStepStateSchema>;

export const migrateOnboardingBundleSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  createdById: z.string().uuid().nullable(),
  status: migrateOnboardingBundleStatusSchema,
  wizardStep: migrateOnboardingWizardStepSchema,
  stepState: migrateOnboardingStepStateSchema,
  dedupeDecisions: z.record(z.string(), importDuplicateActionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  abandonedAt: z.string().datetime().nullable()
});

export type MigrateOnboardingBundle = z.infer<typeof migrateOnboardingBundleSchema>;

export const createMigrateOnboardingSessionBodySchema = z.object({
  resumeActive: z.boolean().optional()
});

export type CreateMigrateOnboardingSessionBody = z.infer<typeof createMigrateOnboardingSessionBodySchema>;

export const migrateOnboardingBundleIdParamsSchema = z.object({
  bundleId: z.string().uuid()
});

export const setMigrateOnboardingSourceBodySchema = z.object({
  sourceSystem: migrateSourceSystemIdSchema
});

export type SetMigrateOnboardingSourceBody = z.infer<typeof setMigrateOnboardingSourceBodySchema>;

export const linkMigrateOnboardingFilesBodySchema = z.object({
  files: z.array(migrateOnboardingFileRefSchema).min(1)
});

export type LinkMigrateOnboardingFilesBody = z.infer<typeof linkMigrateOnboardingFilesBodySchema>;

export const migrateDedupeCollisionSchema = z.object({
  collisionKey: z.string().min(1),
  importSessionId: z.string().uuid(),
  rowNumber: z.number().int().positive(),
  rowLabel: z.string(),
  matchReason: z.enum(["email", "phone", "name"]),
  matchedCustomerId: z.string().uuid(),
  matchedCustomerName: z.string(),
  matchedCustomerEmail: z.string().nullable(),
  matchedCustomerPhone: z.string().nullable(),
  sourceValues: z.record(z.string(), z.string()),
  action: importDuplicateActionSchema
});

export type MigrateDedupeCollision = z.infer<typeof migrateDedupeCollisionSchema>;

export const migrateDedupePreviewResponseSchema = z.object({
  bundleId: z.string().uuid(),
  collisions: z.array(migrateDedupeCollisionSchema),
  unresolvedCount: z.number().int().nonnegative(),
  totalDuplicateRows: z.number().int().nonnegative()
});

export type MigrateDedupePreviewResponse = z.infer<typeof migrateDedupePreviewResponseSchema>;

const relationalPreviewNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["customer", "property", "job", "estimate"]),
  label: z.string(),
  sourceRow: z.number().int().positive()
});

const relationalHistoryDepthSchema = z.object({
  entity: z.enum(["jobs", "estimates"]),
  datedRowCount: z.number().int().nonnegative(),
  undatedRowCount: z.number().int().nonnegative(),
  earliestBusinessDate: z.string().nullable(),
  latestBusinessDate: z.string().nullable(),
  spanYears: z.number().nullable(),
  meetsMultiYearThreshold: z.boolean()
});

const relationalJoinIssueSchema = z.object({
  code: z.enum([
    "duplicate_customer_key",
    "duplicate_property_key",
    "duplicate_job_key",
    "duplicate_estimate_key",
    "missing_join_key",
    "missing_business_date",
    "orphan_property",
    "orphan_job",
    "orphan_estimate"
  ]),
  message: z.string(),
  sourceRow: z.number().int().positive().optional(),
  field: z.string().optional(),
  joinKey: z.string().optional()
});

export const migrateRelationalPreviewResponseSchema = z.object({
  bundleId: z.string().uuid(),
  files: z.array(
    z.object({
      importSessionId: z.string().uuid(),
      kind: z.enum(["customers", "properties", "jobs", "estimates"]),
      fileName: z.string()
    })
  ),
  graph: z.object({
    customers: z.array(relationalPreviewNodeSchema),
    properties: z.array(relationalPreviewNodeSchema),
    jobs: z.array(relationalPreviewNodeSchema),
    estimates: z.array(relationalPreviewNodeSchema),
    edges: z.array(
      z.object({
        fromCustomerId: z.string(),
        toPropertyId: z.string(),
        joinKey: z.string()
      })
    ),
    propertyJobEdges: z.array(
      z.object({
        fromPropertyId: z.string(),
        toJobId: z.string(),
        joinKey: z.string()
      })
    ),
    jobEstimateEdges: z.array(
      z.object({
        fromJobId: z.string(),
        toEstimateId: z.string(),
        joinKey: z.string()
      })
    ),
    orphanPropertyCount: z.number().int().nonnegative(),
    orphanJobCount: z.number().int().nonnegative(),
    orphanEstimateCount: z.number().int().nonnegative(),
    unmatchedCustomerKeys: z.array(z.string()),
    unmatchedPropertyKeys: z.array(z.string()),
    unmatchedJobKeys: z.array(z.string()),
    historyDepth: z.array(relationalHistoryDepthSchema),
    joinIssues: z.array(relationalJoinIssueSchema),
    stats: z.object({
      customerCount: z.number().int().nonnegative(),
      propertyCount: z.number().int().nonnegative(),
      jobCount: z.number().int().nonnegative(),
      estimateCount: z.number().int().nonnegative(),
      linkedPropertyCount: z.number().int().nonnegative(),
      linkedJobCount: z.number().int().nonnegative(),
      linkedEstimateCount: z.number().int().nonnegative()
    })
  })
});

export type MigrateRelationalPreviewResponse = z.infer<typeof migrateRelationalPreviewResponseSchema>;

export const applyMigrateDedupeDecisionsBodySchema = z.object({
  decisions: z
    .array(
      z.object({
        collisionKey: z.string().min(1),
        action: importDuplicateActionSchema
      })
    )
    .min(1)
});

export type ApplyMigrateDedupeDecisionsBody = z.infer<typeof applyMigrateDedupeDecisionsBodySchema>;

export const migrateOnboardingCommitResponseSchema = z.object({
  bundleId: z.string().uuid(),
  status: migrateOnboardingBundleStatusSchema,
  importSessionIds: z.array(z.string().uuid()),
  startedAt: z.string().datetime()
});

export type MigrateOnboardingCommitResponse = z.infer<typeof migrateOnboardingCommitResponseSchema>;

export const migrateOnboardingOAuthGateSchema = z.object({
  enabled: z.boolean(),
  founderGate: z.boolean().optional(),
  message: z.string().optional()
});

export const migrateOnboardingSourceCatalogEntrySchema = z.object({
  id: migrateSourceSystemIdSchema,
  label: z.string(),
  description: z.string(),
  recommendedExports: z.array(z.string()),
  catalogTier: z.enum(["primary", "export_tips"]).default("export_tips"),
  importPath: z.enum(["generic_ai_guided", "quickbooks_file_export"]).default("generic_ai_guided"),
  presetAliasFor: migrateSourceSystemIdSchema.optional(),
  oauth: migrateOnboardingOAuthGateSchema.optional()
});

export type MigrateOnboardingSourceCatalogEntry = z.infer<typeof migrateOnboardingSourceCatalogEntrySchema>;
