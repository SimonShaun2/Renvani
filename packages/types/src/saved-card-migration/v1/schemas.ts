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

// DRAFT, pending lawyer review. Source: Renvani Legal & Compliance draft (saved-card-ack.md).
/** Version label stored with each owner acknowledgment (bump whenever the text changes). */
export const SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION = "v1-draft";

/**
 * FS-138 owner acknowledgment shown before applying migrated Stripe customer mappings.
 * DRAFT, pending lawyer review.
 */
export const SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT =
  "By applying these mappings, you confirm that you are authorized to act for your business and that your customers gave you permission to charge the cards they saved with your previous payment processor, for the kinds of payments and on the terms they agreed to with you. You authorize TrayLoop Technologies LLC, doing business as Renvani, to process those saved cards through Stripe for charges you create or approve in Renvani, including when the customer is not present. You are responsible for those charges and for honoring your customers' agreements, cancellations, and refund and dispute requests, and you will stop using any card if a customer withdraws permission. Do not apply mappings for any customer whose permission you cannot show.";

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
