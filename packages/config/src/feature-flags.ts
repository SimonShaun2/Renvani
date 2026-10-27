import { DEPLOYMENT_TIER_ENV } from "./deployment-environment.js";

/** Clerk parallel auth is on only when RENVANI_DEPLOYMENT_TIER=staging (env-driven). */
export function isClerkAuthParallelJwtEnabled(
  source: Record<string, string | undefined> = process.env
): boolean {
  return source[DEPLOYMENT_TIER_ENV]?.trim() === "staging";
}

/**
 * Compile-time feature flags for staged rollout (v1).
 * Toggle without migrations; gate call sites with explicit comments.
 */
export const featureFlags = {
  // FEATURE FLAG: retention-gates-enqueue — FS-28 Pair 4 (enqueue-only; no Twilio/SendGrid)
  retentionGatesEnqueue: false,
  // FEATURE FLAG: retention-win-back-enqueue — lapse rebook / win-back proposals (FS-28 batch 2)
  retentionWinBackEnqueue: false,
  // FEATURE FLAG: growth-check-public-scan — FS-55 worker-backed public growth scans (staff enqueue)
  growthCheckPublicScan: false,
  // FEATURE FLAG: loyalty-reminders-enabled — FS-72 candidate evaluation (proposal path separate)
  loyaltyRemindersEnabled: false,
  // FEATURE FLAG: loyalty-reminders-dry-run — FS-72 blocks customer send until founder gate
  loyaltyRemindersDryRun: true,
  // FEATURE FLAG: service-job-brief-worker — FS-25 worker-built job brief proposals (no inline API AI)
  serviceJobBriefWorkerEnabled: false,
  // FEATURE FLAG: clerk-auth-parallel-jwt — STACK-02: accept Clerk session JWT alongside in-repo JWT
  clerkAuthParallelJwt: isClerkAuthParallelJwtEnabled(),
  // FEATURE FLAG: tenant-session-scoped-writes — STACK-02/10: SET LOCAL app.current_company_id on API writes
  tenantSessionScopedWrites: false,
  // FEATURE FLAG: resend-email-enabled — STACK-08: route outbound email through Resend (@fsm/comms)
  resendEmailEnabled: false,
  // FEATURE FLAG: outbound-sms-enabled — when false, SMS sends are stubbed/disabled (STACK-08 MVP)
  outboundSmsEnabled: false,
  // FEATURE FLAG: stripe-platform-billing-mvp — STACK-13 platform subscription checkout
  stripePlatformBillingMvp: false,
  // FEATURE FLAG: stripe-renvani-embedded-checkout — invoice pay on Renvani (embedded Checkout vs Stripe redirect)
  stripeRenvaniEmbeddedCheckout: true,
  // FEATURE FLAG: stripe-renvani-connect-embedded — Connect Account Session in settings (vs Account Links)
  stripeRenvaniConnectEmbedded: true,
  // FEATURE FLAG: stripe-renvani-platform-sync — STACK-14: sync platform account branding via API (test/live key from env)
  stripeRenvaniPlatformSync: true,
  // FEATURE FLAG: stripe-renvani-portal-urls — replace hosted_invoice_url with Renvani portal links
  stripeRenvaniPortalUrls: true,
  // FEATURE FLAG: qbo-ongoing-sync-sandbox — FS-133 ongoing QBO sync (sandbox only until founder gate)
  qboOngoingSyncSandbox: true
} as const;

export type FeatureFlags = typeof featureFlags;
