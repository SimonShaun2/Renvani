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
 * Customer-paid Service Fee percent shown in Connect status, derived from SERVICE_FEE_RATE_BPS
 * (not STRIPE_PLATFORM_FEE_PERCENT). Flex/Founding/Startup -> 2; Flat or no/unknown plan -> 0.
 */
export function resolveCompanyServiceFeePercent(company: CompanySettingsCarrier): number {
  const settings = company.settings;
  const raw =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as { stripePlatformBilling?: { planTier?: unknown } }).stripePlatformBilling?.planTier
      : undefined;
  if (typeof raw !== "string" || !SERVICE_FEE_PLAN_IDS.has(raw)) return 0;
  return serviceFeeRateBpsForPlan(raw as RenvaniPlanId) / 100;
}
