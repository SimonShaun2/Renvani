import type { M8ReactivationSignal } from "../fs-migrate/m8-job-history-chunk.read.js";

export const LOYALTY_REMINDER_RULE_FAMILIES = ["plan_cadence", "lapsed_reactivation"] as const;

export type LoyaltyReminderRuleFamily = (typeof LOYALTY_REMINDER_RULE_FAMILIES)[number];

export interface LoyaltyReminderCandidateV1 {
  ruleFamily: LoyaltyReminderRuleFamily;
  customerId: string;
  customerName: string;
  maintenancePlanId: string | null;
  evidenceJobId: string | null;
  importSessionId: string | null;
  planName: string | null;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
  daysUntilDue: number | null;
  daysSinceLastService: number | null;
  dryRun: boolean;
}

export interface MaintenancePlanLoyaltyRow {
  id: string;
  customerId: string;
  propertyId: string | null;
  name: string;
  price: string | null;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenUtc(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function parseIsoDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function buildPlanCadenceLoyaltyCandidates(
  plans: MaintenancePlanLoyaltyRow[],
  customerNameById: Map<string, string>,
  input: { horizonDays: number; asOf?: Date; dryRun: boolean }
): LoyaltyReminderCandidateV1[] {
  const horizonDays = Math.min(Math.max(input.horizonDays, 1), 90);
  const today = startOfUtcDay(input.asOf ?? new Date());
  const horizonEnd = new Date(today);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizonDays);

  const candidates: LoyaltyReminderCandidateV1[] = [];

  for (const plan of plans) {
    if (!plan.nextServiceDate) {
      continue;
    }

    const dueDate = parseIsoDateOnly(plan.nextServiceDate);
    if (dueDate.getTime() > horizonEnd.getTime()) {
      continue;
    }

    const daysUntilDue = daysBetweenUtc(today, dueDate);

    candidates.push({
      ruleFamily: daysUntilDue < 0 ? "lapsed_reactivation" : "plan_cadence",
      customerId: plan.customerId,
      customerName: customerNameById.get(plan.customerId) ?? "Unknown customer",
      maintenancePlanId: plan.id,
      evidenceJobId: null,
      importSessionId: null,
      planName: plan.name,
      nextServiceDate: plan.nextServiceDate,
      lastServiceDate: plan.lastServiceDate ?? null,
      daysUntilDue,
      daysSinceLastService: null,
      dryRun: input.dryRun
    });
  }

  candidates.sort((left, right) => {
    const leftDays = left.daysUntilDue ?? 999;
    const rightDays = right.daysUntilDue ?? 999;
    return leftDays - rightDays;
  });

  return candidates;
}

export function mapM8ReactivationSignalsToLoyaltyCandidates(
  signals: M8ReactivationSignal[],
  customerNameById: Map<string, string>,
  dryRun: boolean
): LoyaltyReminderCandidateV1[] {
  return signals.map((signal) => ({
    ruleFamily: "lapsed_reactivation",
    customerId: signal.customerId,
    customerName: customerNameById.get(signal.customerId) ?? "Unknown customer",
    maintenancePlanId: null,
    evidenceJobId: signal.lastJobId,
    importSessionId: signal.importSessionId,
    planName: null,
    nextServiceDate: null,
    lastServiceDate: signal.lastServiceCompletedAt.slice(0, 10),
    daysUntilDue: null,
    daysSinceLastService: signal.daysSinceLastService,
    dryRun
  }));
}

/** Prefer plan cadence when both rule families surface the same customer. */
export function mergeLoyaltyReminderCandidates(
  planCadence: LoyaltyReminderCandidateV1[],
  m8Reactivation: LoyaltyReminderCandidateV1[]
): LoyaltyReminderCandidateV1[] {
  const planCustomerIds = new Set(planCadence.map((row) => row.customerId));
  const merged = [...planCadence];

  for (const row of m8Reactivation) {
    if (planCustomerIds.has(row.customerId)) {
      continue;
    }
    merged.push(row);
  }

  return merged;
}

export function buildLoyaltyReminderEvaluationIdempotencyKey(input: {
  companyId: string;
  customerId: string;
  ruleFamily: LoyaltyReminderRuleFamily;
  windowKey: string;
}): string {
  return `loyalty:evaluate:${input.companyId}:${input.ruleFamily}:${input.customerId}:${input.windowKey}`;
}

export function loyaltyEvaluationWindowKey(asOf: Date = new Date()): string {
  const day = startOfUtcDay(asOf);
  const year = day.getUTCFullYear();
  const week = Math.floor(daysBetweenUtc(new Date(Date.UTC(year, 0, 1)), day) / 7);
  return `${year}-W${week}`;
}
