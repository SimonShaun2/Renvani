import Fastify from "fastify";
import pino from "pino";

import { webhookEnv as env } from "@fsm/config/runtime-env";

import { stripeHandler } from "./handlers/stripe.handler.js";
import { twilioHandler } from "./handlers/twilio.handler.js";
import { stripeVerify } from "./middleware/stripe-verify.js";
import { twilioVerify } from "./middleware/twilio-verify.js";

async function bufferParser(_request: unknown, body: Buffer): Promise<Buffer> {
  return body;
}

export async function buildWebhookApp() {
  const logger = pino({
    level: env.NODE_ENV === "production" ? "info" : "debug"
  });

  const app = Fastify({
    loggerInstance: logger
  });

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, bufferParser);
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "buffer" }, bufferParser);
  app.addContentTypeParser("text/plain", { parseAs: "buffer" }, bufferParser);

  app.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok", service: "webhook" });
  });

  app.post("/stripe", { preHandler: stripeVerify }, stripeHandler);
  app.post("/twilio", { preHandler: twilioVerify }, twilioHandler);

  return app;
}
