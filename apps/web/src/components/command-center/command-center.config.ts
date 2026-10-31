import type { CommandCenterKpiKey, CommandCenterLoopStage, OperatorInboxItem } from "@fsm/types";

/**
 * Command Center (Figma 10:2) region registry. Each region is a plug-in point: add/reorder entries here.
 * KPIs, loop and crews come from GET /api/v1/command-center/brief (FS-29); missing values render EMPTY ("—").
 */
export const EMPTY = "—";

export const CC_REGIONS = [
  { key: "header", figma: "10:64" },
  { key: "kpis", figma: "10:74" },
  { key: "needsYou", figma: "10:96" },
  { key: "rail", figma: "10:168" }
] as const;
export type CcRegionKey = (typeof CC_REGIONS)[number]["key"];

export interface Kpi {
  /** Key in `CommandCenterBrief.kpis` (GET /api/v1/command-center/brief). */
  key: CommandCenterKpiKey;
  label: string;
  source: string;
}

/** KPI row (10:74), filled from the brief's `kpis[]` by key. Missing/null values render EMPTY ("—"). */
export const KPIS: Kpi[] = [
  { key: "direct_inquiries", label: "Direct inquiries", source: "Your branded site + app + tracked numbers" },
  { key: "inquiry_to_booked", label: "Inquiry → booked", source: "Revenue Agent handoffs" },
  { key: "first_to_recurring", label: "First → recurring", source: "Retention offers accepted" },
  { key: "marketing_revenue", label: "Marketing revenue", source: "Automations + win-back" }
];

/** This month's loop (10:172), filled from the brief's `loop[]` by stage. */
export const LOOP_STAGES = [
  { key: "discover", label: "Discover · inquiries", tone: "dark" },
  { key: "book", label: "Book · confirmed", tone: "accent" },
  { key: "complete", label: "Tune-up · completed", tone: "accent" },
  { key: "rebook", label: "Rebook · recurring", tone: "accent" }
] as const satisfies ReadonlyArray<{ key: CommandCenterLoopStage["stage"]; label: string; tone: string }>;

export type StatusTone = "approval" | "escalated" | "stale" | "neutral";

/** Status pill per inbox state (10:107 Needs approval, 10:123 Escalated, 10:155 Stale version). */
export const ITEM_STATUS: Record<string, { label: string; tone: StatusTone; exception: boolean }> = {
  awaiting_approval: { label: "Needs approval", tone: "approval", exception: false },
  approved: { label: "Ready to execute", tone: "neutral", exception: false },
  escalated: { label: "Escalated", tone: "escalated", exception: true },
  failed: { label: "Failed", tone: "escalated", exception: true },
  stale: { label: "Stale version", tone: "stale", exception: true }
};

export const NEEDS_YOU_STATES = Object.keys(ITEM_STATUS);

export function itemStatus(state: string) {
  return ITEM_STATUS[state] ?? { label: state.replace(/_/g, " "), tone: "neutral" as const, exception: false };
}

export function agentLabel(agentProduct: string): string {
  const words = agentProduct.replace(/_/g, " ").trim();
  if (!words) return "Agent";
  const titled = words.replace(/\b\w/g, (c) => c.toUpperCase());
  return /agent$/i.test(titled) ? titled : `${titled} Agent`;
}

export function needsYouCounts(items: Pick<OperatorInboxItem, "state">[]) {
  let approvals = 0;
  let exceptions = 0;
  for (const item of items) {
    if (item.state === "awaiting_approval") approvals += 1;
    else if (itemStatus(item.state).exception) exceptions += 1;
  }
  return { approvals, exceptions };
}

export const NEUTRAL_GREETING = "Hello,";

export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
