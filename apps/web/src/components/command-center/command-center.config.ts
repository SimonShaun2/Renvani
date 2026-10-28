import type { OperatorInboxItem } from "@fsm/types";

/**
 * Command Center (Figma 10:2) region registry. Each region is a plug-in point: add/reorder entries here.
 * Values that no dev API serves yet render EMPTY ("—") rather than invented numbers.
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
  key: string;
  label: string;
  /** Data adapter: returns null until an endpoint exists. */
  value: () => string | null;
  detail: () => string | null;
  source: string;
}

const pending = () => null;

/** KPI row (10:74). Needs a period-scoped KPI aggregate endpoint; until then each shows "—". */
export const KPIS: Kpi[] = [
  { key: "direct", label: "Direct inquiries", value: pending, detail: pending, source: "Your branded site + app" },
  { key: "booked", label: "Inquiry → booked", value: pending, detail: pending, source: "Revenue Agent handoffs" },
  { key: "recurring", label: "First → recurring", value: pending, detail: pending, source: "Retention offers accepted" },
  { key: "marketing", label: "Marketing revenue", value: pending, detail: pending, source: "Automations + win-back" }
];

/** This month's loop (10:172). Needs funnel/loop counts endpoint. */
export const LOOP_STAGES = [
  { key: "discover", label: "Discover · inquiries", tone: "dark" },
  { key: "book", label: "Book · confirmed", tone: "accent" },
  { key: "tuneup", label: "Tune-up · completed", tone: "accent" },
  { key: "rebook", label: "Rebook · recurring", tone: "accent" }
] as const;

export type StatusTone = "approval" | "escalated" | "stale" | "neutral";

/** Status pill per inbox state (10:107 Needs approval, 10:123 Escalated, 10:155 Stale version). */
export const ITEM_STATUS: Record<string, { label: string; tone: StatusTone; exception: boolean }> = {
  awaiting_approval: { label: "Needs approval", tone: "approval", exception: false },
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

export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
