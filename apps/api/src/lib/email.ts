import pino from "pino";

import { EMAIL_TEMPLATE_IDS } from "@fsm/comms";

import { sendRenderedTemplateEmail, type TransactionalEmailSendResult } from "./outbound-email.js";

export type { TransactionalEmailSendResult } from "./outbound-email.js";

const logger = pino({
  name: "email"
});

export interface EstimateEmailLineItem {
  name: string;
  description: string | null;
  quantity: string;
  total: string;
}

interface EstimateEmailParams {
  firstName: string;
  estimateNumber: string;
  title: string | null;
  total: string;
  expiresAt: string | null;
  approvalUrl: string;
  companyName: string;
}

interface InvoiceEmailParams {
  firstName: string;
  invoiceNumber: string;
  total: string;
  dueAt: string | null;
  paymentLinkUrl: string;
  companyName: string;
}

interface InvoicePaymentReceiptEmailParams {
  firstName: string;
  invoiceNumber: string;
  amount: string;
  balanceDue: string;
  paidAt: string | null;
  receiptUrl: string | null;
  companyName: string;
}

interface InvoiceReminderEmailParams extends InvoiceEmailParams {
  balanceDue: string;
  reminderLevel: 1 | 2 | 3;
}

interface InvoiceReminderOwnerAlertParams {
  ownerFirstName: string;
  customerName: string;
  invoiceNumber: string;
  balanceDue: string;
  paymentLinkUrl: string;
  companyName: string;
}

interface ServiceAgreementRenewalReminderEmailParams {
  firstName: string;
  planName: string;
  nextServiceDate: string | null;
  companyName: string;
}

interface CampaignEmailParams {
  firstName: string;
  subject: string;
  body: string;
  companyName: string;
}

export interface BookingConfirmationEmailParams {
  firstName: string;
  companyName: string;
  referenceNumber: string;
  scheduledLabel: string | null;
}

export interface BookingDeclineEmailParams {
  firstName: string;
  companyName: string;
  referenceNumber: string;
  reason: string | null;
}

interface VipMembershipWelcomeEmailParams {
  firstName: string;
  companyName: string;
  planName: string;
  portalUrl: string | null;
}

interface VipMembershipRenewalEmailParams {
  firstName: string;
  companyName: string;
  planName: string;
  amount: string;
  renewalDateLabel: string | null;
}

interface VipMembershipPaymentFailedEmailParams {
  firstName: string;
  companyName: string;
  planName: string;
  amount: string;
  paymentUrl: string | null;
  graceEndsAtLabel: string | null;
  nextRetryAtLabel: string | null;
  dunningStepIndex: number;
}

function formatEmailDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US");
}

export async function sendVerifyEmailEmail(to: string, verifyUrl: string, firstName: string): Promise<void> {
  await sendRenderedTemplateEmail(to, EMAIL_TEMPLATE_IDS.verifyEmail, { firstName, verifyUrl }, ["auth.verify_email"]);
  logger.debug({ recipient: "[redacted]" }, "Verify email sent");
}

export async function sendSignupAttemptEmail(
  to: string,
  params: { firstName: string; loginUrl: string; resetUrl: string }
): Promise<void> {
  await sendRenderedTemplateEmail(to, EMAIL_TEMPLATE_IDS.signupAttempt, params, ["auth.signup_attempt"]);
  logger.debug({ recipient: "[redacted]" }, "Signup attempt notice sent");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, firstName: string): Promise<void> {
  await sendRenderedTemplateEmail(to, EMAIL_TEMPLATE_IDS.passwordReset, {
    firstName,
    resetUrl
  });
  logger.debug({ recipient: "[redacted]" }, "Password reset email sent");
}

