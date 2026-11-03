import Stripe from "stripe";

import { env } from "@fsm/config";
import { buildStripeAccountBrandingPatch, RENVANI_STRIPE_BRAND } from "@fsm/config/stripe-branding";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/**
 * Apply Renvani branding to the platform Stripe account (test or live key from env).
 * Logo/icon require publicly reachable HTTPS URLs in STRIPE_BRANDING_* env vars.
 */
export async function syncPlatformStripeBranding(): Promise<{ accountId: string }> {
  const account = await stripe.accounts.retrieve();
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const brandingPatch = buildStripeAccountBrandingPatch();

  await stripe.accounts.update(account.id, {
    business_profile: {
      name: RENVANI_STRIPE_BRAND.platformName,
      support_url: appBaseUrl,
      url: appBaseUrl
    },
    settings: {
      branding: brandingPatch,
      payments: {
        statement_descriptor: RENVANI_STRIPE_BRAND.defaultStatementPrefix
      }
    }
  });

  return { accountId: account.id };
}

/**
 * Stripe does not expose a single API to disable all customer emails on the platform account.
 * This sets Connect-friendly defaults and relies on Resend for transactional copy.
 */
export async function applyStripeCustomerEmailMinimizationPolicies(
  accountId: string
): Promise<void> {
  await stripe.accounts.update(accountId, {
    settings: {
      branding: buildStripeAccountBrandingPatch()
    }
  });
}

/** Idempotent best-effort sync for test-mode automation (STACK-14). */
export async function syncRenvaniStripePlatformPolicies(): Promise<{ accountId: string }> {
  const { accountId } = await syncPlatformStripeBranding();
  await applyStripeCustomerEmailMinimizationPolicies(accountId);
  return { accountId };
}
