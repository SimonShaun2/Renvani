import { describe, expect, it } from "vitest";

import {
  buildVipMembershipJoinUrl,
  signVipMembershipJoinToken,
  verifyVipMembershipJoinToken
} from "./vip-membership-portal-token.js";

describe("vip-membership-portal-token", () => {
  it("round-trips join tokens", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const customerId = "22222222-2222-4222-8222-222222222222";
    const tierId = "33333333-3333-4333-8333-333333333333";

    const token = signVipMembershipJoinToken(companyId, customerId, tierId);
    const parsed = verifyVipMembershipJoinToken(token);

    expect(parsed).toEqual({ companyId, customerId, vipTierId: tierId });
    expect(buildVipMembershipJoinUrl("https://app.test", token)).toBe(
      `https://app.test/vip/join/${token}`
    );
  });
});

describe("vip join token expiry", () => {
  it("rejects expired tokens", async () => {
    const mod = await import("./vip-membership-portal-token.js");
    const fresh = mod.signVipMembershipJoinToken("c1", "u1", "t1");
    expect(mod.verifyVipMembershipJoinToken(fresh)).toEqual({ companyId: "c1", customerId: "u1", vipTierId: "t1" });
    expect(mod.verifyVipMembershipJoinToken(mod.signVipMembershipJoinToken("c1", "u1", "t1", -10))).toBeNull();
  });
});
