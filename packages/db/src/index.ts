export { db } from "./client.js";
export type { Database } from "./client.js";
export {
  buildPostgresClientOptions,
  computeConnectionBudget,
  resolveDatabasePoolMax,
  type ConnectionBudgetInput,
  type ConnectionBudgetResult,
  type ProcessConnectionRole
} from "./connection-config.js";
export { isRetryablePostgresError } from "./postgres-errors.js";
export {
  loadMigrationJournalFromFile,
  scanMigrationSqlForDestructiveStatements,
  validateMigrationBundle,
  validateRepoMigrationBundle,
  type MigrationSafetyIssue,
  type MigrationSafetyResult
} from "./migration-safety.js";
export { runWithPostgresRetry, type RunWithPostgresRetryOptions } from "./postgres-retry.js";
export { runTransactionWithRetry, type RunTransactionWithRetryOptions, type TransactionCallback } from "./transactions.js";
export {
  REVENUE_SUMMARY_CACHE_TTL_SECONDS,
  buildRevenueSummaryCacheKey,
  computeRevenueSummarySnapshot,
  listActiveCompanyIdsForRevenueSummary
} from "./ai-revenue-helpers.js";
export type {
  RevenueSummaryCacheEntry,
  RevenueSummaryCountBucketRecord,
  RevenueSummaryTopRecommendationRecord,
  RevenueSummaryValueBucketRecord
} from "./ai-revenue-helpers.js";
export { emitEvent } from "./events.js";
export type { EmitEventContext } from "./events.js";
export { emitEventWithExecutor } from "./events.js";
export { markInvoiceOverdueIfNeeded } from "./invoice-helpers.js";
export type { InvoiceOverdueRecord } from "./invoice-helpers.js";
export {
  TENANT_SESSION_GUC,
  buildTenantSessionSetLocal,
  readTenantCompanyIdFromGucRow
} from "./tenant-session.js";
export { FS_MIGRATE_RLS_POLICY_CATALOG, type RlsPolicySpec } from "./rls-policy-catalog.js";
export { renderRlsPolicyStatements, renderStack10RlsMigrationSql } from "./rls-migration-sql.js";
export { runTransactionWithTenantSession } from "./run-with-tenant-session.js";
export { listM8ReactivationSignalsFromImportedJobHistory } from "./m8-job-history-reactivation-read.js";
export {
  evaluateLoyaltyReminderCandidatesForCompany,
  type EvaluateLoyaltyReminderCandidatesInput
} from "./loyalty-reminder-candidates-evaluate.js";
export {
  syncLoyaltyReminderDryRunRecommendations,
  type SyncLoyaltyDryRunRecommendationsResult
} from "./loyalty-reminder-dry-run-sync.js";
export * from "./schema.js";
export {
  listOpenQboSyncIssues,
  recordQboSyncIssue,
  resolveQboSyncIssueRecord
} from "./qbo-sync-issue.js";
export { resolveQboAccessTokenForCompany } from "./qbo-connection-runtime.js";
export { runQboSyncPullJob, runQboSyncPushJob } from "./qbo-sync-engine.js";
export {
  commitPriceBookRows,
  mapPriceBookRow,
  resolveInvoiceLineCatalogId,
  resolveSourceSystemForPriceBookImport,
  softDeletePriceBookImport,
  validatePriceBookRows,
  type ParsedImportRow,
  type PriceBookCommitResult,
  type PriceBookValidationResult
} from "./import-price-book-commit.js";
export {
  commitNoteImportRows,
  mapNoteImportRow,
  softDeleteNotesImport,
  validateNoteImportRows,
  type NotesValidationResult
} from "./import-notes-commit.js";
export { normalizeImportedPaymentMethod } from "./import-invoice-balance-commit.logic.js";
export {
  commitImportedInvoiceRows,
  commitImportedPaymentRows,
  type ImportInvoiceBalanceEntityResolver,
} from "./import-invoice-balance-commit.service.js";
export {
  commitCommunicationsRows,
  commitImportedCommunicationRows,
  mapCommunicationsRow,
  resolveSourceSystemForCommunicationsImport,
  softDeleteCommunicationsImport,
  validateCommunicationsRows,
  type ImportCommunicationsEntityResolver,
} from "./import-communications-commit.js";
export {
  commitImportedEstimateRows,
  commitImportedJobRows,
  createDbHistoryChunkResolver,
  type ImportHistoryChunkEntityResolver,
} from "./import-history-chunk-commit.service.js";
export {
  normalizeImportedAssetType,
  normalizeImportedIsoDate,
  parseImportedBoolean,
  pickLastServiceDate,
} from "./import-equipment-commit.logic.js";
export {
  buildLineageEquipmentResolver,
  commitImportedEquipmentRows,
  type ImportEquipmentEntityResolver,
} from "./import-equipment-commit.service.js";
