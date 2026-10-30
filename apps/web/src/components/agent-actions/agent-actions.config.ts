import type { OperatorInboxItem } from "@fsm/types";

/**
 * Agent action registry (Figma 10:309 card buttons, 10:430–434 detail buttons). An action shows only when the item's
 * `overridePaths` include its `path` AND the item is in one of its `states`. Add an action here to support it everywhere.
 */
export const AGENT_ACTIONS = [
  { key: "approve", path: "approve", label: "Approve & send", tone: "primary", states: ["awaiting_approval"] },
  { key: "edit", path: "edit", label: "Edit", tone: "secondary", states: ["awaiting_approval"] },
  { key: "reject", path: "reject", label: "Reject", tone: "ghost", states: ["awaiting_approval"] },
  { key: "execute", path: "execute", label: "Execute now", tone: "dark", states: ["approved"] }
] as const;

export type AgentActionKey = (typeof AGENT_ACTIONS)[number]["key"];
export type AgentActionTone = (typeof AGENT_ACTIONS)[number]["tone"];

export function agentActionsFor(item: Pick<OperatorInboxItem, "overridePaths" | "state">) {
  return AGENT_ACTIONS.filter(
    (a) => item.overridePaths.includes(a.path) && (a.states as readonly string[]).includes(item.state)
  );
}

/** Inbox tabs (Figma 10:289–10:304). `state` is passed to GET /operator/inbox?state=. */
export const INBOX_TABS = [
  { key: "awaiting_approval", label: "Needs approval" },
  { key: "approved", label: "Ready to execute" },
  { key: "failed", label: "Failed" },
  { key: "expired", label: "Expired" },
  { key: "executed", label: "Completed" },
  { key: "rejected", label: "Rejected" }
] as const;

export type InboxTabKey = (typeof INBOX_TABS)[number]["key"];

export const ACTION_TONE_CLASS: Record<AgentActionTone, string> = {
  primary: "bg-[#f6b400] text-[#0f1530] hover:bg-[#e0a400]",
  secondary: "border border-[#e6dccb] bg-white text-[#0f1530] hover:border-[#d4c6ad]",
  ghost: "text-[#2a3360] hover:bg-[#f3eadc]",
  dark: "bg-[#0f1530] text-white hover:bg-[#2a3360]"
};

/** Flattens an execution receipt (free-form JSON) into label/value rows for the audit view. */
export function receiptRows(receipt: Record<string, unknown> | null | undefined): [string, string][] {
  if (!receipt) return [];
  return Object.entries(receipt).map(([key, value]) => [
    key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "),
    value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)
  ]);
}

export function agentProducts(items: Pick<OperatorInboxItem, "provenance">[]): string[] {
  return [...new Set(items.map((i) => i.provenance.agentProduct))].sort();
}
