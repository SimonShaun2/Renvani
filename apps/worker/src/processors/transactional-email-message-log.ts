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
    logger.warn(
      { err: error, companyId: input.companyId, sourceSystem: input.sourceSystem, sourceId: input.sourceId },
      "Failed to record transactional email message log; continuing"
    );
  }
}