export async function sendEstimateEmail(to: string, params: EstimateEmailParams): Promise<void> {
  const formattedExpiryDate = formatEmailDate(params.expiresAt);

  await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.estimateSent,
    {
      firstName: params.firstName,
      estimateNumber: params.estimateNumber,
      title: params.title ?? "",
      total: params.total,
      expiresAtLabel: formattedExpiryDate ?? "",
      approvalUrl: params.approvalUrl,
      companyName: params.companyName
    },
    ["estimate.sent"]
  );

  logger.debug({ recipient: "[redacted]" }, "Estimate email sent");
}

export async function sendInvoiceEmail(to: string, params: InvoiceEmailParams): Promise<void> {
  const formattedDueDate = formatEmailDate(params.dueAt);

  await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.invoiceSent,
    {
      firstName: params.firstName,
      invoiceNumber: params.invoiceNumber,
      total: params.total,
      dueAtLabel: formattedDueDate ?? "",
      paymentLinkUrl: params.paymentLinkUrl,
      companyName: params.companyName
    },
    ["invoice.sent"]
  );

  logger.debug({ recipient: "[redacted]" }, "Invoice email sent");
}

export async function sendInvoicePaymentReceiptEmail(
  to: string,
  params: InvoicePaymentReceiptEmailParams
): Promise<void> {
  await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.invoicePaymentReceipt,
    {
      firstName: params.firstName,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      balanceDue: params.balanceDue,
      paidAtLabel: formatEmailDate(params.paidAt) ?? "",
      receiptUrl: params.receiptUrl ?? "",
      companyName: params.companyName
    },
    ["invoice.payment_receipt"]
  );

  logger.debug({ recipient: "[redacted]" }, "Invoice payment receipt email sent");
}

export async function sendInvoiceReminderEmail(
  to: string,
  params: InvoiceReminderEmailParams
): Promise<void> {
  const formattedDueDate = formatEmailDate(params.dueAt);

  await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.invoiceReminder,
    {
      firstName: params.firstName,
      invoiceNumber: params.invoiceNumber,
      total: params.total,
      balanceDue: params.balanceDue,
      dueAtLabel: formattedDueDate ?? "",
      paymentLinkUrl: params.paymentLinkUrl,
      companyName: params.companyName,
      reminderLevel: String(params.reminderLevel)
    },
    ["invoice.reminder"]
  );

  logger.debug({ recipient: "[redacted]" }, "Invoice reminder email sent");
}

export async function sendInvoiceReminderOwnerAlertEmail(
  to: string,
  params: InvoiceReminderOwnerAlertParams
): Promise<void> {
  await sendRenderedTemplateEmail(to, EMAIL_TEMPLATE_IDS.invoiceReminderOwnerAlert, {
    ownerFirstName: params.ownerFirstName,
    customerName: params.customerName,
    invoiceNumber: params.invoiceNumber,
    balanceDue: params.balanceDue,
    paymentLinkUrl: params.paymentLinkUrl,
    companyName: params.companyName
  });

  logger.debug({ recipient: "[redacted]" }, "Invoice reminder owner alert email sent");
}

export async function sendServiceAgreementRenewalReminderEmail(
  to: string,
  params: ServiceAgreementRenewalReminderEmailParams
): Promise<void> {
  const formattedServiceDate = formatEmailDate(params.nextServiceDate);

  await sendRenderedTemplateEmail(to, EMAIL_TEMPLATE_IDS.serviceAgreementRenewal, {
    firstName: params.firstName,
    planName: params.planName,
    nextServiceDateLabel: formattedServiceDate ?? "",
    companyName: params.companyName
  });

  logger.debug({ recipient: "[redacted]" }, "Service agreement renewal reminder email sent");
}

export async function sendServiceAgreementPaymentFailedEmail(to: string, params: {
  ownerFirstName: string;
  customerName: string;
  planName: string;
  amount: string;
  manageUrl: string;
  companyName: string;
}): Promise<void> {
  await sendRenderedTemplateEmail(to, EMAIL_TEMPLATE_IDS.serviceAgreementPaymentFailed, {
    ownerFirstName: params.ownerFirstName,
    customerName: params.customerName,
    planName: params.planName,
    amount: params.amount,
    manageUrl: params.manageUrl,
    companyName: params.companyName
  });

  logger.debug({ recipient: "[redacted]" }, "Service agreement payment failed email sent");
}

