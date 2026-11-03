import { z } from "zod";

import {
  applyMigrateDedupeDecisionsBodySchema,
  createMigrateOnboardingSessionBodySchema,
  linkMigrateOnboardingFilesBodySchema,
  migrateOnboardingBundleSchema,
  migrateOnboardingCommitResponseSchema,
  migrateDedupePreviewResponseSchema,
  migrateOnboardingSourceCatalogEntrySchema,
  migrateRelationalPreviewResponseSchema,
  MIGRATE_ONBOARDING_CONTRACT_ID,
  setMigrateOnboardingSourceBodySchema
} from "./schemas.js";
import { migrateOnboardingIngestStatusResponseSchema } from "./ingest-status.schemas.js";
import {
  applySavedCardMigrationMappingsBodySchema,
  confirmStripeImportBodySchema,
  getSavedCardMigrationResponseSchema,
  savedCardMigrationSchema,
  sendSavedCardFallbackEmailBodySchema,
  startSavedCardMigrationBodySchema
} from "../../saved-card-migration/v1/schemas.js";

export { MIGRATE_ONBOARDING_CONTRACT_ID };

export const MIGRATE_ONBOARDING_WIZARD_API_CONTRACT_ID = "fsm.migrate-onboarding.wizard-api.v1";

export type MigrateOnboardingWizardHttpMethod = "GET" | "POST" | "PATCH";

export type MigrateOnboardingWizardRouteContract = {
  method: MigrateOnboardingWizardHttpMethod;
  path: string;
  requestBodySchemaId?: string;
  responseSchemaId: string;
};

/**
 * Authoritative wizard HTTP surface (must match `apps/api/src/routes/migrate-onboarding/index.ts`
 * and saved-card routes under the same bundle prefix).
 * Paths include the `/api/v1` prefix registered in `app.ts`.
 */
export const MIGRATE_ONBOARDING_WIZARD_API_ROUTES: readonly MigrateOnboardingWizardRouteContract[] = [
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sources",
    responseSchemaId: "migrateOnboardingSourceCatalogEntry[]"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions",
    requestBodySchemaId: "createMigrateOnboardingSessionBody",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/active",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "PATCH",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/source",
    requestBodySchemaId: "setMigrateOnboardingSourceBody",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "PATCH",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/files",
    requestBodySchemaId: "linkMigrateOnboardingFilesBody",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/confirm-mappings",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/acknowledge-preview",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/file-link/run",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/file-link/preview",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "PATCH",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/file-link/decisions",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/dedupe-preview",
    responseSchemaId: "migrateDedupePreviewResponse"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/relational-preview",
    responseSchemaId: "migrateRelationalPreviewResponse"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/ingest-status",
    responseSchemaId: "migrateOnboardingIngestStatusResponse"
  },
  {
    method: "PATCH",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/dedupe-decisions",
    requestBodySchemaId: "applyMigrateDedupeDecisionsBody",
    responseSchemaId: "migrateOnboardingBundle"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/commit",
    responseSchemaId: "migrateOnboardingCommitResponse"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/saved-card-migration",
    requestBodySchemaId: "startSavedCardMigrationBody",
    responseSchemaId: "savedCardMigration"
  },
  {
    method: "GET",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/saved-card-migration",
    responseSchemaId: "savedCardMigrationStatus"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/saved-card-migration/confirm-stripe-import",
    requestBodySchemaId: "confirmStripeImportBody",
    responseSchemaId: "savedCardMigration"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/saved-card-migration/apply-mappings",
    requestBodySchemaId: "applySavedCardMigrationMappingsBody",
    responseSchemaId: "savedCardMigration"
  },
  {
    method: "POST",
    path: "/api/v1/migrate/onboarding/sessions/:bundleId/saved-card-migration/send-fallback-email",
    requestBodySchemaId: "sendSavedCardFallbackEmailBody",
    responseSchemaId: "savedCardMigration"
  }
];

export const migrateOnboardingWizardRequestSchemas = {
  createMigrateOnboardingSessionBody: createMigrateOnboardingSessionBodySchema,
  setMigrateOnboardingSourceBody: setMigrateOnboardingSourceBodySchema,
  linkMigrateOnboardingFilesBody: linkMigrateOnboardingFilesBodySchema,
  applyMigrateDedupeDecisionsBody: applyMigrateDedupeDecisionsBodySchema,
  startSavedCardMigrationBody: startSavedCardMigrationBodySchema,
  confirmStripeImportBody: confirmStripeImportBodySchema,
  applySavedCardMigrationMappingsBody: applySavedCardMigrationMappingsBodySchema,
  sendSavedCardFallbackEmailBody: sendSavedCardFallbackEmailBodySchema
} as const;

export const migrateOnboardingWizardResponseSchemas = {
  migrateOnboardingBundle: migrateOnboardingBundleSchema,
  migrateOnboardingSourceCatalogEntry: migrateOnboardingSourceCatalogEntrySchema,
  migrateDedupePreviewResponse: migrateDedupePreviewResponseSchema,
  migrateRelationalPreviewResponse: migrateRelationalPreviewResponseSchema,
  migrateOnboardingCommitResponse: migrateOnboardingCommitResponseSchema,
  migrateOnboardingIngestStatusResponse: migrateOnboardingIngestStatusResponseSchema,
  savedCardMigration: savedCardMigrationSchema,
  savedCardMigrationStatus: getSavedCardMigrationResponseSchema
} as const;
