import { describe, expect, it } from "vitest";

import { EMAIL_TEMPLATE_IDS } from "./email-templates.js";
import {
  isMvpResendTransactionalTemplate,
  MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS,
  resendTagsForTransactionalTemplate
} from "./transactional-template-catalog.js";

describe("transactional-template-catalog", () => {
  it("lists booking and VIP MVP template ids", () => {
    expect(MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS.bookingConfirmation).toBe("booking.confirmation");
    expect(MVP_RESEND_TRANSACTIONAL_TEMPLATE_IDS.vipPaymentFailedDunning).toBe(
      "vip_membership.payment_failed_dunning"
    );
  });

  it("recognizes MVP templates and excludes password reset", () => {
    expect(isMvpResendTransactionalTemplate(EMAIL_TEMPLATE_IDS.bookingDecline)).toBe(true);
    expect(isMvpResendTransactionalTemplate(EMAIL_TEMPLATE_IDS.vipMembershipWelcome)).toBe(true);
    expect(isMvpResendTransactionalTemplate(EMAIL_TEMPLATE_IDS.passwordReset)).toBe(false);
  });

  it("uses template id as Resend tag", () => {
    expect(resendTagsForTransactionalTemplate(EMAIL_TEMPLATE_IDS.bookingConfirmation)).toEqual([
      "booking.confirmation"
    ]);
  });
});
