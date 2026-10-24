/** Channel-agnostic transactional email templates (render to subject + html + text, in the Renvani layout). */

import { htmlToText, renderRenvaniLayout } from "./email-layout.js";

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

function button(href: string, label: string): string {
  return `
    <p>
      <a href="${href}" style="display: inline-block; padding: 12px 18px; background: #257afa; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        ${label}
      </a>
    </p>
  `.trim();
}

function greetingName(firstName: string): string {
  return firstName.trim().length > 0 ? firstName.trim() : "there";
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

function renderTemplateBody(templateId: EmailTemplateId, variables: Record<string, string>): RenderedBody {
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
          <p>If this was you, just log in. If you've forgotten your password, you can <a href="${variables.resetUrl ?? "#"}">reset it here</a>. If it wasn't you, no action is needed.</p>
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
      const titleBlock = variables.title ? `<p><strong>Title:</strong> ${variables.title}</p>` : "";
      const expiresBlock = variables.expiresAtLabel
        ? `<p><strong>Expires:</strong> ${variables.expiresAtLabel}</p>`
        : "";
      return {
        templateId,
        subject: `Estimate ${variables.estimateNumber ?? ""} from ${variables.companyName ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${variables.companyName ?? ""} sent you estimate <strong>${variables.estimateNumber ?? ""}</strong>.</p>
          ${titleBlock}
          <p><strong>Total:</strong> $${variables.total ?? "0.00"}</p>
          ${expiresBlock}
          ${button(variables.approvalUrl ?? "#", "Review / Approve")}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.invoiceSent: {
      const name = greetingName(variables.firstName ?? "");
      const dueBlock = variables.dueAtLabel ? `<p><strong>Due:</strong> ${variables.dueAtLabel}</p>` : "";
      return {
        templateId,
        subject: `Invoice ${variables.invoiceNumber ?? ""} from ${variables.companyName ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${variables.companyName ?? ""} sent you invoice <strong>${variables.invoiceNumber ?? ""}</strong>.</p>
          <p><strong>Total:</strong> $${variables.total ?? "0.00"}</p>
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
      const dueBlock = variables.dueAtLabel ? `<p><strong>Due:</strong> ${variables.dueAtLabel}</p>` : "";
      return {
        templateId,
        subject: `Reminder ${variables.invoiceNumber ?? ""} from ${variables.companyName ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${reminderCopyByLevel[level] ?? reminderCopyByLevel["1"]}</p>
          <p><strong>Invoice:</strong> ${variables.invoiceNumber ?? ""}</p>
          <p><strong>Total:</strong> $${variables.total ?? "0.00"}</p>
          <p><strong>Balance due:</strong> $${variables.balanceDue ?? "0.00"}</p>
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
          <p>A final invoice reminder was sent to <strong>${variables.customerName ?? ""}</strong>.</p>
          <p><strong>Invoice:</strong> ${variables.invoiceNumber ?? ""}</p>
          <p><strong>Balance due:</strong> $${variables.balanceDue ?? "0.00"}</p>
          <p>${variables.companyName ?? ""} may need manual follow-up if payment is still not received.</p>
          ${button(variables.paymentLinkUrl ?? "#", "View payment link")}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.serviceAgreementRenewal: {
      const name = greetingName(variables.firstName ?? "");
      const dateBlock = variables.nextServiceDateLabel
        ? `<p><strong>Next service date:</strong> ${variables.nextServiceDateLabel}</p>`
        : "";
      return {
        templateId,
        subject: `${variables.planName ?? "Your plan"} service is coming up`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Your <strong>${variables.planName ?? ""}</strong> service agreement is coming up soon.</p>
          ${dateBlock}
          <p>${variables.companyName ?? ""} will reach out if any scheduling updates are needed.</p>
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
          <p>A service agreement renewal payment failed for <strong>${variables.customerName ?? ""}</strong>.</p>
          <p><strong>Plan:</strong> ${variables.planName ?? ""}</p>
          <p><strong>Amount:</strong> $${variables.amount ?? "0.00"}</p>
          <p>${variables.companyName ?? ""} should review the subscription and payment method details.</p>
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
          <p>${variables.body ?? ""}</p>
          <p>Reply to this email if you'd like to connect with ${variables.companyName ?? ""}.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.bookingConfirmation: {
      const name = greetingName(variables.firstName ?? "");
      const scheduledBlock = variables.scheduledLabel
        ? `<p><strong>When:</strong> ${variables.scheduledLabel}</p>`
        : "";
      return {
        templateId,
        subject: `Booking confirmed — ${variables.referenceNumber ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${variables.companyName ?? ""} confirmed your booking <strong>${variables.referenceNumber ?? ""}</strong>.</p>
          ${scheduledBlock}
          <p>If you need to make changes, contact ${variables.companyName ?? "us"}.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.bookingDecline: {
      const name = greetingName(variables.firstName ?? "");
      const reasonBlock = variables.reason
        ? `<p>${variables.reason}</p>`
        : "<p>Please contact our office to reschedule.</p>";
      return {
        templateId,
        subject: `Booking update — ${variables.referenceNumber ?? ""}`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>${variables.companyName ?? ""} was unable to confirm booking <strong>${variables.referenceNumber ?? ""}</strong>.</p>
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
          <p>Welcome to <strong>${variables.planName ?? "VIP Plus"}</strong> with ${variables.companyName ?? ""}.</p>
          <p>Your membership is active — enjoy priority scheduling and member-only perks.</p>
          ${portalBlock}
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.vipMembershipRenewal: {
      const name = greetingName(variables.firstName ?? "");
      const renewalDateBlock = variables.renewalDateLabel
        ? `<p><strong>Renewal date:</strong> ${variables.renewalDateLabel}</p>`
        : "";
      const amountBlock = variables.amount ? `<p><strong>Amount paid:</strong> $${variables.amount}</p>` : "";
      return {
        templateId,
        subject: `Your ${variables.planName ?? "VIP Plus"} membership renewed`,
        html: emailShell(`
          <p>Hi ${name},</p>
          <p>Thanks — your <strong>${variables.planName ?? "VIP Plus"}</strong> membership with ${variables.companyName ?? ""} renewed successfully.</p>
          ${renewalDateBlock}
          ${amountBlock}
          <p>Your benefits stay active. We're glad to have you as a member.</p>
        `)
      };
    }
    case EMAIL_TEMPLATE_IDS.vipMembershipPaymentFailed: {
      const name = greetingName(variables.firstName ?? "");
      const graceBlock = variables.graceEndsAtLabel
        ? `<p><strong>Benefits stay active until:</strong> ${variables.graceEndsAtLabel}</p>`
        : "";
      const retryBlock = variables.nextRetryAtLabel
        ? `<p><strong>Next payment retry:</strong> ${variables.nextRetryAtLabel}</p>`
        : "";
      const amountBlock = variables.amount ? `<p><strong>Amount due:</strong> $${variables.amount}</p>` : "";
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
          <p><strong>Plan:</strong> ${variables.planName ?? "VIP Plus"}</p>
          ${amountBlock}
          ${graceBlock}
          ${retryBlock}
          ${paymentBlock}
          <p>Questions? Contact ${variables.companyName ?? "us"} and we'll help.</p>
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
