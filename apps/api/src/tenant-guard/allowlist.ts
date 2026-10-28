/**
 * Reviewed exceptions for the H1 tenant-guard scan (see ./scan.ts and ./tenant-guard-scan.test.ts).
 *
 * An entry matches every unscoped drizzle call in `file` whose normalized call text contains `pattern`.
 * Keep it small and explicit: add an entry ONLY with a concrete reason the query is safe without a
 * `companyId` filter, and prefer adding the filter instead. Categories:
 *   public-token   unauthenticated lookup by an unguessable token/slug; tenant then comes from the row
 *   stripe-signed  ids taken from Stripe-signed webhook metadata / PaymentIntent ids
 *   auth-global    login identity / refresh tokens / Clerk linking are global by design
 *   scoped-parent  the row was already loaded (or just written) with a companyId filter in the same flow;
 *                  defense-in-depth companyId is H1 PR 3
 *   worker-payload worker job ids come from an API enqueue that was tenant-scoped; companyId in payload is PR 3
 *   admin-global   platform-admin (cross-tenant by design)
 *   pending-pr     fixed by an open PR; remove the entry when it merges
 */
export interface TenantGuardAllowlistEntry {
  file: string;
  pattern: string;
  category:
    | "public-token"
    | "stripe-signed"
    | "auth-global"
    | "scoped-parent"
    | "worker-payload"
    | "admin-global"
    | "pending-pr";
  reason: string;
}

