import { z } from "zod";

export const SAVED_CARD_MIGRATION_CONTRACT_ID = "fsm.saved-card-migration.v1";

export const savedCardMigrationStatusSchema = z.enum([
  "requested",
  "awaiting_stripe_import",
  "mapping",
  "completed",
  "failed",
  "fallback_required"
]);

export type SavedCardMigrationStatus = z.infer<typeof savedCardMigrationStatusSchema>;

export const savedCardMigrationMappingSummarySchema = z.object({
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
});

export type SavedCardMigrationMappingSummary = z.infer<typeof savedCardMigrationMappingSummarySchema>;

export const savedCardMigrationCustomerMappingSchema = z.object({
  renvaniCustomerId: z.string().uuid().nullable(),
  email: z.string().email().nullable(),
  stripeCustomerId: z.string().min(1),
  stripePaymentMethodId: z.string().min(1),
  matchMethod: z.enum(["renvani_customer_id", "email", "unmatched"]),
  status: z.enum(["pending", "attached", "failed", "fallback_required"]),
  paymentMethodLabel: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional()
});

export type SavedCardMigrationCustomerMapping = z.infer<typeof savedCardMigrationCustomerMappingSchema>;

export const savedCardMigrationWizardRefSchema = z.object({
  migrationId: z.string().uuid(),
  status: savedCardMigrationStatusSchema,
  updatedAt: z.string().datetime()
});

export type SavedCardMigrationWizardRef = z.infer<typeof savedCardMigrationWizardRefSchema>;

export const savedCardMigrationSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  importBundleId: z.string().uuid().nullable(),
  status: savedCardMigrationStatusSchema,
  priorProcessorName: z.string().min(1).max(120),
  stripeImportReference: z.string().nullable(),
  mappingSummary: savedCardMigrationMappingSummarySchema,
  customerMappings: z.array(savedCardMigrationCustomerMappingSchema),
  lastError: z.string().nullable(),
  fallbackEmailSentAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Renvani-branded ops copy; Stripe hosts card data import. */
  stripePanImportInstructionsUrl: z.string().url()
});

export type SavedCardMigration = z.infer<typeof savedCardMigrationSchema>;

export const startSavedCardMigrationBodySchema = z.object({
  priorProcessorName: z.string().min(1).max(120),
  stripeImportReference: z.string().min(1).max(255).optional()
});

export type StartSavedCardMigrationBody = z.infer<typeof startSavedCardMigrationBodySchema>;

export const confirmStripeImportBodySchema = z.object({
  stripeImportReference: z.string().min(1).max(255)
});

export type ConfirmStripeImportBody = z.infer<typeof confirmStripeImportBodySchema>;

/** FS-138: max rows per apply-mappings request (no background job for MVP). */
export const SAVED_CARD_MIGRATION_APPLY_MAX_ROWS = 200;

/**
 * FS-138 PLACEHOLDER consent wording, pending Renvani Legal & Compliance review.
 * The owner must acknowledge this before saved cards are attached for off-session charging.
 */
export const SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT =
  "I confirm that the customers in this import agreed to let my business keep their card on file and charge it for future services without them being present.";

export const applySavedCardMigrationMappingsBodySchema = z.object({
  /** Owner acknowledgment of SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT; required (must be true). */
  ownerOffSessionConsentAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "Owner must acknowledge customer consent to off-session charges" })
  }),
  rows: z
    .array(
      z.object({
        stripeCustomerId: z.string().min(1).max(255),
        stripePaymentMethodId: z.string().min(1).max(255),
        renvaniCustomerId: z.string().uuid().optional(),
        email: z.string().email().optional()
      })
    )
    .min(1)
    .max(SAVED_CARD_MIGRATION_APPLY_MAX_ROWS)
});

export type ApplySavedCardMigrationMappingsBody = z.infer<typeof applySavedCardMigrationMappingsBodySchema>;

export const sendSavedCardFallbackEmailBodySchema = z.object({
  renvaniCustomerId: z.string().uuid()
});

export type SendSavedCardFallbackEmailBody = z.infer<typeof sendSavedCardFallbackEmailBodySchema>;

export const savedCardMigrationBundleParamsSchema = z.object({
  bundleId: z.string().uuid()
});

export const savedCardMigrationIdParamsSchema = z.object({
  migrationId: z.string().uuid()
});

export const internalAdminListSavedCardMigrationsQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: savedCardMigrationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

export type InternalAdminListSavedCardMigrationsQuery = z.infer<
  typeof internalAdminListSavedCardMigrationsQuerySchema
>;

export const internalAdminSavedCardMigrationListResponseSchema = z.object({
  items: z.array(savedCardMigrationSchema),
  total: z.number().int().nonnegative()
});

export type InternalAdminSavedCardMigrationListResponse = z.infer<
  typeof internalAdminSavedCardMigrationListResponseSchema
>;
