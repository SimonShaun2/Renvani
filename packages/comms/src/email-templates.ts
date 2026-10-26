/** Channel-agnostic transactional email templates (render to subject + html + text, in the Renvani layout). */

import { escapeHtml, htmlToText, renderRenvaniLayout } from "./email-layout.js";

export const EMAIL_TEMPLATE_IDS = {
  passwordReset: "auth.password_reset",
  verifyEmail: "auth.verify_email",
  signupAttempt: "auth.signup_attempt",
  estimateSent: "estimate.sent",
  invoiceSent: "invoice.sent",
  invoiceReminder: "invoice.reminder",
  invoiceReminderOwnerAlert: "invoice.reminder_owner_alert",
  serviceAgreementRenewal: "service_agreement.renewal_reminder",
  serviceAgreementPaymentFailed: "service_agreement.payment_failed",
  campaignMessage: "campaign.message",
  bookingConfirmation: "booking.confirmation",
  bookingDecline: "booking.decline",
  vipMembershipWelcome: "vip_membership.welcome",
  vipMembershipRenewal: "vip_membership.renewal_receipt",
  vipMembershipPaymentFailed: "vip_membership.payment_failed_dunning"
} as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[keyof typeof EMAIL_TEMPLATE_IDS];

export type RenderedTransactionalEmail = {
  templateId: EmailTemplateId;
  subject: string;
  html: string;
  text: string;
};

type RenderedBody = Omit<RenderedTransactionalEmail, "text">;

function emailShell(bodyHtml: string): string {
  return bodyHtml.trim();
}

/** Only absolute http(s) URLs are allowed in links; anything else (javascript:, data:, etc.) becomes "#". */
export function safeHref(href: string | undefined): string {
  const raw = (href ?? "").trim();
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return escapeHtml(url.toString());
    }
  } catch {
    // fall through
  }
  return "#";
}

function button(href: string, label: string): string {
  return `
    <p>
      <a href="${safeHref(href)}" style="display: inline-block; padding: 12px 18px; background: #257afa; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        ${escapeHtml(label)}
      </a>
    </p>
  `.trim();
}

function greetingName(firstName: string): string {
  return firstName.trim().length > 0 ? escapeHtml(firstName.trim()) : "there";
}

export function renderTransactionalEmail(
  templateId: EmailTemplateId,
  variables: Record<string, string>,
  options: { logoUrl?: string } = {}
): RenderedTransactionalEmail {
  const body = renderTemplateBody(templateId, variables);
  const layout = renderRenvaniLayout({
    bodyHtml: body.html,
    bodyText: htmlToText(body.html),
    preheader: body.subject,
    ...(options.logoUrl ? { logoUrl: options.logoUrl } : {})
  });
  return { templateId: body.templateId, subject: body.subject, html: layout.html, text: layout.text };
}

/** HTML-escaped copy of template variables (FS-155). */
function escapeTemplateVariables(variables: Record<string, string>): Record<string, string | undefined> {
  const escaped: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(variables)) {
    escaped[key] = typeof value === "string" ? escapeHtml(value) : value;
  }
  return escaped;
}

