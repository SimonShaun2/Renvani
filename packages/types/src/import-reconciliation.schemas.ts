import { z } from "zod";

export const IMPORT_SESSION_RECONCILIATION_REPORT_KEY = "importReconciliationReport";

export const ImportReconciliationReasonCodeSchema = z.enum([
  "validation_error",
  "duplicate_skipped",
  "chunk_commit_failed",
  "other_skipped"
]);

export type ImportReconciliationReasonCode = z.infer<typeof ImportReconciliationReasonCodeSchema>;

export const ImportReconciliationReasonSummarySchema = z.object({
  code: ImportReconciliationReasonCodeSchema,
  label: z.string().min(1),
  count: z.number().int().nonnegative()
});

export type ImportReconciliationReasonSummary = z.infer<
  typeof ImportReconciliationReasonSummarySchema
>;

export const ImportSessionReconciliationReportSchema = z.object({
  version: z.literal(1),
  importSessionId: z.string().uuid(),
  entityType: z.string().min(1),
  fileName: z.string().min(1),
  status: z.string().min(1),
  sourceRowCount: z.number().int().nonnegative(),
  committedRowCount: z.number().int().nonnegative(),
  skippedRowCount: z.number().int().nonnegative(),
  failedRowCount: z.number().int().nonnegative(),
  reasonSummaries: z.array(ImportReconciliationReasonSummarySchema),
  skippedRowsCsvObjectKey: z.string().min(1).nullable(),
  computedAt: z.string().datetime()
});

export type ImportSessionReconciliationReport = z.infer<
  typeof ImportSessionReconciliationReportSchema
>;

export const importSessionReconciliationResponseSchema = z.object({
  report: ImportSessionReconciliationReportSchema,
  skippedRowsDownloadUrl: z.string().url().nullable()
});

export type ImportSessionReconciliationResponse = z.infer<
  typeof importSessionReconciliationResponseSchema
>;
