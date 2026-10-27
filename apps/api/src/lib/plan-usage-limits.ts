import { and, count, eq, isNull } from "drizzle-orm";

import {
  getPlanUsageEntitlements,
  resolveCommercialPlanFromSubscription,
  type PlanResourceLimit,
  type RenvaniPlanUsageEntitlements
} from "@fsm/config/renvani-plan-entitlements";
import type { RenvaniSubscriptionPlan } from "@fsm/config/stripe-pricing";
import { automationRules, companies, db, jobs } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { readRenvaniSubscriptionPlan } from "./company-renvani-plan.js";

export function resolveUsageEntitlementsForSubscription(
  plan: RenvaniSubscriptionPlan | null | undefined
): RenvaniPlanUsageEntitlements {
  return getPlanUsageEntitlements(resolveCommercialPlanFromSubscription(plan));
}

function assertWithinLimit(
  resourceLabel: "jobs" | "automations",
  limit: PlanResourceLimit,
  currentCount: number
): void {
  if (limit === null) {
    return;
  }

  if (currentCount >= limit) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      `Your plan limit for ${resourceLabel} has been reached. Upgrade your plan to add more.`
    );
  }
}

export function assertPlanAllowsJobCreation(
  plan: RenvaniSubscriptionPlan | null | undefined,
  activeJobCount: number
): void {
  const entitlements = resolveUsageEntitlementsForSubscription(plan);
  assertWithinLimit("jobs", entitlements.maxJobs, activeJobCount);
}

export function assertPlanAllowsAutomationEnable(
  plan: RenvaniSubscriptionPlan | null | undefined,
  enabledAutomationCount: number
): void {
  const entitlements = resolveUsageEntitlementsForSubscription(plan);
  assertWithinLimit("automations", entitlements.maxAutomations, enabledAutomationCount);
}

type SelectExecutor = Pick<typeof db, "select">;

async function getCompanyForPlanCheck(
  companyId: string,
  executor: SelectExecutor
): Promise<{ settings: unknown }> {
  const [company] = await executor
    .select({ settings: companies.settings })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

async function countActiveJobs(companyId: string, executor: SelectExecutor): Promise<number> {
  const [row] = await executor
    .select({ value: count() })
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt)));

  return Number(row?.value ?? 0);
}

async function countEnabledAutomations(companyId: string, executor: SelectExecutor): Promise<number> {
  const [row] = await executor
    .select({ value: count() })
    .from(automationRules)
    .where(
      and(
        eq(automationRules.companyId, companyId),
        eq(automationRules.isEnabled, true),
        isNull(automationRules.deletedAt)
      )
    );

  return Number(row?.value ?? 0);
}

/**
 * Enforces plan caps before creating a job. Must be called with the tenant-scoped
 * transaction so counts respect RLS. Skips the count entirely when the limit is unlimited.
 */
export async function enforceJobCreationPlanLimit(
  companyId: string,
  executor: SelectExecutor
): Promise<void> {
  const company = await getCompanyForPlanCheck(companyId, executor);
  const plan = readRenvaniSubscriptionPlan(company);
  if (resolveUsageEntitlementsForSubscription(plan).maxJobs === null) {
    return;
  }
  const activeJobCount = await countActiveJobs(companyId, executor);
  assertPlanAllowsJobCreation(plan, activeJobCount);
}

/**
 * Enforces plan caps before enabling an automation rule, inside the caller's transaction.
 * Skips the count entirely when the limit is unlimited.
 */
export async function enforceAutomationEnablePlanLimit(
  companyId: string,
  executor: SelectExecutor
): Promise<void> {
  const company = await getCompanyForPlanCheck(companyId, executor);
  const plan = readRenvaniSubscriptionPlan(company);
  if (resolveUsageEntitlementsForSubscription(plan).maxAutomations === null) {
    return;
  }
  const enabledCount = await countEnabledAutomations(companyId, executor);
  assertPlanAllowsAutomationEnable(plan, enabledCount);
}