export async function sendCampaignEmail(to: string, params: CampaignEmailParams): Promise<void> {
  await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.campaignMessage,
    {
      firstName: params.firstName,
      subject: params.subject,
      body: params.body,
      companyName: params.companyName
    },
    ["campaign.message"]
  );

  logger.debug({ recipient: "[redacted]" }, "Campaign email sent");
}

export async function sendBookingConfirmationEmail(
  to: string,
  params: BookingConfirmationEmailParams
): Promise<TransactionalEmailSendResult> {
  const result = await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.bookingConfirmation,
    {
      firstName: params.firstName,
      companyName: params.companyName,
      referenceNumber: params.referenceNumber,
      scheduledLabel: params.scheduledLabel ?? ""
    },
    ["booking.confirmation"]
  );

  logger.debug({ recipient: "[redacted]" }, "Booking confirmation email sent");
  return result;
}

export async function sendBookingDeclineEmail(
  to: string,
  params: BookingDeclineEmailParams
): Promise<TransactionalEmailSendResult> {
  const result = await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.bookingDecline,
    {
      firstName: params.firstName,
      companyName: params.companyName,
      referenceNumber: params.referenceNumber,
      reason: params.reason ?? ""
    },
    ["booking.decline"]
  );

  logger.debug({ recipient: "[redacted]" }, "Booking decline email sent");
  return result;
}

export async function sendVipMembershipWelcomeEmail(
  to: string,
  params: VipMembershipWelcomeEmailParams
): Promise<TransactionalEmailSendResult> {
  const result = await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.vipMembershipWelcome,
    {
      firstName: params.firstName,
      companyName: params.companyName,
      planName: params.planName,
      portalUrl: params.portalUrl ?? ""
    },
    ["vip_membership.welcome"]
  );

  logger.debug({ recipient: "[redacted]" }, "VIP membership welcome email sent");
  return result;
}

export async function sendVipMembershipRenewalEmail(
  to: string,
  params: VipMembershipRenewalEmailParams
): Promise<TransactionalEmailSendResult> {
  const result = await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.vipMembershipRenewal,
    {
      firstName: params.firstName,
      companyName: params.companyName,
      planName: params.planName,
      amount: params.amount,
      renewalDateLabel: params.renewalDateLabel ?? ""
    },
    ["vip_membership.renewal_receipt"]
  );

  logger.debug({ recipient: "[redacted]" }, "VIP membership renewal email sent");
  return result;
}

export async function sendVipMembershipPaymentFailedEmail(
  to: string,
  params: VipMembershipPaymentFailedEmailParams
): Promise<TransactionalEmailSendResult> {
  const result = await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.vipMembershipPaymentFailed,
    {
      firstName: params.firstName,
      companyName: params.companyName,
      planName: params.planName,
      amount: params.amount,
      paymentUrl: params.paymentUrl ?? "",
      graceEndsAtLabel: params.graceEndsAtLabel ?? "",
      nextRetryAtLabel: params.nextRetryAtLabel ?? "",
      dunningStepIndex: String(params.dunningStepIndex)
    },
    ["vip_membership.payment_failed_dunning"]
  );

  logger.debug({ recipient: "[redacted]" }, "VIP membership dunning email sent");
  return result;
}

export async function sendReviewRequestEmail(
  to: string,
  params: { firstName: string; companyName: string; technicianName: string | null; reviewUrl: string }
): Promise<TransactionalEmailSendResult> {
  const result = await sendRenderedTemplateEmail(
    to,
    EMAIL_TEMPLATE_IDS.reviewRequest,
    {
      firstName: params.firstName,
      companyName: params.companyName,
      technicianName: params.technicianName ?? "",
      reviewUrl: params.reviewUrl
    },
    ["review_request.sent"]
  );

  logger.debug({ recipient: "[redacted]" }, "Review request email sent");
  return result;
}
