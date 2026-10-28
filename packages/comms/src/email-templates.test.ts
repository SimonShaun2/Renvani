import { describe, expect, it } from "vitest";

import { escapeHtml } from "./email-layout.js";
import {
  EMAIL_TEMPLATE_IDS,
  type EmailTemplateId,
  renderTransactionalEmail,
  safeHref,
  sanitizeSubject
} from "./email-templates.js";

describe("renderTransactionalEmail", () => {
  it("renders booking confirmation with stable template id", () => {
    const rendered = renderTransactionalEmail(EMAIL_TEMPLATE_IDS.bookingConfirmation, {
      firstName: "Sam",
      companyName: "Acme HVAC",
      referenceNumber: "BK-1",
      scheduledLabel: "Apr 30, 8:00 AM"
    });

    expect(rendered.templateId).toBe("booking.confirmation");
    expect(rendered.subject).toContain("BK-1");
    expect(rendered.html).toContain("Acme HVAC");
    expect(rendered.html).toContain("Apr 30");
  });

  it("renders VIP lifecycle templates with Figma-aligned subjects", () => {
    const welcome = renderTransactionalEmail(EMAIL_TEMPLATE_IDS.vipMembershipWelcome, {
      firstName: "Sam",
      companyName: "Juniper Home Co.",
      planName: "VIP Plus",
      portalUrl: "https://example.test/vip"
    });
    expect(welcome.subject).toBe("Welcome to VIP Plus");

    const renewal = renderTransactionalEmail(EMAIL_TEMPLATE_IDS.vipMembershipRenewal, {
      firstName: "Sam",
      companyName: "Juniper Home Co.",
      planName: "VIP Plus",
      amount: "29.00",
      renewalDateLabel: "Oct 23, 2026"
    });
    expect(renewal.subject).toBe("Your VIP Plus membership renewed");

    const dunning = renderTransactionalEmail(EMAIL_TEMPLATE_IDS.vipMembershipPaymentFailed, {
      firstName: "Sam",
      companyName: "Juniper Home Co.",
      planName: "VIP Plus",
      amount: "29.00",
      paymentUrl: "https://pay.example.test",
      graceEndsAtLabel: "Oct 30, 2026",
      nextRetryAtLabel: "Oct 24, 2026",
      dunningStepIndex: "0"
    });
    expect(dunning.subject).toBe("Action needed: your VIP payment didn't go through");
  });

});

