import { describe, expect, it } from "vitest";

import {
  RENVANI_COMMERCIAL_PLANS,
  RENVANI_PLAN_USAGE_ENTITLEMENTS,
  assertUnlimitedJobsAndAutomationsOnAllPlans,
  findFiniteJobOrAutomationLimits,
  getPlanUsageEntitlements,
  resolveCommercialPlanFromSubscription
} from "./renvani-plan-entitlements.js";

describe("renvani-plan-entitlements (FS-136)", () => {
  it("defines Startup, Flex, and Flat with unlimited jobs and automations", () => {
    assertUnlimitedJobsAndAutomationsOnAllPlans();
    expect(findFiniteJobOrAutomationLimits()).toEqual([]);
  });

  it("exposes entitlements for every commercial plan", () => {
    for (const plan of RENVANI_COMMERCIAL_PLANS) {
      const entitlements = getPlanUsageEntitlements(plan);
      expect(entitlements.maxJobs).toBeNull();
      expect(entitlements.maxAutomations).toBeNull();
      expect(RENVANI_PLAN_USAGE_ENTITLEMENTS[plan]).toEqual(entitlements);
    }
  });

  it("maps paid subscription tiers and defaults others to startup", () => {
    expect(resolveCommercialPlanFromSubscription("flex")).toBe("flex");
    expect(resolveCommercialPlanFromSubscription("flat")).toBe("flat");
    expect(resolveCommercialPlanFromSubscription(null)).toBe("startup");
  });

  it("fails the guard when a finite limit is introduced", () => {
    const original = RENVANI_PLAN_USAGE_ENTITLEMENTS.flex.maxJobs;
    try {
      RENVANI_PLAN_USAGE_ENTITLEMENTS.flex.maxJobs = 100;
      expect(() => assertUnlimitedJobsAndAutomationsOnAllPlans()).toThrow(/FS-136/);
    } finally {
      RENVANI_PLAN_USAGE_ENTITLEMENTS.flex.maxJobs = original;
    }
  });
});
