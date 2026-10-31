import type { OperatorInboxItem } from "@fsm/types";

/**
 * Receipt / delivery states for one agent action (Figma 331:4230 desktop, 341:4255 mobile).
 * Code tokens match #380's AgentActionDeliveryStateV1 (`queued | provider_accepted | delivered | failed`).
 * STUB until #380 is merged and wired: dev's `executionReceipt` is a free-form record, so the token is read from
 * `executionReceipt.deliveryState` when present, otherwise derived from the item state and receipt outcome.
 * A `succeeded` outcome without a delivery state is never shown as delivered (no false success).
 */
export const DELIVERY_TOKENS = ["queued", "provider_accepted", "delivered", "failed"] as const;
export type DeliveryToken = (typeof DELIVERY_TOKENS)[number];

export const DELIVERY_STEPS = [
  { key: "prepared", label: "Prepared", detail: "Proposal and current source evidence verified" },
  { key: "approved", label: "Approved", detail: "Owner authorized the message content" },
  { key: "queued", label: "Queued", detail: "Persisted to durable outbox" },
  { key: "provider_accepted", label: "Provider accepted", detail: "Awaiting delivery receipt" },
  { key: "delivered", label: "Delivered", detail: "Not confirmed; do not mark completed" },
  { key: "business_outcome", label: "Business outcome", detail: "Estimate response and payment are separate" }
] as const;

export type DeliveryStepKey = (typeof DELIVERY_STEPS)[number]["key"];
export type StepStatus = "done" | "current" | "pending";

const APPROVED_STATES = new Set(["approved", "executing", "succeeded", "executed", "failed", "reversed"]);
const ESTIMATE_FOLLOW_UP = /estimate[_.-]?follow[_.-]?up/i;

export function isEstimateFollowUp(item: Pick<OperatorInboxItem, "provenance">): boolean {
  return ESTIMATE_FOLLOW_UP.test(item.provenance.actionType);
}

/** Estimate follow-ups first; otherwise keep the API order. */
export function sortApprovals<T extends Pick<OperatorInboxItem, "provenance">>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, rank: isEstimateFollowUp(item) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

export function deliveryToken(item: Pick<OperatorInboxItem, "state" | "executionReceipt">): DeliveryToken | null {
  const receipt = item.executionReceipt ?? null;
  const stored = receipt?.deliveryState;
  if (typeof stored === "string" && (DELIVERY_TOKENS as readonly string[]).includes(stored)) return stored as DeliveryToken;
  if (item.state === "failed" || receipt?.outcome === "failed") return "failed";
  if (receipt?.outcome === "queued" || receipt?.outcome === "succeeded" || item.state === "executing" || item.state === "succeeded" || item.state === "executed") {
    return "queued";
  }
  return null;
}

export interface DeliveryStep {
  key: DeliveryStepKey;
  label: string;
  detail: string;
  status: StepStatus;
}

/** Steps 1–6 with done/current/pending. Business outcome has no API field yet, so it is never marked done. */
export function deliverySteps(item: Pick<OperatorInboxItem, "state" | "executionReceipt">): DeliveryStep[] {
  const token = deliveryToken(item);
  const order: Record<DeliveryToken, number> = { queued: 2, provider_accepted: 3, delivered: 4, failed: -1 };
  let reached = 0;
  if (APPROVED_STATES.has(item.state)) reached = 1;
  if (token && token !== "failed") reached = order[token];
  if (token === "failed") reached = item.executionReceipt?.queuedAt ? 2 : 1;
  return DELIVERY_STEPS.map((step, index) => ({
    ...step,
    status: index <= reached ? "done" : index === reached + 1 && token !== "failed" ? "current" : "pending"
  }));
}

export interface DeliveryBadge {
  label: string;
  tone: "amber" | "blue" | "green" | "red" | "muted";
  note: string;
}

export function deliveryBadge(item: Pick<OperatorInboxItem, "state" | "executionReceipt">): DeliveryBadge {
  const token = deliveryToken(item);
  if (token === "failed") return { label: "Delivery failure", tone: "red", note: "Provider delivery failed. Review the event trail before retrying." };
  if (token === "delivered") return { label: "Delivered", tone: "green", note: "Provider confirmed delivery. Business outcome is tracked separately." };
  if (token === "provider_accepted") return { label: "Provider accepted", tone: "blue", note: "Provider accepted the message. Delivery is still unconfirmed." };
  if (token === "queued") return { label: "Queued · not sent", tone: "amber", note: "Owner approved content. Provider delivery is still unconfirmed." };
  if (item.state === "approved") return { label: "Approved", tone: "amber", note: "Approved, not yet queued. Approval is not delivery." };
  if (item.state === "rejected" || item.state === "cancelled") return { label: "Rejected", tone: "muted", note: "Nothing was sent." };
  if (item.state === "expired") return { label: "Expired", tone: "muted", note: "Nothing was sent." };
  return { label: "Needs approval", tone: "amber", note: "Nothing reaches the customer until you approve." };
}

/** Delivery evidence rows (Figma 331:4285–331:4291). */
export function deliveryEvidence(item: Pick<OperatorInboxItem, "id" | "state" | "executionReceipt" | "provenance">) {
  const receipt = item.executionReceipt ?? null;
  const providerId = receipt && typeof receipt.providerMessageId === "string" ? receipt.providerMessageId : null;
  const token = deliveryToken(item);
  return {
    actionId: item.id.length > 12 ? `${item.id.slice(0, 6)}…${item.id.slice(-3)}` : item.id,
    policyVersion: item.provenance.policyVersion,
    providerReceipt: providerId ?? "Pending",
    delivered: token === "delivered"
  };
}
