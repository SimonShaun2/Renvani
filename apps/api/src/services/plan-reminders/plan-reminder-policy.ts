/**
 * Pure policy for maintenance-plan renewal + seasonal tune-up reminders (no I/O, unit-tested).
 * Rule: automation_rules.rule_type = 'service_agreement_renewal' (existing enum value, default OFF).
 *   threshold_days                 -> renewal window (days before end date), default 30
 *   config.tuneUpReminders         -> also remind when next_service_date is due, default true (rule must be on)
 *   config.tuneUpWindowDays        -> tune-up window (days before next_service_date), default 14
 *   config.customerCooldownDays    -> max one plan reminder per customer per N days, default 7
 *   config.companyDailyLimit       -> max plan reminders per company per day, default 100
 */
import { pickReviewChannel, type InvoicePaidReviewFacts, type ReviewAutomationChannel } from "../automation/review-request-policy.js";

export type PlanReminderKind = "renewal" | "tune_up";

export const PLAN_RENEWAL_WINDOW_DAYS = 30;
export const PLAN_TUNE_UP_WINDOW_DAYS = 14;
export const PLAN_REMINDER_CUSTOMER_COOLDOWN_DAYS = 7;
export const PLAN_REMINDER_COMPANY_DAILY_LIMIT = 100;
export const PLAN_REMINDER_JOB_NAME = "send-plan-reminder";

export interface PlanReminderRuleSettings {
  renewalWindowDays: number;
  tuneUpReminders: boolean;
  tuneUpWindowDays: number;
  customerCooldownDays: number;
  companyDailyLimit: number;
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function readPlanReminderSettings(rule: { thresholdDays: number | null; config: unknown } | null): PlanReminderRuleSettings {
  const config = rule?.config && typeof rule.config === "object" && !Array.isArray(rule.config) ? (rule.config as Record<string, unknown>) : {};
  return {
    renewalWindowDays: positiveInt(rule?.thresholdDays, PLAN_RENEWAL_WINDOW_DAYS),
    tuneUpReminders: config.tuneUpReminders !== false,
    tuneUpWindowDays: positiveInt(config.tuneUpWindowDays, PLAN_TUNE_UP_WINDOW_DAYS),
    customerCooldownDays: positiveInt(config.customerCooldownDays, PLAN_REMINDER_CUSTOMER_COOLDOWN_DAYS),
    companyDailyLimit: positiveInt(config.companyDailyLimit, PLAN_REMINDER_COMPANY_DAILY_LIMIT)
  };
}

export interface PlanReminderPlanFacts {
  id: string;
  status: string;
  endDate: string | null;
  nextServiceDate: string | null;
  stripeCurrentPeriodEnd?: Date | null;
  stripeCancelAtPeriodEnd?: boolean | null;
}

export interface DueReminder {
  planId: string;
  kind: PlanReminderKind;
  /** YYYY-MM-DD. Part of the idempotency key: one reminder per plan per renewal/visit window. */
  dueDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

export function renewalDueDate(plan: PlanReminderPlanFacts): string | null {
  if (plan.endDate) return plan.endDate.slice(0, 10);
  if (plan.stripeCurrentPeriodEnd instanceof Date && !Number.isNaN(plan.stripeCurrentPeriodEnd.getTime())) {
    return plan.stripeCurrentPeriodEnd.toISOString().slice(0, 10);
  }
  return null;
}

/** Window selection: due date in [today, today + window]. Past-due and far-future dates are ignored. */
export function selectDueReminders(plan: PlanReminderPlanFacts, todayIso: string, settings: PlanReminderRuleSettings): DueReminder[] {
  if (plan.status !== "active") return [];
  const due: DueReminder[] = [];
  const renewal = renewalDueDate(plan);
  if (renewal && !plan.stripeCancelAtPeriodEnd) {
    const days = daysBetween(todayIso, renewal);
    if (days >= 0 && days <= settings.renewalWindowDays) due.push({ planId: plan.id, kind: "renewal", dueDate: renewal });
  }
  if (settings.tuneUpReminders && plan.nextServiceDate) {
    const next = plan.nextServiceDate.slice(0, 10);
    const days = daysBetween(todayIso, next);
    // Skip a tune-up that falls on/after the plan ends (the renewal reminder covers it).
    const endsFirst = renewal !== null && next >= renewal;
    if (days >= 0 && days <= settings.tuneUpWindowDays && !endsFirst) due.push({ planId: plan.id, kind: "tune_up", dueDate: next });
  }
  return due;
}

export function planReminderJobId(reminder: Pick<DueReminder, "planId" | "kind" | "dueDate">): string {
  return `plan-reminder-${reminder.kind}-${reminder.planId}-${reminder.dueDate}`;
}

export type PlanReminderSkipReason =
  | "rule_disabled"
  | "plan_not_eligible"
  | "do_not_contact"
  | "no_consented_channel"
  | "already_sent"
  | "customer_rate_limited"
  | "company_rate_limited";

export function pickPlanReminderChannel(
  customer: InvoicePaidReviewFacts["customer"],
  smsLive: boolean
): ReviewAutomationChannel | null {
  if (customer.doNotContact) return null;
  return pickReviewChannel(customer, smsLive);
}

export function todayInTimezone(now: Date, timezone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
