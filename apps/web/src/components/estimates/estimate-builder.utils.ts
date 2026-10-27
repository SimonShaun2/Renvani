import type { EstimateStatus } from "@fsm/types";

export const NOT_AVAILABLE = "Not available yet";

/** Frame 10:666 subtitle: "EST-1043 · Dana Whitfield · 412 Pine St". Only real fields; no agent attribution. */
export function buildEstimateSubtitle(input: {
  estimateNumber?: string | null;
  customerName?: string | null;
  address?: string | null;
}): string | null {
  const parts = [input.estimateNumber, input.customerName, input.address].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  return parts.length ? parts.join(" · ") : null;
}

/** Frame 10:731 pill. "Needs approval" while the operator still has to send. */
export function estimateApprovalPill(status: EstimateStatus): { label: string; tone: "amber" | "green" | "red" | "neutral" } {
  switch (status) {
    case "draft":
    case "revised":
      return { label: "Needs approval", tone: "amber" };
    case "sent":
      return { label: "Sent · awaiting customer", tone: "neutral" };
    case "approved":
    case "converted":
      return { label: "Approved", tone: "green" };
    case "declined":
      return { label: "Declined", tone: "red" };
    default:
      return { label: "Needs approval", tone: "amber" };
  }
}

/** "Oct 28" like the frame's Valid until row; "—" when the API has no expiry. */
export function formatValidUntil(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "—";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "—";
  // Date-only values ("2026-10-28") parse as UTC midnight; format them in UTC so they never show a day early.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) }).format(date);
}

export function formatDiscountCheck(discountAmount: string | number | null | undefined): string {
  const value = typeof discountAmount === "number" ? discountAmount : Number.parseFloat(discountAmount ?? "0");
  if (!Number.isFinite(value) || value <= 0) return "None";
  return `$${value.toFixed(2)} off`;
}

/** Send is allowed only when the saved server copy matches the draft (no unsaved edits, no save in flight). */
export function canSendEstimate(input: { hasEstimateId: boolean; isDirty: boolean; saveState: string }): boolean {
  return input.hasEstimateId && !input.isDirty && input.saveState !== "saving";
}