export const TENANT_GUARD_ALLOWLIST: TenantGuardAllowlistEntry[] = [
  // auth-global
  { file: "apps/api/src/services/auth.service.ts", pattern: "users.", category: "auth-global", reason: "Login/verify/password flows resolve the user globally (email, id, token hash)." },
  { file: "apps/api/src/services/auth.service.ts", pattern: "refreshTokens.", category: "auth-global", reason: "Refresh token rotation/revocation by token id or user id." },
  { file: "apps/api/src/services/clerk-admin-relink.service.ts", pattern: "refreshTokens.userId", category: "auth-global", reason: "Revokes the relinked user's refresh tokens." },
  { file: "apps/api/src/services/clerk-provisioning.service.ts", pattern: "eq(users.id, sameEmail.id)", category: "auth-global", reason: "Clerk identity link on a user already matched by verified email." },
  { file: "apps/api/src/services/clerk-user-sync.service.ts", pattern: "users.", category: "auth-global", reason: "Clerk webhook user sync keyed by Clerk user id." },
  { file: "apps/api/src/services/clerk-user-sync.service.ts", pattern: "refreshTokens.userId", category: "auth-global", reason: "Revokes a Clerk-unlinked user's refresh tokens." },

  // public-token
  { file: "apps/api/src/services/booking.service.ts", pattern: "bookingSettings.bookingSlug", category: "public-token", reason: "Public booking page resolves the tenant by its booking slug." },
  { file: "apps/api/src/services/booking.service.ts", pattern: "eq(scheduleSlots.id, slot.id)", category: "public-token", reason: "Slot row loaded under the slug-resolved tenant just before." },
  { file: "apps/api/src/services/booking-self-service.service.ts", pattern: "eq(scheduleSlots.id, slot.id)", category: "public-token", reason: "Self-service manage link (signed token); slot loaded for that booking's tenant." },
  { file: "apps/api/src/services/booking-self-service.service.ts", pattern: "eq(bookingRequests.id, bookingRequest.id)", category: "public-token", reason: "Booking resolved from the signed self-service token." },
  { file: "apps/api/src/services/estimate.service.ts", pattern: "estimates.approvalToken", category: "public-token", reason: "Public estimate approval by 24-byte random token." },
  { file: "apps/api/src/services/invoice.service.ts", pattern: "invoices.paymentToken", category: "public-token", reason: "Public pay page by payment token." },
  { file: "apps/api/src/services/hosted-checkout.service.ts", pattern: "invoices.paymentToken", category: "public-token", reason: "Public hosted-checkout fallback by payment token (#292)." },
  { file: "apps/api/src/services/review-request.service.ts", pattern: "reviewRequests.referenceId", category: "public-token", reason: "Public review landing by random uuid reference id." },

  // stripe-signed
  { file: "apps/api/src/services/invoice.service.ts", pattern: "eq(invoices.id, invoiceId), isNull(invoices.deletedAt)", category: "stripe-signed", reason: "getInvoiceById for Stripe webhook handling; invoiceId from signed PaymentIntent metadata." },
  { file: "apps/api/src/services/invoice.service.ts", pattern: "payments.stripePaymentIntentId", category: "stripe-signed", reason: "Webhook idempotency by Stripe PaymentIntent id." },

  // scoped-parent (defense-in-depth companyId in H1 PR 3)
  { file: "apps/api/src/services/invoice.service.ts", pattern: "eq(invoices.id, createdInvoice.id)", category: "scoped-parent", reason: "Re-read of the invoice just created for the caller's company." },
  { file: "apps/api/src/services/invoice.service.ts", pattern: "eq(invoices.id, updatedInvoice.id)", category: "scoped-parent", reason: "Re-read of the invoice just updated under companyId." },
  { file: "apps/api/src/services/invoice-items.service.ts", pattern: "invoiceId", category: "scoped-parent", reason: "recalculateTotals: callers load the invoice with companyId first." },
  { file: "apps/api/src/services/estimate.service.ts", pattern: "eq(estimates.id, createdEstimate.id)", category: "scoped-parent", reason: "Re-read after create for the caller's company." },
  { file: "apps/api/src/services/estimate.service.ts", pattern: "eq(estimates.id, updatedEstimate.id)", category: "scoped-parent", reason: "Re-read after scoped update." },
  { file: "apps/api/src/services/estimate.service.ts", pattern: "eq(estimates.id, existingEstimate.id)", category: "scoped-parent", reason: "existingEstimate loaded by approval token or companyId earlier in the flow." },
  { file: "apps/api/src/services/estimate.service.ts", pattern: "eq(estimates.id, selectedEstimate.id)", category: "scoped-parent", reason: "Tier sibling selected within the token/company-resolved tier group." },
  { file: "apps/api/src/services/estimate-items.service.ts", pattern: "estimateId", category: "scoped-parent", reason: "recalculateTotals: callers load the estimate with companyId first." },
  { file: "apps/api/src/services/migrate-onboarding.service.ts", pattern: "importBundles.id", category: "scoped-parent", reason: "Bundle loaded with companyId by the wizard before each write." },
  { file: "apps/api/src/services/migrate-onboarding.service.ts", pattern: "eq(importSessions.id, file.importSessionId)", category: "scoped-parent", reason: "Session belongs to the company-scoped bundle file." },
  { file: "apps/api/src/services/migrate-import-file-link.service.ts", pattern: "eq(importBundles.id, bundleId)", category: "scoped-parent", reason: "Bundle loaded with companyId first." },
  { file: "apps/api/src/services/migrate-photo-migration-state.ts", pattern: "eq(importBundles.id, bundleId)", category: "scoped-parent", reason: "Bundle loaded with companyId first." },
  { file: "apps/api/src/services/migrate-photo-link-commit.service.ts", pattern: "eq(importSessions.id, session.id)", category: "scoped-parent", reason: "Session loaded with companyId first." },
  { file: "apps/api/src/services/qbo-connection.service.ts", pattern: "eq(qboConnections.id, existing.id)", category: "scoped-parent", reason: "Connection loaded with companyId first." },
  { file: "apps/api/src/services/data-export.service.ts", pattern: "eq(dataExportSessions.id, session.id)", category: "scoped-parent", reason: "Export session loaded with companyId first." },
  { file: "apps/api/src/services/import-workflow-runtime.service.ts", pattern: "eq(importChunkRuns.id, existing.id)", category: "scoped-parent", reason: "Chunk run found by tenant-derived idempotency key." },
  { file: "apps/api/src/services/field-work-sync.service.ts", pattern: "batch.id", category: "scoped-parent", reason: "Sync batch loaded with companyId first." },
  { file: "apps/api/src/services/saved-card-migration.service.ts", pattern: ".where(whereClause)", category: "scoped-parent", reason: "Dynamic filter; tenant callers pass companyId, admin callers are platform-wide (review in PR 3)." },

  // admin-global
  { file: "apps/api/src/services/saved-card-migration.service.ts", pattern: "eq(savedCardMigrations.id, migrationId)", category: "admin-global", reason: "getSavedCardMigrationByIdForAdmin (platform admin)." },

  // worker-payload (companyId in job payload is H1 PR 3)
  { file: "apps/worker/src/processors/data-export.processor.ts", pattern: "eq(dataExportSessions.id, exportSessionId)", category: "worker-payload", reason: "Export session id from the scoped API enqueue." },
  { file: "apps/worker/src/processors/import-chunk-commit.processor.ts", pattern: "importChunkRuns.", category: "worker-payload", reason: "Chunk run by idempotency key/id from the scoped import enqueue." },
  { file: "apps/worker/src/processors/import-file-link.processor.ts", pattern: "eq(importBundles.id, payload.importBundleId)", category: "worker-payload", reason: "Bundle id from the scoped API enqueue." },
  { file: "apps/worker/src/processors/growth-check.processor.ts", pattern: ".update(growthCheckFindings)", category: "worker-payload", reason: "Finding row created by this scan run for the payload's company." },

  // pending-pr
  { file: "apps/api/src/services/vip-membership-tier-stripe.service.ts", pattern: "eq(vipMembershipTiers.id, tierId))", category: "pending-pr", reason: "Fixed by #294 (adds eq(companyId)); remove when it merges." },
  { file: "apps/webhook/src/handlers/twilio.handler.ts", pattern: "eq(customers.phone, fromNumber), isNull(customers.deletedAt)", category: "pending-pr", reason: "Today: cross-tenant guess (fixed by #295). After #295: intentional platform-wide STOP lookup (consent withdrawal only)." },
  { file: "apps/webhook/src/handlers/twilio.handler.ts", pattern: "eq(customers.id, companyContext.customerId)", category: "pending-pr", reason: "Fixed by #295 (update scoped by companyId); remove when it merges." },
  { file: "apps/webhook/src/handlers/twilio.handler.ts", pattern: "eq(messageLogs.toAddress, phone)", category: "public-token", reason: "#295 routing: most recent outbound SMS to the signed inbound From phone decides the tenant." }
];
