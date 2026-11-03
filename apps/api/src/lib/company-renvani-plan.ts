import {
  resolveConnectApplicationFeeFraction,
  serviceFeeRateBpsForPlan,
  type RenvaniPlanId
} from "@fsm/config/stripe-pricing";
import type { CompanySettings } from "@fsm/types";

type CompanySettingsCarrier = {
  settings: unknown;
};

export type RenvaniSubscriptionPlan = "flex" | "flat";

export function readRenvaniSubscriptionPlan(
  company: CompanySettingsCarrier
): RenvaniSubscriptionPlan | null {
  if (!company.settings || typeof company.settings !== "object" || Array.isArray(company.settings)) {
    return null;
  }

  const planTier = (company.settings as CompanySettings).stripePlatformBilling?.planTier;
  return planTier === "flex" || planTier === "flat" ? planTier : null;
}

export function resolveCompanyConnectApplicationFeeFraction(company: CompanySettingsCarrier): number {
  return resolveConnectApplicationFeeFraction(readRenvaniSubscriptionPlan(company));
}

const SERVICE_FEE_PLAN_IDS: ReadonlySet<string> = new Set<RenvaniPlanId>(["flex", "flat", "founding", "startup"]);

/**
 * Customer-paid Service Fee percent shown in Connect status. Derived from serviceFeeRateBpsForPlan
 * (same as checkout; not STRIPE_PLATFORM_FEE_PERCENT): Flat -> 0; every other plan, including
 * unset/unknown, -> SERVICE_FEE_RATE_BPS / 100 (2).
 */
export function resolveCompanyServiceFeePercent(company: CompanySettingsCarrier): number {
  const settings = company.settings;
  const raw =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as { stripePlatformBilling?: { planTier?: unknown } }).stripePlatformBilling?.planTier
      : undefined;
  const plan = typeof raw === "string" && SERVICE_FEE_PLAN_IDS.has(raw) ? (raw as RenvaniPlanId) : null;
  return serviceFeeRateBpsForPlan(plan) / 100;
}
