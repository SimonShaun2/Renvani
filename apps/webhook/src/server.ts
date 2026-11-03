import { webhookEnv as env, resolveWebhookListenPort } from "@fsm/config/runtime-env";

import { buildWebhookApp } from "./app.js";

const app = await buildWebhookApp();

const listenPort = resolveWebhookListenPort(env);

try {
  await app.listen({
    host: "0.0.0.0",
    port: listenPort
  });
} catch (error) {
  app.log.error({ err: error }, "Webhook server failed to start");
  process.exit(1);
}