describe("email template HTML injection", () => {
  it("escapes attacker-controlled firstName in verify and signup-attempt emails", () => {
    for (const firstName of ["<script>alert(1)</script>", '"><img src=x onerror=alert(1)>']) {
      for (const id of [EMAIL_TEMPLATE_IDS.verifyEmail, EMAIL_TEMPLATE_IDS.signupAttempt]) {
        const { html } = renderTransactionalEmail(id, {
          firstName,
          verifyUrl: "https://app.getrenvani.com/verify-email?token=abc",
          loginUrl: "https://app.getrenvani.com/login",
          resetUrl: "https://app.getrenvani.com/forgot-password"
        });
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<img src=x");
        expect(html).toContain("&lt;");
      }
    }
  });

  it("neutralises non-http(s) hrefs and escapes href attributes", () => {
    const { html } = renderTransactionalEmail(EMAIL_TEMPLATE_IDS.signupAttempt, {
      firstName: "Ava",
      loginUrl: "javascript:alert(1)",
      resetUrl: 'https://x.test/a"onmouseover="alert(1)'
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('"onmouseover="');
    expect(safeHref("data:text/html,hi")).toBe("#");
    expect(safeHref("https://app.getrenvani.com/v?token=a&b=1")).toBe("https://app.getrenvani.com/v?token=a&amp;b=1");
  });
});

describe("FS-155: every interpolated field is HTML-escaped", () => {
  const PAYLOADS = ["<script>alert(1)</script>", '"><img src=x onerror=alert(1)>', "Tom & Jerry <b>"];
  const T = EMAIL_TEMPLATE_IDS;
  const FIELDS: Array<[EmailTemplateId, string[]]> = [
    [T.verifyEmail, ["firstName"]],
    [T.signupAttempt, ["firstName"]],
    [T.passwordReset, ["firstName"]],
    [T.estimateSent, ["firstName", "companyName", "estimateNumber", "title", "expiresAtLabel", "total"]],
    [T.invoiceSent, ["firstName", "companyName", "invoiceNumber", "dueAtLabel", "total"]],
    [T.invoiceReminder, ["firstName", "invoiceNumber", "total", "balanceDue", "dueAtLabel"]],
    [T.invoiceReminderOwnerAlert, ["ownerFirstName", "customerName", "invoiceNumber", "balanceDue", "companyName"]],
    [T.serviceAgreementRenewal, ["firstName", "planName", "nextServiceDateLabel", "companyName"]],
    [T.serviceAgreementPaymentFailed, ["ownerFirstName", "customerName", "planName", "amount", "companyName"]],
    [T.campaignMessage, ["firstName", "body", "companyName"]],
    [T.bookingConfirmation, ["firstName", "companyName", "referenceNumber", "scheduledLabel"]],
    [T.bookingDecline, ["firstName", "companyName", "referenceNumber", "reason"]],
    [T.vipMembershipWelcome, ["firstName", "planName", "companyName"]],
    [T.vipMembershipRenewal, ["firstName", "planName", "companyName", "renewalDateLabel", "amount"]],
    [T.vipMembershipPaymentFailed, ["firstName", "planName", "companyName", "amount", "graceEndsAtLabel", "nextRetryAtLabel"]],
    [T.ownerAlert, ["headline", "summary", "companyName"]]
  ];

  for (const [templateId, fields] of FIELDS) {
    for (const field of fields) {
      it(`${templateId}.${field}`, () => {
        for (const payload of PAYLOADS) {
          const { html, text } = renderTransactionalEmail(templateId, { [field]: payload, dunningStepIndex: "0" });
          expect(html).not.toContain(payload);
          expect(html).toContain(escapeHtml(payload));
          expect(html).not.toMatch(/<script|<img src=x/i);
          expect(text).toContain(payload);
        }
      });
    }
  }

  it("campaign body keeps line breaks as <br /> after escaping", () => {
    const { html } = renderTransactionalEmail(T.campaignMessage, { body: "Line 1 <b>\nLine 2" });
    expect(html).toContain("Line 1 &lt;b&gt;<br />Line 2");
  });

  it("URL fields go through the http(s) allow-list", () => {
    const urls: Array<[EmailTemplateId, string]> = [
      [T.estimateSent, "approvalUrl"],
      [T.invoiceSent, "paymentLinkUrl"],
      [T.serviceAgreementPaymentFailed, "manageUrl"],
      [T.vipMembershipWelcome, "portalUrl"],
      [T.vipMembershipPaymentFailed, "paymentUrl"],
      [T.ownerAlert, "actionUrl"]
    ];
    for (const [templateId, field] of urls) {
      const { html } = renderTransactionalEmail(templateId, { [field]: 'javascript:alert(1)//"><script>' });
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("<script>");
    }
  });
});

describe("email subject CR/LF sanitization", () => {
  const PAYLOADS = ["Hi\r\nBcc: evil@x.com", "Hi\nBcc: evil@x.com", "Hi\rBcc: evil@x.com", "Hi\u2028Bcc:\u2029evil@x.com\t\u0000"];
  const SUBJECT_FIELDS = ["subject", "estimateNumber", "invoiceNumber", "companyName", "planName", "referenceNumber"];
  for (const templateId of Object.values(EMAIL_TEMPLATE_IDS)) {
    it(`${templateId} subject has no CR/LF or control chars`, () => {
      for (const payload of PAYLOADS) {
        const vars = Object.fromEntries(SUBJECT_FIELDS.map((f) => [f, payload]));
        const { subject } = renderTransactionalEmail(templateId, vars);
        // eslint-disable-next-line no-control-regex
        expect(subject).not.toMatch(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/);
        expect(subject).toBe(subject.trim());
      }
    });
  }

  it("collapses runs of line breaks into one space and trims", () => {
    expect(sanitizeSubject("  Hi\r\n\r\nBcc: evil@x.com\n")).toBe("Hi Bcc: evil@x.com");
    expect(renderTransactionalEmail(EMAIL_TEMPLATE_IDS.campaignMessage, { subject: "Sale\r\nBcc: evil@x.com" }).subject).toBe(
      "Sale Bcc: evil@x.com"
    );
    expect(sanitizeSubject("Booking confirmed — ABC")).toBe("Booking confirmed — ABC");
  });
});
