import pino from "pino";

import {
  createResendEmailChannel,
  type EmailTemplateId,
  type OutboundEmailChannel,
  type OutboundEmailPayload,
  renderTransactionalEmail
} from "@fsm/comms";
import { env } from "@fsm/config";

const logger = pino({
  name: "outbound-email"
});

export const DEFAULT_EMAIL_FROM = "Renvani <hello@mail.getrenvani.com>";

let cachedChannel: OutboundEmailChannel | null = null;
let missingKeyLogged = false;

export function getTransactionalEmailFromAddress(): string {
  const from = (env.EMAIL_FROM ?? "").trim();
  return from.length > 0 ? from : DEFAULT_EMAIL_FROM;
}

/** Provider-independent seam: returns the configured email channel, or null when no provider key is set. */
export function getEmailChannel(): OutboundEmailChannel | null {
  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) {
    if (!missingKeyLogged) {
      missingKeyLogged = true;
      logger.warn("RESEND_API_KEY is not set; transactional email is disabled (no-op)");
    }
    return null;
  }
  cachedChannel ??= createResendEmailChannel({ apiKey, defaultFrom: getTransactionalEmailFromAddress() });
  return cachedChannel;
}

/** Test hook: inject a channel (or reset to env-driven with null). */
export function setEmailChannelForTests(channel: OutboundEmailChannel | null): void {
  cachedChannel = channel;
  missingKeyLogged = false;
}

export async function deliverTransactionalEmail(
  payload: OutboundEmailPayload
): Promise<{ providerMessageId: string | null }> {
  const channel = cachedChannel ?? getEmailChannel();
  if (!channel) {
    return { providerMessageId: null };
  }
  const result = await channel.sendTransactionalEmail(payload);
  logger.debug({ providerMessageId: result.providerMessageId }, "Transactional email sent");
  return { providerMessageId: result.providerMessageId };
}

export async function sendRenderedTemplateEmail(
  to: string,
  templateId: EmailTemplateId,
  variables: Record<string, string>,
  tags?: string[]
): Promise<void> {
  const logoUrl = (env.EMAIL_LOGO_URL ?? "").trim();
  const rendered = renderTransactionalEmail(templateId, variables, logoUrl ? { logoUrl } : {});
  const payload: OutboundEmailPayload = {
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text
  };

  if (tags) {
    payload.tags = tags;
  }

  await deliverTransactionalEmail(payload);
}

/** Fire-and-forget: schedule after the current response cycle; errors are logged, never thrown. */
export function sendEmailInBackground(task: () => Promise<void>, context: string): void {
  setImmediate(() => {
    task().catch((error: unknown) => {
      logger.error({ err: error, context }, "Background email send failed");
    });
  });
}
