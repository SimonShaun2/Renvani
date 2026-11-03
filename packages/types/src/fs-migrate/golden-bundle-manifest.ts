import { z } from "zod";

import { migrateSourceSystemIdSchema } from "../migrate-onboarding/v1/schemas.js";

/** Tabular entity slots in FS-MIGRATE golden bundles (epic §3). */
export const goldenBundleEntityTypeSchema = z.enum([
  "customers",
  "properties",
  "jobs",
  "invoices",
  "payments",
  "products",
  "equipment",
  "estimates",
  "maintenance_plans",
  "notes",
  "communications",
  "report_snapshot",
  "vip_membership_tiers",
  "vip_memberships"
]);

export type GoldenBundleEntityType = z.infer<typeof goldenBundleEntityTypeSchema>;

export const goldenBundleJoinLinkSchema = z.object({
  /** Relative path of the parent file within the bundle directory. */
  parentFile: z.string().min(1).max(255),
  /** Column on this file that references the parent row. */
  localColumn: z.string().min(1).max(128),
  /** Column on the parent file that is referenced (typically vendor primary key). */
  parentColumn: z.string().min(1).max(128)
});

export type GoldenBundleJoinLink = z.infer<typeof goldenBundleJoinLinkSchema>;

export const goldenBundleFileSpecSchema = z.object({
  relativePath: z.string().min(1).max(255),
  entityType: goldenBundleEntityTypeSchema,
  /** Used with `inferImportSourcePresetFromHeaders` entity hint (`customers` | `products` | `invoices`). */
  presetEntityHint: z.enum(["customers", "products", "invoices"]),
  joinLink: goldenBundleJoinLinkSchema.optional(),
  /** ISO date column used for epic §6 history depth checks (jobs/invoices). */
  businessDateColumn: z.string().min(1).max(128).optional()
});

export type GoldenBundleFileSpec = z.infer<typeof goldenBundleFileSpecSchema>;

/**
 * Large job-history export split across multiple on-disk CSV parts for worker chunk ingest (ADR §3).
 * Logical worker windows use `workerRowChunkSize` across the concatenated row stream.
 */
export const goldenBundleChunkedJobHistorySpecSchema = z.object({
  relativeDir: z.string().min(1).max(255),
  /** printf-style pattern with `%02d` for the part index (e.g. `part-%02d.csv`). */
  partFileNameFormat: z.string().min(1).max(128),
  partCount: z.number().int().positive(),
  rowsPerPart: z.number().int().positive(),
  totalDataRows: z.number().int().positive(),
  /** Row window size for `import-chunk-commit` plans over the virtual concatenated file. */
  workerRowChunkSize: z.number().int().positive(),
  entityType: z.literal("jobs"),
  presetEntityHint: z.enum(["customers", "products", "invoices"]),
  joinLink: goldenBundleJoinLinkSchema,
  businessDateColumn: z.string().min(1).max(128)
});

export type GoldenBundleChunkedJobHistorySpec = z.infer<typeof goldenBundleChunkedJobHistorySpecSchema>;

export const goldenImportBundleManifestSchema = z.object({
  fixtureId: z.string().min(1).max(64),
  sourceSystem: migrateSourceSystemIdSchema,
  label: z.string().min(1).max(120),
  description: z.string().max(500),
  files: z.array(goldenBundleFileSpecSchema).min(1),
  mediaRelativePaths: z.array(z.string().min(1).max(512)).default([]),
  chunkedJobHistory: goldenBundleChunkedJobHistorySpecSchema.optional(),
  /** Minimum years between earliest and latest job/invoice business dates (epic §6). */
  requiredHistorySpanYears: z.number().positive().optional()
});

export type GoldenImportBundleManifest = z.infer<typeof goldenImportBundleManifestSchema>;

export const GOLDEN_IMPORT_BUNDLE_FIXTURE_VERSION = "v1";
