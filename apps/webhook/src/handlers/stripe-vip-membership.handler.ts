import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import type Stripe from "stripe";

import { companies, customers, db, emitEventWithExecutor } from "@fsm/db";
import {
  buildVipRenewalEmailJobId,
  buildVipWelcomeEmailJobId,
  cancelScheduledVipMembershipDunning,
  enqueueVipMembershipEmail,
  scheduleVipMembershipDunningEmails
} from "@fsm/jobs";
import {
  extractVipMembershipContext,
  getStripeMetadataString,
  isVipMembershipBillingMetadata,
  resolveVipGraceDaysFromCompanySettings,
  VIP_MEMBERSHIP_BILLING_KIND
} from "@fsm/types";

import { stripe } from "../lib/stripe-client.js";

type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;

function centsToCurrencyString(value: number | null | undefined): string {
  return new Decimal(value ?? 0).div(100).toFixed(2);
}

function formatEmailDateFromUnix(seconds: number | null | undefined): string | null {
  if (!seconds) {
    return null;
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatEmailDateFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadCompany(companyId: string): Promise<CompanyRow | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  return company ?? null;
}

async function loadCustomer(customerId: string, companyId: string): Promise<CustomerRow | null> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(1);

  return customer ?? null;
}

function mergeInvoiceAndSubscriptionMetadata(
  invoiceMetadata: Stripe.Metadata | null | undefined,
  subscriptionMetadata: Stripe.Metadata | null | undefined
): Record<string, string | undefined> {
  return {
    ...(subscriptionMetadata ?? {}),
    ...(invoiceMetadata ?? {})
  };
}

export async function resolveVipMetadataForInvoice(
  stripeInvoice: Stripe.Invoice
): Promise<Record<string, string | undefined> | null> {
  if (isVipMembershipBillingMetadata(stripeInvoice.metadata)) {
    return stripeInvoice.metadata ?? {};
  }

  const invoiceBillingKind = getStripeMetadataString(stripeInvoice.metadata, "billingKind");

  if (invoiceBillingKind && invoiceBillingKind !== VIP_MEMBERSHIP_BILLING_KIND) {
    return null;
  }

  // Connect maintenance/service-agreement invoices include companyId on the invoice — skip Stripe API.
  if (getStripeMetadataString(stripeInvoice.metadata, "companyId")) {
    return null;
  }

  if (!stripeInvoice.subscription) {
    return null;
  }

  const stripeSubscriptionId =
    typeof stripeInvoice.subscription === "string"
      ? stripeInvoice.subscription
      : stripeInvoice.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  if (!isVipMembershipBillingMetadata(subscription.metadata)) {
    return null;
  }

  return mergeInvoiceAndSubscriptionMetadata(stripeInvoice.metadata, subscription.metadata);
}

export async function handleVipSubscriptionCreated(
  event: Stripe.CustomerSubscriptionCreatedEvent,
  logContext: FastifyRequest["log"]
): Promise<boolean> {
  const subscription = event.data.object;
  const ctx = extractVipMembershipContext(subscription.metadata);

  if (!ctx) {
    return false;
  }

  const [company, customer] = await Promise.all([
    loadCompany(ctx.companyId),
    loadCustomer(ctx.customerId, ctx.companyId)
  ]);

  if (!company || !customer) {
    logContext.warn(
      { eventId: event.id, eventType: event.type, companyId: ctx.companyId },
      "VIP subscription created but company or customer was not found"
    );
    return true;
  }

  await emitEventWithExecutor(db, {
    companyId: ctx.companyId,
    eventType: "customer.updated",
    actorType: "system",
    entityType: "customer",
    entityId: customer.id,
    customerId: customer.id,
    payload: {
      stripeSubscriptionId: subscription.id,
      planName: ctx.planName,
      vipMembershipEmail: "welcome_queued"
    },
    summary: `VIP welcome email queued for ${customer.firstName}`
  });

  try {
    await enqueueVipMembershipEmail(
      {
        companyId: ctx.companyId,
        customerId: customer.id,
        emailKind: "welcome",
        stripeSubscriptionId: subscription.id,
        stripeInvoiceId: subscription.latest_invoice
          ? String(subscription.latest_invoice)
          : subscription.id,
        planName: ctx.planName
      },
      { jobId: buildVipWelcomeEmailJobId(subscription.id) }
    );
  } catch (error: unknown) {
    logContext.error(
      { err: error, companyId: ctx.companyId, customerId: customer.id, stripeSubscriptionId: subscription.id },
      "Failed to enqueue VIP welcome email"
    );
  }

  return true;
}

