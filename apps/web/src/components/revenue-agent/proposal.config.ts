import type { OperatorInboxItem } from "@fsm/types";

/** Config for Revenue Agent proposals (Figma 10:309, 10:379; labels 10:331, 10:349, 10:367). Add an action type here to support it everywhere. */
export const REVENUE_ACTION_PREFIX = "revenue.";

export const PROPOSAL_ACTION_TYPES = {
  "revenue.invoice_reminder.propose": { category: "Invoice", label: "Revenue · Invoice", verb: "Send invoice reminder" },
  "revenue.estimate_followup.propose": { category: "Follow-up", label: "Revenue · Follow-up", verb: "Send estimate follow-up" },
  "revenue.reactivation.propose": { category: "Win-back", label: "Retention · Win-back", verb: "Send win-back offer" },
  "revenue.plan_offer.propose": { category: "Recurring offer", label: "Retention · Recurring offer", verb: "Send maintenance plan offer" }
} as const satisfies Record<string, { category: string; label: string; verb: string }>;

export type ProposalActionType = keyof typeof PROPOSAL_ACTION_TYPES;

export const PROPOSAL_STATES = [
  { key: "awaiting_approval", label: "Needs approval" },
  { key: "approved", label: "Approved" },
  { key: "executed", label: "Sent" },
  { key: "rejected", label: "Rejected" }
] as const;

/** Actions shown on a card / detail (Figma 10:309 card, 10:430–434 detail). `path` maps to API override paths. */
export const PROPOSAL_ACTIONS = [
  { key: "approve", label: "Approve & send", path: "approve", tone: "primary" },
  { key: "edit", label: "Edit", path: "edit", tone: "secondary" },
  { key: "reject", label: "Reject", path: "reject", tone: "danger" }
] as const;

export type ProposalActionKey = (typeof PROPOSAL_ACTIONS)[number]["key"];

export const EMPTY_VALUE = "—";

export function isRevenueProposal(actionType: string): boolean {
  return actionType.startsWith(REVENUE_ACTION_PREFIX);
}

export function proposalTypeConfig(actionType: string) {
  return (
    PROPOSAL_ACTION_TYPES[actionType as ProposalActionType] ?? { category: "Revenue", label: "Revenue", verb: "Send message" }
  );
}

export function proposalStateLabel(state: string): string {
  return PROPOSAL_STATES.find((s) => s.key === state)?.label ?? state;
}

export function availableActions(item: Pick<OperatorInboxItem, "overridePaths">) {
  return PROPOSAL_ACTIONS.filter((action) => item.overridePaths.includes(action.path));
}

/** Consent-blocked copy (Figma 10:365, 10:372, 10:374, 10:376). */
export function consentBlockedCopy(displayName: string, channel: "sms" | "email") {
  const first = displayName.trim().split(/\s+/)[0] || "This customer";
  const noun = channel === "email" ? "email" : "texts";
  const short = channel === "email" ? "Email" : "Text";
  return {
    status: "Consent blocked",
    message: `Can’t send: ${first} hasn’t opted in to ${noun}. ${short} opt-in missing.`,
    request: channel === "email" ? "Request email consent" : "Request text consent",
    dismiss: "Dismiss"
  };
}
