/**
 * FS-155 follow-up: the ONE place that decides which transactional email provider is active and which
 * From address goes with it. The API (sending) and the worker (message_logs.from_address) both call this,
 * so they can never disagree. Selection is by configured API key, not by feature flag.
 */
export type TransactionalEmailProvider = "resend" | "sendgrid" | "none";

export const DEFAULT_TRANSACTIONAL_EMAIL_FROM = "Renvani <hello@mail.getrenvani.com>";

export interface TransactionalEmailProviderConfig {
  resendApiKey?: string | null;
  sendgridApiKey?: string | null;
  nodeEnv?: string | null;
}

export interface TransactionalEmailFromConfig extends TransactionalEmailProviderConfig {
  resendFromEmail?: string | null;
  emailFrom?: string | null;
  sendgridFromEmail?: string | null;
}

/** Resend (RESEND_API_KEY) wins; SendGrid is the fallback (never under NODE_ENV=test); otherwise "none". */
export function selectTransactionalEmailProvider(config: TransactionalEmailProviderConfig): TransactionalEmailProvider {
  if ((config.resendApiKey ?? "").trim()) return "resend";
  if (config.nodeEnv !== "test" && (config.sendgridApiKey ?? "").trim()) return "sendgrid";
  return "none";
}

/** SendGrid → SENDGRID_FROM_EMAIL; otherwise RESEND_FROM_EMAIL, then EMAIL_FROM, then the Renvani default. */
export function resolveTransactionalEmailFromAddress(config: TransactionalEmailFromConfig): string {
  if (selectTransactionalEmailProvider(config) === "sendgrid") {
    return config.sendgridFromEmail ?? "";
  }
  const from = (config.resendFromEmail ?? "").trim() || (config.emailFrom ?? "").trim();
  return from.length > 0 ? from : DEFAULT_TRANSACTIONAL_EMAIL_FROM;
}
