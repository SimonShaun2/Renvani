import { z } from "zod";

/**
 * MVP P0 (FS-199): payouts & disputes read API.
 *
 * Dispute status/reason are stored as text and validated against an app-level registry
 * (no pgEnum migration when Stripe adds a value). Unknown-but-well-formed values from
 * Stripe are still persisted (webhook ingest must not drop data); the registry drives
 * filters, UI grouping and `isDisputeStatusOpen`.
 */
export const DISPUTE_TOKEN_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export type DisputeStatusDefinition = { status: string; open: boolean };

const disputeStatusRegistry = new Map<string, DisputeStatusDefinition>();

export const BUILTIN_DISPUTE_STATUSES: readonly DisputeStatusDefinition[] = [
  { status: "warning_needs_response", open: true },
  { status: "warning_under_review", open: true },
  { status: "warning_closed", open: false },
  { status: "needs_response", open: true },
  { status: "under_review", open: true },
  { status: "won", open: false },
  { status: "lost", open: false },
  { status: "prevented", open: false }
];

export function registerDisputeStatus(definition: DisputeStatusDefinition): void {
  if (!DISPUTE_TOKEN_PATTERN.test(definition.status)) {
    throw new Error(`Invalid dispute status: ${definition.status}`);
  }
  disputeStatusRegistry.set(definition.status, { ...definition });
}

for (const definition of BUILTIN_DISPUTE_STATUSES) registerDisputeStatus(definition);

export function isRegisteredDisputeStatus(status: string): boolean {
  return disputeStatusRegistry.has(status);
}

export function listRegisteredDisputeStatuses(): string[] {
  return [...disputeStatusRegistry.keys()];
}

/** Unknown statuses are treated as open so they surface for review rather than hide. */
export function isDisputeStatusOpen(status: string): boolean {
  return disputeStatusRegistry.get(status)?.open ?? true;
}

export const DisputeStatusFilterSchema = z
  .string()
  .regex(DISPUTE_TOKEN_PATTERN)
  .refine(isRegisteredDisputeStatus, { message: "Unknown dispute status" });

/** Normalises a Stripe-supplied token to the stored text format (lowercase, safe chars, ≤64). */
export function normalizeDisputeToken(value: string | null | undefined, fallback = "unknown"): string {
  const token = (value ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
  return DISPUTE_TOKEN_PATTERN.test(token) ? token : fallback;
}

/**
 * Resource version for webhook-mirrored disputes: Stripe event `created` (seconds) then event id.
 * Older or equal versions never overwrite newer state (out-of-order / replayed deliveries).
 */
export function buildStripeDisputeResourceVersion(eventCreatedSeconds: number, eventId: string): string {
  return `${String(Math.max(0, Math.trunc(eventCreatedSeconds))).padStart(12, "0")}:${eventId}`;
}

export const PAYOUTS_DISPUTES_PAGE_MAX = 100;
export const PAYOUTS_DISPUTES_PAGE_DEFAULT = 25;

export type PayoutSummary = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  arrivalDate: string | null;
  createdAt: string;
  method: string | null;
  type: string | null;
  description: string | null;
  failureCode: string | null;
};

export type DisputeSummary = {
  id: string;
  stripeDisputeId: string;
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  paymentId: string | null;
  invoiceId: string | null;
  amount: string;
  currency: string;
  status: string;
  open: boolean;
  reason: string;
  evidenceDueBy: string | null;
  disputedAt: string;
  updatedAt: string;
};
