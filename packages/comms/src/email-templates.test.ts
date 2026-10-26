import { describe, expect, it } from "vitest";

import { EMAIL_TEMPLATE_IDS, renderTransactionalEmail, resolveOutboundEmailFromAddress, safeHref } from "./email-templates.js";

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

  it("prefers Resend from address when email-first flag is on", () => {
    expect(
      resolveOutboundEmailFromAddress({
        resendEmailEnabled: true,
        resendFromEmail: "hello@renvani.test",
        sendgridFromEmail: "legacy@sendgrid.test"
      })
    ).toBe("hello@renvani.test");
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
