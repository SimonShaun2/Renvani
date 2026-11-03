import { Resend } from "resend";

import type { OutboundEmailChannel, OutboundEmailPayload } from "./channels.js";

export type ResendEmailAdapterConfig = {
  apiKey: string;
  defaultFrom: string;
};

type ResendClient = Pick<Resend, "emails">;

/**
 * Resend transactional email adapter (official MVP email provider), using the Resend SDK.
 * `client` is injectable for tests.
 */
export function createResendEmailChannel(
  config: ResendEmailAdapterConfig,
  client: ResendClient = new Resend(config.apiKey)
): OutboundEmailChannel {
  return {
    async sendTransactionalEmail(payload: OutboundEmailPayload): Promise<{ providerMessageId: string }> {
      const { data, error } = await client.emails.send({
        from: config.defaultFrom,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        ...(payload.tags ? { tags: payload.tags.map((name) => ({ name: name.replace(/[^A-Za-z0-9_-]/g, "_"), value: "true" })) } : {})
      });

      if (error) {
        throw new Error(`Resend send failed (${error.name}): ${error.message}`);
      }

      return { providerMessageId: data?.id ?? "resend_unknown" };
    }
  };
}
