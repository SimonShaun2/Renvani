import type { EmailTemplateId } from "@fsm/comms";
import { db, messageLogs } from "@fsm/db";
import pino from "pino";

const logger = pino({ name: "transactional-email-message-log" });

export type TransactionalEmailDeliveryRecord = {
  templateId: EmailTemplateId;
  subject: string;
  providerMessageId: string | null;
};

export async function recordTransactionalEmailMessageLog(input: {
  companyId: string;
  customerId: string | null;
  toAddress: string;
  fromAddress: string;
  delivery: TransactionalEmailDeliveryRecord;
  sourceSystem: "booking_notification" | "vip_membership_email";
  sourceId: string;
}): Promise<void> {
  const now = new Date();

  // Logging happens after the email is sent: it must never fail the job (a retry would resend the email).
  // Subject and providerMessageId are recorded; delivered time is left for delivery webhooks.
  try {
    await db
      .insert(messageLogs)
      .values({
    companyId: input.companyId,
    customerId: input.customerId,
    channel: "email",
    direction: "outbound",
    toAddress: input.toAddress,
    fromAddress: input.fromAddress,
    subject: input.delivery.subject,
    body: input.delivery.subject,
    providerMessageId: input.delivery.providerMessageId,
    providerStatus: "sent",
    sentAt: now,
    sourceSystem: input.sourceSystem,
    sourceId: input.sourceId
      })
      .onConflictDoNothing();
  } catch (error) {
    // Never log the error object/message: drizzle errors include the failed SQL and its params (PII).
    logger.warn(
      { errorName: safeErrorName(error), errorCode: safeErrorCode(error), companyId: input.companyId, sourceSystem: input.sourceSystem, sourceId: input.sourceId },
      "Failed to record transactional email message log; continuing"
    );
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function safeErrorCode(error: unknown): string | undefined {
  const pick = (value: unknown): string | undefined => {
    if (value && typeof value === "object" && "code" in value) {
      const code = (value as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
    return undefined;
  };
  return pick(error) ?? pick(error && typeof error === "object" ? (error as { cause?: unknown }).cause : undefined);
}
