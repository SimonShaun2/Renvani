import type { OperatorInboxItem } from "@fsm/types";

import { AgentActionDeliveryStateV1Schema, type AgentActionDeliveryStateV1 } from "@fsm/types";

/**
 * Receipt / delivery states for one agent action (Figma 331:4230 desktop, 340:4219 tablet, 341:4255 mobile).
 * Reads #380's `executionReceipt.deliveryState` (AgentActionDeliveryStateV1: queued | provider_accepted | delivered |
 * failed), which the API writes on outbound actions only. Internal actions have no delivery state: they end
 * `succeeded` (Completed) or `failed` with `executionReceipt.error`. Nothing is ever shown as delivered without
 * `deliveryState: "delivered"` (no false success).
 */
export const DELIVERY_TOKENS = AgentActionDeliveryStateV1Schema.options;
export type DeliveryToken = AgentActionDeliveryStateV1;

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

const APPROVED_STATES = new Set(["approved", "executing", "succeeded", "failed", "reversed"]);
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

type ReceiptItem = Pick<OperatorInboxItem, "state" | "executionReceipt">;

/** The stored delivery state, else `failed` for a failed action (internal failures carry no delivery state). */
export function deliveryToken(item: ReceiptItem): DeliveryToken | null {
  const parsed = AgentActionDeliveryStateV1Schema.safeParse(item.executionReceipt?.deliveryState);
  if (parsed.success) return parsed.data;
  return item.state === "failed" ? "failed" : null;
}

/** `executionReceipt.error.message` written by the API on a failed execute (AgentActionFailedReceipt). */
export function receiptErrorMessage(receipt: Record<string, unknown> | null | undefined): string | null {
  const error = receipt?.error;
  if (!error || typeof error !== "object") return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() ? message : null;
}

/** Internal action finished in the same transaction (`succeeded`, no delivery state). */
export function isCompleted(item: ReceiptItem): boolean {
  return item.state === "succeeded" && deliveryToken(item) === null;
}

/** Operator-facing line for the state an approve / execute call actually returned. */
export function actionResultNotice(result: ReceiptItem): { text: string; tone: "ok" | "pending" | "error" } {
  const token = deliveryToken(result);
  if (token === "failed") {
    const message = receiptErrorMessage(result.executionReceipt);
    return { text: `Delivery failure${message ? `: ${message}` : ""}`, tone: "error" };
  }
  if (token === "delivered") return { text: "Delivered. Provider confirmed delivery.", tone: "ok" };
  if (token === "provider_accepted") return { text: "Provider accepted. Delivery is still unconfirmed.", tone: "pending" };
  if (token === "queued") return { text: "Queued · not sent. Provider delivery is still unconfirmed.", tone: "pending" };
  if (isCompleted(result)) return { text: "Completed.", tone: "ok" };
  if (result.state === "approved") return { text: "Approved. Nothing is sent until you execute it.", tone: "pending" };
  if (result.state === "cancelled") return { text: "Rejected. Nothing was sent.", tone: "pending" };
  return { text: `Now ${result.state.replace(/_/g, " ")}.`, tone: "pending" };
}

export interface DeliveryStep {
  key: DeliveryStepKey;
  label: string;
  detail: string;
  status: StepStatus;
}

/**
 * Steps 1–6 with done/current/pending. A completed internal action has no outbound delivery, so steps 1–5 read done.
 * Business outcome has no API field yet, so it is never marked done.
 */
export function deliverySteps(item: Pick<OperatorInboxItem, "state" | "executionReceipt">): DeliveryStep[] {
  const token = deliveryToken(item);
  const order: Record<DeliveryToken, number> = { queued: 2, provider_accepted: 3, delivered: 4, failed: -1 };
  let reached = 0;
  if (APPROVED_STATES.has(item.state)) reached = 1;
  if (isCompleted(item)) reached = 4;
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
  if (token === "failed") {
    const message = receiptErrorMessage(item.executionReceipt);
    return { label: "Delivery failure", tone: "red", note: message ?? "Execution failed. Review the event trail." };
  }
  if (token === "delivered") return { label: "Delivered", tone: "green", note: "Provider confirmed delivery. Business outcome is tracked separately." };
  if (token === "provider_accepted") return { label: "Provider accepted", tone: "blue", note: "Provider accepted the message. Delivery is still unconfirmed." };
  if (token === "queued") return { label: "Queued · not sent", tone: "amber", note: "Owner approved content. Provider delivery is still unconfirmed." };
  if (isCompleted(item)) return { label: "Completed", tone: "green", note: "Completed inside Renvani. This action has no outbound delivery." };
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
