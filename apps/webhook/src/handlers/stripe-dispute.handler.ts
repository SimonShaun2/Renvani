import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { companies, db, upsertStripeDisputeFromWebhook, type StripeDisputeSnapshot } from "@fsm/db";
import { buildStripeDisputeResourceVersion } from "@fsm/types";

import { stripe } from "../lib/stripe-client.js";

/**
 * FS-199: mirror platform `charge.dispute.*` events into `stripe_disputes`.
 * Charges are destination charges, so disputes are raised on the platform account; the tenant is
 * resolved from the PaymentIntent's FSM metadata and must match the PI's transfer destination
 * (the company's Connect account). Read-only on Stripe: one PaymentIntent retrieve, no writes.
 */
export const STRIPE_DISPUTE_EVENT_TYPES = [
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated"
] as const;

export type StripeDisputeEventType = (typeof STRIPE_DISPUTE_EVENT_TYPES)[number];

export function isStripeDisputeEventType(type: string): type is StripeDisputeEventType {
  return (STRIPE_DISPUTE_EVENT_TYPES as readonly string[]).includes(type);
}

export type DisputeTenantResolver = (dispute: Stripe.Dispute) => Promise<string | null>;

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export const resolveDisputeCompanyId: DisputeTenantResolver = async (dispute) => {
  const paymentIntentId = idOf(dispute.payment_intent as string | { id: string } | null);
  if (!paymentIntentId) return null;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const companyId = intent.metadata?.companyId;
  const destination = idOf(intent.transfer_data?.destination as string | { id: string } | null | undefined);
  if (!companyId || !destination) return null;
  const [company] = await db
    .select({ id: companies.id, stripeAccountId: companies.stripeAccountId })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);
  return company && company.stripeAccountId === destination ? company.id : null;
};

export function buildDisputeSnapshot(event: Stripe.Event, dispute: Stripe.Dispute): StripeDisputeSnapshot {
  return {
    stripeDisputeId: dispute.id,
    stripeChargeId: idOf(dispute.charge as string | { id: string } | null),
    stripePaymentIntentId: idOf(dispute.payment_intent as string | { id: string } | null),
    amountMinor: dispute.amount,
    currency: dispute.currency,
    status: dispute.status,
    reason: dispute.reason,
    evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
    disputedAt: new Date(dispute.created * 1000),
    resourceVersion: buildStripeDisputeResourceVersion(event.created, event.id)
  };
}

export async function handleStripeDisputeEvent(
  event: Stripe.Event,
  logContext: FastifyRequest["log"],
  resolveCompanyId: DisputeTenantResolver = resolveDisputeCompanyId
): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  const companyId = await resolveCompanyId(dispute);
  if (!companyId) {
    // Ids only; never log dispute evidence or customer details.
    logContext.warn({ eventId: event.id, eventType: event.type, disputeId: dispute.id }, "Stripe dispute tenant not resolved");
    return;
  }
  const result = await upsertStripeDisputeFromWebhook(companyId, buildDisputeSnapshot(event, dispute));
  logContext.info(
    { eventId: event.id, eventType: event.type, companyId, disputeId: dispute.id, applied: result.applied },
    "Stripe dispute mirrored"
  );
}
