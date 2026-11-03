import type { FastifyReply, FastifyRequest } from "fastify";
import Stripe from "stripe";

import { webhookEnv as env } from "@fsm/config/runtime-env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

declare module "fastify" {
  interface FastifyRequest {
    stripeEvent?: Stripe.Event;
    twilioParams?: Record<string, string>;
  }
}

export async function stripeVerify(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const signature = request.headers["stripe-signature"];

  if (typeof signature !== "string") {
    reply.code(400).send({
      error: "INVALID_STRIPE_SIGNATURE",
      message: "Missing Stripe signature"
    });
    return;
  }

  try {
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
    request.stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    request.log.warn(
      {
        err: error,
        stripeSignature: signature
      },
      "Stripe signature verification failed"
    );
    reply.code(400).send({
      error: "INVALID_STRIPE_SIGNATURE",
      message: "Invalid Stripe signature"
    });
  }
}
