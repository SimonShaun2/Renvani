import { EMAIL_TEMPLATE_IDS, type EmailTemplateId } from "./email-templates.js";

/** MVP Resend transactional templates (booking + VIP membership lifecycle). */
export const MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS = {
  bookingConfirmation: EMAIL_TEMPLATE_IDS.bookingConfirmation,
  bookingDecline: EMAIL_TEMPLATE_IDS.bookingDecline,
  vipWelcome: EMAIL_TEMPLATE_IDS.vipMembershipWelcome,
  vipRenewal: EMAIL_TEMPLATE_IDS.vipMembershipRenewal,
  vipPaymentFailedDunning: EMAIL_TEMPLATE_IDS.vipMembershipPaymentFailed
} as const;

export type MvpResendTransactionalTemplateId =
  (typeof MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS)[keyof typeof MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS];

const MVP_RESEND_TEMPLATE_ID_SET = new Set<EmailTemplateId>(
  Object.values(MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS)
);

export function isMvpResendTransactionalTemplate(templateId: EmailTemplateId): boolean {
  return MVP_RESEND_TEMPLATE_ID_SET.has(templateId);
}

export function resendTagsForTransactionalTemplate(templateId: EmailTemplateId): string[] {
  return [templateId];
}
