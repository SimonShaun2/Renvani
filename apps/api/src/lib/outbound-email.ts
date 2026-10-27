import sgMail from "@sendgrid/mail";
import pino from "pino";

import {
  createResendEmailChannel,
  DEFAULT_TRANSACTIONAL_EMAIL_FROM,
  type EmailTemplateId,
  type OutboundEmailChannel,
  type OutboundEmailPayload,
  renderTransactionalEmail,
  resolveTransactionalEmailFromAddress,
  selectTransactionalEmailProvider,
  type TransactionalEmailProvider
} from "@fsm/comms";
import { env } from "@fsm/config";

const logger = pino({
  name: "outbound-email"
});

export const DEFAULT_EMAIL_FROM = DEFAULT_TRANSACTIONAL_EMAIL_FROM;

let cachedChannel: OutboundEmailChannel | null = null;
let fallbackLogged = false;
let missingProviderLogged = false;

export type EmailProvider = TransactionalEmailProvider;

export class EmailProviderNotConfiguredError extends Error {
  constructor() {
    super("EMAIL_PROVIDER_NOT_CONFIGURED");
    this.name = "EmailProviderNotConfiguredError";
  }
}

/** Resend (RESEND_API_KEY) wins; SendGrid is the fallback; tests never hit a live provider. Shared with the worker. */
export function resolveEmailProvider(): EmailProvider {
  return selectTransactionalEmailProvider({
    resendApiKey: env.RESEND_API_KEY,
    sendgridApiKey: env.SENDGRID_API_KEY,
    nodeEnv: env.NODE_ENV
  });
}

export function getTransactionalEmailFromAddress(): string {
  return resolveTransactionalEmailFromAddress({
    resendApiKey: env.RESEND_API_KEY,
    sendgridApiKey: env.SENDGRID_API_KEY,
    nodeEnv: env.NODE_ENV,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    emailFrom: env.EMAIL_FROM,
    sendgridFromEmail: env.SENDGRID_FROM_EMAIL
  });
}

function createSendGridEmailChannel(): OutboundEmailChannel {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
  return {
    async sendTransactionalEmail(payload: OutboundEmailPayload) {
      const [response] = await sgMail.send({
        to: payload.to,
        from: env.SENDGRID_FROM_EMAIL,
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {})
      });
      const messageId = response?.headers?.["x-message-id"];
      return { providerMessageId: typeof messageId === "string" ? messageId : "" };
    }
  };
}

/** Provider-independent seam: the configured channel, or null when no provider is configured. */
export function getEmailChannel(): OutboundEmailChannel | null {
  if (cachedChannel) {
    return cachedChannel;
  }
  const provider = resolveEmailProvider();
  if (provider === "resend") {
    cachedChannel = createResendEmailChannel({
      apiKey: env.RESEND_API_KEY.trim(),
      defaultFrom: getTransactionalEmailFromAddress()
    });
  } else if (provider === "sendgrid") {
    if (!fallbackLogged) {
      fallbackLogged = true;
      logger.warn("RESEND_API_KEY is not set; falling back to SendGrid for transactional email");
    }
    cachedChannel = createSendGridEmailChannel();
  }
  return cachedChannel;
}

/** Test hook: inject a channel (or reset to env-driven with null). */
export function setEmailChannelForTests(channel: OutboundEmailChannel | null): void {
  cachedChannel = channel;
  fallbackLogged = false;
  missingProviderLogged = false;
}

export async function deliverTransactionalEmail(
  payload: OutboundEmailPayload
): Promise<{ providerMessageId: string | null }> {
  const channel = getEmailChannel();
  if (!channel) {
    if (env.NODE_ENV === "production") {
      // Fail loudly: never silently drop password resets etc. in production.
      logger.error("No email provider configured (RESEND_API_KEY and SENDGRID_API_KEY empty); email not sent");
      throw new EmailProviderNotConfiguredError();
    }
    if (!missingProviderLogged) {
      missingProviderLogged = true;
      logger.warn("No email provider configured; transactional email disabled outside production (no-op)");
    }
    return { providerMessageId: null };
  }
  const result = await channel.sendTransactionalEmail(payload);
  logger.debug({ providerMessageId: result.providerMessageId }, "Transactional email sent");
  return { providerMessageId: result.providerMessageId };
}

export type TransactionalEmailSendResult = {
  templateId: EmailTemplateId;
  subject: string;
  providerMessageId: string | null;
};

export async function sendRenderedTemplateEmail(
  to: string,
  templateId: EmailTemplateId,
  variables: Record<string, string>,
  tags?: string[]
): Promise<TransactionalEmailSendResult> {
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

  const { providerMessageId } = await deliverTransactionalEmail(payload);

  return {
    templateId: rendered.templateId,
    subject: rendered.subject,
    providerMessageId
  };
}

/** Fire-and-forget: schedule after the current response cycle; errors are logged, never thrown. */
export function sendEmailInBackground(task: () => Promise<void>, context: string): void {
  setImmediate(() => {
    task().catch((error: unknown) => {
      logger.error({ err: error, context }, "Background email send failed");
    });
  });
}