export async function handleVipInvoicePaymentSucceeded(
  event: Stripe.InvoicePaymentSucceededEvent,
  logContext: FastifyRequest["log"]
): Promise<boolean> {
  const stripeInvoice = event.data.object;
  const metadata = await resolveVipMetadataForInvoice(stripeInvoice);

  if (!metadata) {
    return false;
  }

  const ctx = extractVipMembershipContext(metadata);

  if (!ctx || !stripeInvoice.subscription) {
    return false;
  }

  const stripeSubscriptionId = String(stripeInvoice.subscription);
  const stripeInvoiceId = stripeInvoice.id;

  await cancelScheduledVipMembershipDunning(stripeSubscriptionId, stripeInvoiceId);

  if (stripeInvoice.billing_reason !== "subscription_cycle") {
    return true;
  }

  const amount = centsToCurrencyString(stripeInvoice.amount_paid);
  const renewalDateLabel = formatEmailDateFromUnix(stripeInvoice.status_transitions?.paid_at ?? null);

  await emitEventWithExecutor(db, {
    companyId: ctx.companyId,
    eventType: "payment.received",
    actorType: "system",
    entityType: "customer",
    entityId: ctx.customerId,
    customerId: ctx.customerId,
    payload: {
      stripeSubscriptionId,
      stripeInvoiceId,
      amount,
      vipMembershipEmail: "renewal_receipt_queued"
    },
    summary: "VIP renewal receipt email queued"
  });

  try {
    await enqueueVipMembershipEmail(
      {
        companyId: ctx.companyId,
        customerId: ctx.customerId,
        emailKind: "renewal_receipt",
        stripeSubscriptionId,
        stripeInvoiceId,
        planName: ctx.planName,
        amount
      },
      { jobId: buildVipRenewalEmailJobId(stripeInvoiceId) }
    );
  } catch (error: unknown) {
    logContext.error(
      { err: error, companyId: ctx.companyId, customerId: ctx.customerId, stripeInvoiceId },
      "Failed to enqueue VIP renewal email"
    );
  }

  return true;
}

export async function handleVipInvoicePaymentFailed(
  event: Stripe.InvoicePaymentFailedEvent,
  logContext: FastifyRequest["log"]
): Promise<boolean> {
  const stripeInvoice = event.data.object;
  const metadata = await resolveVipMetadataForInvoice(stripeInvoice);

  if (!metadata) {
    return false;
  }

  const ctx = extractVipMembershipContext(metadata);

  if (!ctx || !stripeInvoice.subscription) {
    return false;
  }

  const company = await loadCompany(ctx.companyId);

  if (!company) {
    logContext.warn({ eventId: event.id, companyId: ctx.companyId }, "VIP payment failed but company was not found");
    return true;
  }

  const graceDays = resolveVipGraceDaysFromCompanySettings(company.settings);
  const graceEndsAt = new Date();
  graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + graceDays);
  const graceEndsAtIso = graceEndsAt.toISOString();
  const nextRetryAtIso = stripeInvoice.next_payment_attempt
    ? new Date(stripeInvoice.next_payment_attempt * 1000).toISOString()
    : null;
  const stripeSubscriptionId = String(stripeInvoice.subscription);
  const paymentUrl = stripeInvoice.hosted_invoice_url ?? null;
  const amount = centsToCurrencyString(stripeInvoice.amount_due);

  await emitEventWithExecutor(db, {
    companyId: ctx.companyId,
    eventType: "payment.failed",
    actorType: "system",
    entityType: "customer",
    entityId: ctx.customerId,
    customerId: ctx.customerId,
    payload: {
      amount,
      stripeInvoiceId: stripeInvoice.id,
      stripeSubscriptionId,
      billingKind: getStripeMetadataString(metadata, "billingKind"),
      graceEndsAtIso
    },
    summary: `VIP membership payment failed — dunning scheduled (${graceDays}-day grace)`
  });

  try {
    await scheduleVipMembershipDunningEmails({
      companyId: ctx.companyId,
      customerId: ctx.customerId,
      stripeSubscriptionId,
      stripeInvoiceId: stripeInvoice.id,
      planName: ctx.planName,
      amount,
      paymentUrl,
      graceEndsAtIso,
      nextRetryAtIso,
      graceDays
    });
  } catch (error: unknown) {
    logContext.error(
      {
        err: error,
        companyId: ctx.companyId,
        customerId: ctx.customerId,
        stripeInvoiceId: stripeInvoice.id
      },
      "Failed to schedule VIP membership dunning emails"
    );
  }

  return true;
}
