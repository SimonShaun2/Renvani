import { describe, expect, it } from "vitest";

import { resolveVipMembershipPolicy, VIP_MEMBERSHIP_POLICY_DEFAULTS } from "./vip-membership-policy.js";

describe("resolveVipMembershipPolicy", () => {
  it("returns founder defaults when settings are missing", () => {
    expect(resolveVipMembershipPolicy(undefined)).toEqual(VIP_MEMBERSHIP_POLICY_DEFAULTS);
    expect(resolveVipMembershipPolicy({})).toEqual(VIP_MEMBERSHIP_POLICY_DEFAULTS);
  });

  it("merges company overrides", () => {
    expect(
      resolveVipMembershipPolicy({
        vipMembership: { maxPauseMonths: 6, pastDueGraceDays: 14 }
      })
    ).toEqual({ maxPauseMonths: 6, pastDueGraceDays: 14 });
  });
});