function renderTemplateBody(templateId: EmailTemplateId, variables: Record<string, string>): RenderedBody {
  // FS-155: every value interpolated into HTML is escaped; URLs go through safeHref via button()/safeHref().
  // Subjects stay raw (plain-text header; the layout escapes the preheader copy).
  const e = escapeTemplateVariables(variables);
  switch (templateId) {
    case EMAIL_TEMPLATE_IDS.verifyEmail: {
      const name = greetingName(variables.firstName ?? "");
      return {
        templateId,
        subject: "Verify your email for Renvani",
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Welcome to Renvani. Confirm your email address to finish setting up your account.</p>
          ${button(variables.verifyUrl ?? "#", "Verify your email")}
          <p>This link works once and expires in 24 hours. If you didn't sign up, you can ignore this email.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.signupAttempt: {
      const name = greetingName(variables.firstName ?? "");
      return {
        templateId,
        subject: "Someone tried to sign up with your email",
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Someone just tried to create a new Renvani account using this email address. You already have an account, so nothing was changed.</p>
          ${button(variables.loginUrl ?? "#", "Log in")}
          <p>If this was you, just log in. If you've forgotten your password, you can <a href="${safeHref(variables.resetUrl)}">reset it here</a>. If it wasn't you, no action is needed.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.passwordReset: {
      const name = greetingName(variables.firstName ?? "");
      return {
        templateId,
        subject: "Reset your Renvani password",
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>We received a request to reset your password.</p>
          ${button(variables.resetUrl ?? "#", "Reset password")}
          <p>If you did not request this, you can safely ignore this email.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.estimateSent: {
      const name = greetingName(variables.firstName ?? "");
      const titleBlock = e.title ? `<p><strong>Title:</strong> ${e.title}</p>` : "";
      const expiresBlock = e.expiresAtLabel
        ? `<p><strong>Expires:</strong> ${e.expiresAtLabel}</p>`
        : "";
      return {
        templateId,
        subject: `Estimate ${variables.estimateNumber ?? ""} from ${variables.companyName ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${e.companyName ?? ""} sent you estimate <strong>${e.estimateNumber ?? ""}</strong>.</p>
          ${titleBlock}
          <p><strong>Total:</strong> $${e.total ?? "0.00"}</p>
          ${expiresBlock}
          ${button(variables.approvalUrl ?? "#", "Review / Approve")}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.invoiceSent: {
      const name = greetingName(variables.firstName ?? "");
      const dueBlock = e.dueAtLabel ? `<p><strong>Due:</strong> ${e.dueAtLabel}</p>` : "";
      return {
        templateId,
        subject: `Invoice ${variables.invoiceNumber ?? ""} from ${variables.companyName ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${e.companyName ?? ""} sent you invoice <strong>${e.invoiceNumber ?? ""}</strong>.</p>
          <p><strong>Total:</strong> $${e.total ?? "0.00"}</p>
          ${dueBlock}
          ${button(variables.paymentLinkUrl ?? "#", "Pay invoice")}
          <p>If you've already paid, you can ignore this message.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.invoiceReminder: {
      const name = greetingName(variables.firstName ?? "");
      const level = variables.reminderLevel ?? "1";
      const reminderCopyByLevel: Record<string, string> = {
        "1": "Just a friendly reminder that your invoice is still open.",
        "2": "Your invoice is still unpaid and needs attention soon.",
        "3": "This is the final reminder before the balance is escalated internally."
      };
      const dueBlock = e.dueAtLabel ? `<p><strong>Due:</strong> ${e.dueAtLabel}</p>` : "";
      return {
        templateId,
        subject: `Reminder ${variables.invoiceNumber ?? ""} from ${variables.companyName ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${reminderCopyByLevel[level] ?? reminderCopyByLevel["1"]}</p>
          <p><strong>Invoice:</strong> ${e.invoiceNumber ?? ""}</p>
          <p><strong>Total:</strong> $${e.total ?? "0.00"}</p>
          <p><strong>Balance due:</strong> $${e.balanceDue ?? "0.00"}</p>
          ${dueBlock}
          ${button(variables.paymentLinkUrl ?? "#", "Pay invoice")}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.invoiceReminderOwnerAlert: {
      const name = greetingName(variables.ownerFirstName ?? "");
      return {
        templateId,
        subject: `Final invoice reminder sent for ${variables.invoiceNumber ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>A final invoice reminder was sent to <strong>${e.customerName ?? ""}</strong>.</p>
          <p><strong>Invoice:</strong> ${e.invoiceNumber ?? ""}</p>
          <p><strong>Balance due:</strong> $${e.balanceDue ?? "0.00"}</p>
          <p>${e.companyName ?? ""} may need manual follow-up if payment is still not received.</p>
          ${button(variables.paymentLinkUrl ?? "#", "View payment link")}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.serviceAgreementRenewal: {
      const name = greetingName(variables.firstName ?? "");
      const dateBlock = e.nextServiceDateLabel
        ? `<p><strong>Next service date:</strong> ${e.nextServiceDateLabel}</p>`
        : "";
      return {
        templateId,
        subject: `${variables.planName ?? "Your plan"} service is coming up`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Your <strong>${e.planName ?? ""}</strong> service agreement is coming up soon.</p>
          ${dateBlock}
          <p>${e.companyName ?? ""} will reach out if any scheduling updates are needed.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.serviceAgreementPaymentFailed: {
      const name = greetingName(variables.ownerFirstName ?? "");
      return {
        templateId,
        subject: "Service agreement payment failed",
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>A service agreement renewal payment failed for <strong>${e.customerName ?? ""}</strong>.</p>
          <p><strong>Plan:</strong> ${e.planName ?? ""}</p>
          <p><strong>Amount:</strong> $${e.amount ?? "0.00"}</p>
          <p>${e.companyName ?? ""} should review the subscription and payment method details.</p>
          ${button(variables.manageUrl ?? "#", "Manage service agreements")}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.campaignMessage: {
      const name = greetingName(variables.firstName ?? "");
      return {
        templateId,
        subject: variables.subject ?? "",
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${(e.body ?? "").replace(/\r?\n/g, "<br />")}</p>
          <p>Reply to this email if you'd like to connect with ${e.companyName ?? ""}.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.bookingConfirmation: {
      const name = greetingName(variables.firstName ?? "");
      const scheduledBlock = e.scheduledLabel
        ? `<p><strong>When:</strong> ${e.scheduledLabel}</p>`
        : "";
      return {
        templateId,
        subject: `Booking confirmed — ${variables.referenceNumber ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${e.companyName ?? ""} confirmed your booking <strong>${e.referenceNumber ?? ""}</strong>.</p>
          ${scheduledBlock}
          <p>If you need to make changes, contact ${e.companyName ?? "us"}.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.bookingDecline: {
      const name = greetingName(variables.firstName ?? "");
      const reasonBlock = e.reason
        ? `<p>${e.reason}</p>`
        : "<p>Please contact our office to reschedule.</p>";
      return {
        templateId,
        subject: `Booking update — ${variables.referenceNumber ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${e.companyName ?? ""} was unable to confirm booking <strong>${e.referenceNumber ?? ""}</strong>.</p>
          ${reasonBlock}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.vipMembershipWelcome: {
      const name = greetingName(variables.firstName ?? "");
      const portalBlock = variables.portalUrl
        ? button(variables.portalUrl, "View your VIP benefits")
        : "";
      return {
        templateId,
        subject: `Welcome to ${variables.planName ?? "VIP Plus"}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Welcome to <strong>${e.planName ?? "VIP Plus"}</strong> with ${e.companyName ?? ""}.</p>
          <p>Your membership is active — enjoy priority scheduling and member-only perks.</p>
          ${portalBlock}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.vipMembershipRenewal: {
      const name = greetingName(variables.firstName ?? "");
      const renewalDateBlock = e.renewalDateLabel
        ? `<p><strong>Renewal date:</strong> ${e.renewalDateLabel}</p>`
        : "";
      const amountBlock = e.amount ? `<p><strong>Amount paid:</strong> $${e.amount}</p>` : "";
      return {
        templateId,
        subject: `Your ${variables.planName ?? "VIP Plus"} membership renewed`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Thanks — your <strong>${e.planName ?? "VIP Plus"}</strong> membership with ${e.companyName ?? ""} renewed successfully.</p>
          ${renewalDateBlock}
          ${amountBlock}
          <p>Your benefits stay active. We're glad to have you as a member.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.vipMembershipPaymentFailed: {
      const name = greetingName(variables.firstName ?? "");
      const graceBlock = e.graceEndsAtLabel
        ? `<p><strong>Benefits stay active until:</strong> ${e.graceEndsAtLabel}</p>`
        : "";
      const retryBlock = e.nextRetryAtLabel
        ? `<p><strong>Next payment retry:</strong> ${e.nextRetryAtLabel}</p>`
        : "";
      const amountBlock = e.amount ? `<p><strong>Amount due:</strong> $${e.amount}</p>` : "";
      const paymentBlock = variables.paymentUrl ? button(variables.paymentUrl, "Update payment method") : "";
      const step = variables.dunningStepIndex ?? "0";
      const reminderCopy =
        step === "0"
          ? "We couldn't process your latest VIP membership payment."
          : step === "1"
            ? "Friendly reminder — your VIP membership payment is still past due."
            : "Final reminder during your grace period — update your payment to keep member benefits.";
      return {
        templateId,
        subject: "Action needed: your VIP payment didn't go through",
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${reminderCopy}</p>
          <p><strong>Plan:</strong> ${e.planName ?? "VIP Plus"}</p>
          ${amountBlock}
          ${graceBlock}
          ${retryBlock}
          ${paymentBlock}
          <p>Questions? Contact ${e.companyName ?? "us"} and we'll help.</p>
        `)
      };
    }
    default:
      throw new Error(`UNKNOWN_EMAIL_TEMPLATE:${templateId}`);
  }
}

export function resolveOutboundEmailFromAddress(input: {
  resendEmailEnabled: boolean;
  resendFromEmail: string;
  sendgridFromEmail: string;
}): string {
  if (input.resendEmailEnabled && input.resendFromEmail.length > 0) {
    return input.resendFromEmail;
  }

  return input.sendgridFromEmail;
}
