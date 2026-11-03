/** Provider-independent outbound comms (Circle S email-first MVP). */

export type OutboundChannelKind = "email" | "sms";

export type OutboundMessageTemplateRef = {
  /** Stable template id for channel-agnostic workflows (e.g. booking.confirmation). */
  templateId: string;
  /** Channel-specific payload; renderers map templateId + variables per adapter. */
  variables: Record<string, string>;
};

export type OutboundEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: string[];
};

export type OutboundSmsPayload = {
  to: string;
  body: string;
};

export interface OutboundEmailChannel {
  sendTransactionalEmail(payload: OutboundEmailPayload): Promise<{ providerMessageId: string }>;
}

export interface OutboundSmsChannel {
  sendSms(payload: OutboundSmsPayload): Promise<{ providerMessageId: string }>;
}
