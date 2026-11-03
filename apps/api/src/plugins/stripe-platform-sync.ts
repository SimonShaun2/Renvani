import type { FastifyPluginAsync } from "fastify";

import { featureFlags } from "@fsm/config/feature-flags";

import { syncRenvaniStripePlatformPolicies } from "../lib/stripe-platform-settings.js";

const stripePlatformSyncPlugin: FastifyPluginAsync = async (fastify) => {
  if (!featureFlags.stripeRenvaniPlatformSync) {
    return;
  }

  fastify.addHook("onReady", async () => {
    try {
      const result = await syncRenvaniStripePlatformPolicies();
      fastify.log.info({ accountId: result.accountId }, "Synced Renvani Stripe platform branding (test/live key from env)");
    } catch (error: unknown) {
      fastify.log.warn({ err: error }, "Stripe platform branding sync skipped (check STRIPE_SECRET_KEY and branding env)");
    }
  });
};

export default stripePlatformSyncPlugin;
