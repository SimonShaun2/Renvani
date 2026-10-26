import { describe, expect, it } from "vitest";

import {
  extractVipMembershipContext,
  isVipMembershipBillingMetadata,
  resolveVipGraceDaysFromCompanySettings,
  VIP_MEMBERSHIP_BILLING_KIND
} from "./vip-membership-stripe.js";

describe("vip-membership-stripe", () => {
  it("detects VIP membership billing metadata", () => {
    expect(isVipMembershipBillingMetadata({ billingKind: VIP_MEMBERSHIP_BILLING_KIND })).toBe(true);
    expect(isVipMembershipBillingMetadata({ billingKind: "platform_mvp" })).toBe(false);
  });

  it("extracts company and customer ids from metadata", () => {
    const ctx = extractVipMembershipContext({
      billingKind: VIP_MEMBERSHIP_BILLING_KIND,
      companyId: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
      planName: "VIP Plus"
    });

    expect(ctx?.planName).toBe("VIP Plus");
    expect(ctx?.companyId).toContain("11111111");
  });

  it("resolves grace days from company settings with defaults", () => {
    expect(resolveVipGraceDaysFromCompanySettings(null)).toBe(7);
    expect(
      resolveVipGraceDaysFromCompanySettings({
        vipMembership: { pastDueGraceDays: 14 }
      })
    ).toBe(14);
  });
});
