import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@fsm/config";
import { SERVICE_FEE_RATE_BPS } from "@fsm/config/stripe-pricing";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

import {
  readRenvaniSubscriptionPlan,
  resolveCompanyConnectApplicationFeeFraction,
  resolveCompanyServiceFeePercent
} from "./company-renvani-plan.js";

describe("company-renvani-plan", () => {
  it("reads plan tier from company settings", () => {
    expect(
      readRenvaniSubscriptionPlan({
        settings: { stripePlatformBilling: { planTier: "flex" } }
      })
    ).toBe("flex");
    expect(
      readRenvaniSubscriptionPlan({
        settings: { stripePlatformBilling: { planTier: "flat" } }
      })
    ).toBe("flat");
  });

  it("applies shop fee only for flex tenants", () => {
    const flexCompany = { settings: { stripePlatformBilling: { planTier: "flex" as const } } };
    const flatCompany = { settings: { stripePlatformBilling: { planTier: "flat" as const } } };

    expect(resolveCompanyConnectApplicationFeeFraction(flexCompany)).toBeGreaterThan(0);
    expect(resolveCompanyConnectApplicationFeeFraction(flatCompany)).toBe(0);
  });

  describe("resolveCompanyServiceFeePercent (Connect status display)", () => {
    const withPlan = (planTier: unknown) => ({ settings: { stripePlatformBilling: { planTier } } });
    const feePercent = SERVICE_FEE_RATE_BPS / 100;

    afterEach(() => {
      vi.unstubAllEnvs();
      setupTestEnv();
      resetEnvCacheForTests();
    });

    it.each(["flex", "founding", "startup"])("%s -> 2", (plan) => {
      expect(feePercent).toBe(2);
      expect(resolveCompanyServiceFeePercent(withPlan(plan))).toBe(feePercent);
    });

    it("flat -> 0", () => {
      expect(resolveCompanyServiceFeePercent(withPlan("flat"))).toBe(0);
    });

    it.each([
      ["no settings", { settings: null }],
      ["no plan", { settings: {} }],
      ["null plan", withPlan(null)],
      ["unknown plan", withPlan("enterprise")]
    ])("%s -> 2 (matches checkout default)", (_label, company) => {
      expect(resolveCompanyServiceFeePercent(company)).toBe(feePercent);
    });

    it("ignores STRIPE_PLATFORM_FEE_PERCENT", () => {
      vi.stubEnv("STRIPE_PLATFORM_FEE_PERCENT", "2.9");
      resetEnvCacheForTests();
      expect(resolveCompanyServiceFeePercent(withPlan("flex"))).toBe(feePercent);
      vi.stubEnv("STRIPE_PLATFORM_FEE_PERCENT", "0");
      resetEnvCacheForTests();
      expect(resolveCompanyServiceFeePercent(withPlan("flex"))).toBe(feePercent);
      expect(resolveCompanyServiceFeePercent(withPlan("flat"))).toBe(0);
    });
  });
});
