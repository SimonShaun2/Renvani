import type { LoyaltyReminderCandidateV1, LoyaltyReminderRuleFamily } from "@fsm/types";

/** Same roles as the API route preHandler (apps/api/src/routes/loyalty/index.ts). */
export const REMINDER_CANDIDATE_ROLES = ["owner", "admin", "dispatcher"] as const;

export function canViewReminderCandidates(role: string | null | undefined): boolean {
  return !!role && (REMINDER_CANDIDATE_ROLES as readonly string[]).includes(role);
}

export const HORIZON_MIN = 1;
export const HORIZON_MAX = 90;
export const HORIZON_DEFAULT = 14;
export const LAPSED_MIN = 1;
export const LAPSED_MAX = 730;

export type RangeResult = { ok: true; value: number | undefined } | { ok: false; message: string };

function parseRange(raw: string, min: number, max: number, label: string, optional: boolean): RangeResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return optional ? { ok: true, value: undefined } : { ok: false, message: `${label} is required.` };
  }
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: `${label} must be a whole number of days.` };
  const value = Number(trimmed);
  if (value < min || value > max) return { ok: false, message: `${label} must be between ${min} and ${max} days.` };
  return { ok: true, value };
}

export function parseHorizonDays(raw: string): RangeResult {
  return parseRange(raw, HORIZON_MIN, HORIZON_MAX, "Due within", false);
}

export function parseLapsedDays(raw: string): RangeResult {
  return parseRange(raw, LAPSED_MIN, LAPSED_MAX, "No visit in", true);
}

export const RULE_FAMILY_ORDER: LoyaltyReminderRuleFamily[] = ["plan_cadence", "lapsed_reactivation"];

export const RULE_FAMILY_LABELS: Record<LoyaltyReminderRuleFamily, { title: string; pill: string; description: string }> = {
  plan_cadence: {
    title: "Due soon",
    pill: "Plan visit due",
    description: "Maintenance plan customers whose next tune-up or inspection is coming up."
  },
  lapsed_reactivation: {
    title: "Lapsed customers",
    pill: "Win-back",
    description: "Past customers with no service visit in a while."
  }
};

export function groupByRuleFamily(candidates: LoyaltyReminderCandidateV1[]) {
  return RULE_FAMILY_ORDER.map((family) => ({
    family,
    items: candidates.filter((c) => c.ruleFamily === family)
  }));
}

/** Parses a YYYY-MM-DD (or ISO datetime) as a LOCAL calendar date, so it never shifts a day in US time zones. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocalDate(value: string | null | undefined): string {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function describeDaysUntilDue(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "Due today";
  return `In ${days} ${days === 1 ? "day" : "days"}`;
}

export function describeDaysSince(days: number | null): string {
  if (days === null) return "—";
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
