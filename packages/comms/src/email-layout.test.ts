import { describe, expect, it } from "vitest";

import { renderRenvaniLayout } from "./email-layout.js";
import { EMAIL_TEMPLATE_IDS, renderTransactionalEmail } from "./email-templates.js";

describe("Renvani email layout", () => {
  it("matches the layout snapshot (html + text)", () => {
    const out = renderRenvaniLayout({
      bodyHtml: "<p>Hi Ava,</p><p>Body</p>",
      bodyText: "Hi Ava,\n\nBody",
      preheader: "Preview"
    });
    expect(out.html).toMatchSnapshot();
    expect(out.text).toMatchSnapshot();
  });

  it("every template gets branded html, a plain-text fallback, and only the one TrayLoop legal line", () => {
    for (const id of Object.values(EMAIL_TEMPLATE_IDS)) {
      const r = renderTransactionalEmail(id, { firstName: "Ava", verifyUrl: "https://app/v", resetUrl: "https://app/r", loginUrl: "https://app/l" });
      expect(r.html).toContain("Renvani");
      expect(r.text.length).toBeGreaterThan(20);
      expect(r.text).toContain("https://getrenvani.com/privacy");
      for (const body of [r.html, r.text, r.subject]) {
        expect(body.match(/TrayLoop/g)?.length ?? 0).toBe(body === r.subject ? 0 : 1);
        expect(body).toContain(body === r.subject ? "" : "Renvani is a brand of TrayLoop Technologies LLC.");
      }
    }
  });

  it("verify email links to the verify URL in html and text", () => {
    const r = renderTransactionalEmail(EMAIL_TEMPLATE_IDS.verifyEmail, { firstName: "Ava", verifyUrl: "https://app.example/verify-email?token=abc" });
    expect(r.subject).toBe("Verify your email for Renvani");
    expect(r.html).toContain('href="https://app.example/verify-email?token=abc"');
    expect(r.text).toContain("https://app.example/verify-email?token=abc");
  });
});
