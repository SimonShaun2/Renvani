import type { RenvaniSubscriptionPlan } from "./stripe-pricing.js";

/** Commercial plans referenced on the marketing site (Startup trial + paid Flex/Flat). */
export const RENVANI_COMMERCIAL_PLANS = ["startup", "flex", "flat"] as const;

export type RenvaniCommercialPlan = (typeof RENVANI_COMMERCIAL_PLANS)[number];

/**
 * `null` means unlimited — the MVP launch promise for jobs and automations on every plan.
 * Any finite number is a billable cap and must not ship without founder + GTM review.
 */
export type PlanResourceLimit = number | null;

export interface RenvaniPlanUsageEntitlements {
  maxJobs: PlanResourceLimit;
  maxAutomations: PlanResourceLimit;
}

export const RENVANI_PLAN_USAGE_ENTITLEMENTS: Record<RenvaniCommercialPlan, RenvaniPlanUsageEntitlements> = {
  startup: {
    maxJobs: null,
    maxAutomations: null
  },
  flex: {
    maxJobs: null,
    maxAutomations: null
  },
  flat: {
    maxJobs: null,
    maxAutomations: null
  }
};

export function resolveCommercialPlanFromSubscription(
  plan: RenvaniSubscriptionPlan | null | undefined
): RenvaniCommercialPlan {
  if (plan === "flex" || plan === "flat") {
    return plan;
  }

  return "startup";
}

export function getPlanUsageEntitlements(plan: RenvaniCommercialPlan): RenvaniPlanUsageEntitlements {
  return RENVANI_PLAN_USAGE_ENTITLEMENTS[plan];
}

export interface PlanLimitViolation {
  plan: RenvaniCommercialPlan;
  resource: "maxJobs" | "maxAutomations";
  limit: number;
}

/** Returns every plan/resource pair that would violate the unlimited launch promise. */
export function findFiniteJobOrAutomationLimits(): PlanLimitViolation[] {
  const violations: PlanLimitViolation[] = [];

  for (const plan of RENVANI_COMMERCIAL_PLANS) {
    const entitlements = RENVANI_PLAN_USAGE_ENTITLEMENTS[plan];
    if (entitlements.maxJobs !== null) {
      violations.push({ plan, resource: "maxJobs", limit: entitlements.maxJobs });
    }
    if (entitlements.maxAutomations !== null) {
      violations.push({ plan, resource: "maxAutomations", limit: entitlements.maxAutomations });
    }
  }

  return violations;
}

export function assertUnlimitedJobsAndAutomationsOnAllPlans(): void {
  const violations = findFiniteJobOrAutomationLimits();
  if (violations.length > 0) {
    const summary = violations.map((v) => `${v.plan}.${v.resource}=${v.limit}`).join(", ");
    throw new Error(`Plan entitlements must not cap jobs or automations (FS-136): ${summary}`);
  }
}
