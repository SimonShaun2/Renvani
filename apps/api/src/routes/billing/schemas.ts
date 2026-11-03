import type { FastifySchema } from "fastify";

export const platformBillingStatusSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        subscribed: { type: "boolean" },
        status: { type: ["string", "null"] },
        stripeCustomerId: { type: ["string", "null"] },
        stripeSubscriptionId: { type: ["string", "null"] },
        currentPeriodEnd: { type: ["string", "null"] },
        planTier: { type: ["string", "null"], enum: ["flex", "flat", null] },
        checkoutAvailable: { type: "boolean" }
      },
      required: ["enabled", "subscribed", "checkoutAvailable"]
    }
  }
};

export const platformBillingCheckoutSchema: FastifySchema = {
  body: {
    type: "object",
    properties: {
      plan: { type: "string", enum: ["flex", "flat"] }
    }
  },
  response: {
    200: {
      type: "object",
      properties: {
        url: { type: "string" }
      },
      required: ["url"]
    }
  }
};
