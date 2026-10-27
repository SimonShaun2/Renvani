import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import type Stripe from "stripe";

import { env } from "@fsm/config";
import {
  companies,
  customers,
  db,
  emitEventWithExecutor,
  maintenancePlans
} from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";

import {
  forwardStripePaymentFailed,
  forwardStripePaymentSuccess
} from "../lib/invoice-service-bridge.js";
import { provisionVipMembershipFromSubscription } from "../lib/vip-membership-provision.js";
import { stripe } from "../lib/stripe-client.js";
import {
  handlePlatformSubscriptionDeleted,
  handlePlatformSubscriptionUpsert,
  isPlatformMvpBillingMetadata,
  shouldIgnoreMaintenancePlanSubscriptionInvoice
} from "./stripe-platform-billing.handler.js";
import { isVipMembershipBillingMetadata } from "@fsm/types";
import {
  handleVipInvoicePaymentFailed,
  handleVipInvoicePaymentSucceeded,
  handleVipSubscriptionCreated
} from "./stripe-vip-membership.handler.js";
import { handleStripeDisputeEvent, isStripeDisputeEventType } from "./stripe-dispute.handler.js";
import {
  claimEventProcessing,
  clearEventProcessingClaim,
  isEventProcessed,
  markEventProcessed
} from "../lib/stripe-idempotency.js";

type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type MaintenancePlanRow = typeof maintenancePlans.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "insert" | "update">;

function toIsoDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function centsToCurrencyString(value: number | null | undefined): string {
  return new Decimal(value ?? 0).div(100).toFixed(2);
}

function getMetadataString(
  metadata: Record<string, string | undefined> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getSubscriptionStatus(subscription: Stripe.Subscription): MaintenancePlanRow["status"] {
  if (subscription.pause_collection) {
    return "paused";
  }

  switch (subscription.status) {
    case "active":
    case "past_due":
    case "trialing":
      return "active";
    case "canceled":
      return "cancelled";
    case "unpaid":
    case "paused":
    case "incomplete":
    case "incomplete_expired":
      return "paused";
  }
}

async function getCompanyRecord(companyId: string, executor: SelectExecutor): Promise<CompanyRow | null> {
  const [company] = await executor
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  return company ?? null;
}

async function getCustomerRecord(customerId: string, companyId: string, executor: SelectExecutor): Promise<CustomerRow | null> {
  const [customer] = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(1);

  return customer ?? null;
}

async function getMaintenancePlanBySubscription(
  companyId: string,
  stripeSubscriptionId: string,
  executor: SelectExecutor
): Promise<MaintenancePlanRow | null> {
  const [plan] = await executor
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.companyId, companyId),
        eq(maintenancePlans.stripeSubscriptionId, stripeSubscriptionId),
        isNull(maintenancePlans.deletedAt)
      )
    )
    .limit(1);

  return plan ?? null;
}

function extractStripeCompanyId(
  metadata: Record<string, string | undefined> | null | undefined,
  logContext: FastifyRequest["log"],
  eventType: string
): string | null {
  const companyId = getMetadataString(metadata, "companyId");

  if (!companyId) {
    logContext.warn({ eventType }, "Stripe event missing companyId metadata");
    return null;
  }

  return companyId;
}

export async function handlePaymentIntentSucceeded(
  event: Stripe.PaymentIntentSucceededEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const invoiceId = getMetadataString(event.data.object.metadata, "invoiceId");
  const companyId = getMetadataString(event.data.object.metadata, "companyId");

  if (!invoiceId || !companyId) {
    logContext.warn({ eventId: event.id, eventType: event.type }, "Stripe payment intent missing FSM metadata");
    return;
  }

  await forwardStripePaymentSuccess(event);
}

export async function handlePaymentIntentFailed(
  event: Stripe.PaymentIntentPaymentFailedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const invoiceId = getMetadataString(event.data.object.metadata, "invoiceId");
  const companyId = getMetadataString(event.data.object.metadata, "companyId");

  if (!invoiceId || !companyId) {
    logContext.warn({ eventId: event.id, eventType: event.type }, "Stripe payment intent missing FSM metadata");
    return;
  }

  await forwardStripePaymentFailed(event);
}

export async function handleSubscriptionUpdated(
  event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionCreatedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const subscription = event.data.object;

  if (isPlatformMvpBillingMetadata(subscription.metadata)) {
    await handlePlatformSubscriptionUpsert(event, logContext);
    return;
  }

  if (isVipMembershipBillingMetadata(subscription.metadata)) {
    if (event.type === "customer.subscription.created") {
      await handleVipSubscriptionCreated(
        event as Stripe.CustomerSubscriptionCreatedEvent,
        logContext
      );
    }

    return;
  }

  const companyId = extractStripeCompanyId(subscription.metadata, logContext, event.type);

  if (!companyId) {
    return;
  }

  let plan = await getMaintenancePlanBySubscription(companyId, subscription.id, db);

  if (!plan) {
    if (getMetadataString(subscription.metadata, "billingKind") === "vip_membership") {
      await provisionVipMembershipFromSubscription(subscription, companyId);
      plan = await getMaintenancePlanBySubscription(companyId, subscription.id, db);
    }

    if (!plan) {
      logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Maintenance plan not found for Stripe subscription");
      return;
    }
  }

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const nextStatus = getSubscriptionStatus(subscription);
  const periodStartChanged =
    !!periodStart &&
    (!plan.stripeCurrentPeriodStart || plan.stripeCurrentPeriodStart.getTime() !== periodStart.getTime());

  await db.transaction(async (tx: TransactionExecutor) => {
    const updatedPlans = await tx
      .update(maintenancePlans)
      .set({
        stripeCurrentPeriodStart: periodStart,
        stripeCurrentPeriodEnd: periodEnd,
        stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
        status: nextStatus,
        updatedAt: new Date()
      })
      .where(and(eq(maintenancePlans.id, plan.id), eq(maintenancePlans.companyId, companyId), isNull(maintenancePlans.deletedAt)))
      .returning();
    const updatedPlan = updatedPlans[0];

    if (!updatedPlan) {
      return;
    }

    if (periodStartChanged) {
      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "maintenance_plan.renewed",
        entityType: "maintenance_plan",
        entityId: updatedPlan.id,
        customerId: updatedPlan.customerId,
        payload: {
          stripeSubscriptionId: subscription.id,
          stripeCurrentPeriodStart: updatedPlan.stripeCurrentPeriodStart,
          stripeCurrentPeriodEnd: updatedPlan.stripeCurrentPeriodEnd,
          status: updatedPlan.status
        },
        summary: `Maintenance plan ${updatedPlan.name} renewed`
      });
    }
  });
}

export async function handleSubscriptionDeleted(
  event: Stripe.CustomerSubscriptionDeletedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const subscription = event.data.object;

  if (isPlatformMvpBillingMetadata(subscription.metadata)) {
    await handlePlatformSubscriptionDeleted(event, logContext);
    return;
  }

  if (isVipMembershipBillingMetadata(subscription.metadata)) {
    return;
  }

  const companyId = extractStripeCompanyId(subscription.metadata, logContext, event.type);

  if (!companyId) {
    return;
  }

  const plan = await getMaintenancePlanBySubscription(companyId, subscription.id, db);

  if (!plan) {
    logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Maintenance plan not found for Stripe subscription");
    return;
  }

  await db.transaction(async (tx: TransactionExecutor) => {
    const updatedPlans = await tx
      .update(maintenancePlans)
      .set({
        status: "cancelled",
        endDate: toIsoDateString(new Date()),
        stripeCancelAtPeriodEnd: false,
        updatedAt: new Date()
      })
      .where(and(eq(maintenancePlans.id, plan.id), eq(maintenancePlans.companyId, companyId), isNull(maintenancePlans.deletedAt)))
      .returning();
    const updatedPlan = updatedPlans[0];

    if (!updatedPlan) {
      return;
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "maintenance_plan.cancelled",
      entityType: "maintenance_plan",
      entityId: updatedPlan.id,
      customerId: updatedPlan.customerId,
      payload: {
        stripeSubscriptionId: subscription.id
      },
      summary: `Maintenance plan ${updatedPlan.name} cancelled`
    });
  });
}

function sumInvoiceLineAmountForPrice(invoice: Stripe.Invoice, priceId: string): number {
  let total = 0;

  for (const line of invoice.lines?.data ?? []) {
    const linePriceId = typeof line.price === "string" ? line.price : line.price?.id ?? null;

    if (linePriceId === priceId) {
      total += line.amount ?? 0;
    }
  }

  return total;
}

export async function handleInvoiceCreated(
  event: Stripe.InvoiceCreatedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const stripeInvoice = event.data.object;

  if (!stripeInvoice.subscription || stripeInvoice.status !== "draft") {
    return;
  }

  const stripeSubscriptionId =
    typeof stripeInvoice.subscription === "string"
      ? stripeInvoice.subscription
      : stripeInvoice.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  if (isPlatformMvpBillingMetadata(subscription.metadata)) {
    return;
  }

  const companyId = getMetadataString(subscription.metadata, "companyId");

  if (!companyId) {
    return;
  }

  if (await shouldIgnoreMaintenancePlanSubscriptionInvoice(companyId, stripeSubscriptionId)) {
    return;
  }

  const platformFeePriceId = getMetadataString(subscription.metadata, "platformFeePriceId");

  if (!platformFeePriceId) {
    return;
  }

  if ((stripeInvoice.application_fee_amount ?? 0) > 0) {
    return;
  }

  const applicationFeeAmount = sumInvoiceLineAmountForPrice(stripeInvoice, platformFeePriceId);

  if (applicationFeeAmount <= 0) {
    logContext.warn(
      {
        eventId: event.id,
        eventType: event.type,
        companyId,
        stripeInvoiceId: stripeInvoice.id,
        platformFeePriceId
      },
      "Maintenance subscription invoice missing platform fee line item"
    );
    return;
  }

  await stripe.invoices.update(stripeInvoice.id, {
    application_fee_amount: applicationFeeAmount
  });
}

export async function handleInvoicePaymentSucceeded(
  event: Stripe.InvoicePaymentSucceededEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const stripeInvoice = event.data.object;

  if (!stripeInvoice.subscription) {
    return;
  }

  if (await handleVipInvoicePaymentSucceeded(event, logContext)) {
    return;
  }

  const companyId = extractStripeCompanyId(stripeInvoice.metadata, logContext, event.type);

  if (!companyId) {
    return;
  }

  const stripeSubscriptionId = String(stripeInvoice.subscription);

  if (isPlatformMvpBillingMetadata(stripeInvoice.metadata)) {
    return;
  }

  if (await shouldIgnoreMaintenancePlanSubscriptionInvoice(companyId, stripeSubscriptionId)) {
    return;
  }

  const plan = await getMaintenancePlanBySubscription(companyId, stripeSubscriptionId, db);

  if (!plan) {
    logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Maintenance plan not found for subscription invoice");
    return;
  }

  const renewalPaidDate = toIsoDateString(new Date());
  const paymentAmount = centsToCurrencyString(stripeInvoice.amount_paid);

  await db.transaction(async (tx: TransactionExecutor) => {
    const updatedPlans = await tx
      .update(maintenancePlans)
      .set({
        lastServiceDate: renewalPaidDate,
        updatedAt: new Date()
      })
      .where(and(eq(maintenancePlans.id, plan.id), eq(maintenancePlans.companyId, companyId), isNull(maintenancePlans.deletedAt)))
      .returning();
    const updatedPlan = updatedPlans[0];

    if (!updatedPlan) {
      return;
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "payment.received",
      actorType: "system",
      entityType: "maintenance_plan",
      entityId: updatedPlan.id,
      customerId: updatedPlan.customerId,
      payload: {
        amount: paymentAmount,
        stripeInvoiceId: stripeInvoice.id,
        stripeSubscriptionId
      },
      summary: `Renewal payment received for maintenance plan ${updatedPlan.name}`
    });
  });
}

export async function handleInvoicePaymentFailed(
  event: Stripe.InvoicePaymentFailedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const stripeInvoice = event.data.object;

  if (!stripeInvoice.subscription) {
    return;
  }

  if (await handleVipInvoicePaymentFailed(event, logContext)) {
    return;
  }

  const companyId = extractStripeCompanyId(stripeInvoice.metadata, logContext, event.type);

  if (!companyId) {
    return;
  }

  const stripeSubscriptionId = String(stripeInvoice.subscription);

  if (isPlatformMvpBillingMetadata(stripeInvoice.metadata)) {
    return;
  }

  if (await shouldIgnoreMaintenancePlanSubscriptionInvoice(companyId, stripeSubscriptionId)) {
    return;
  }

  const plan = await getMaintenancePlanBySubscription(companyId, stripeSubscriptionId, db);

  if (!plan) {
    logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Maintenance plan not found for failed subscription invoice");
    return;
  }

  const [company, customer] = await Promise.all([
    getCompanyRecord(companyId, db),
    getCustomerRecord(plan.customerId, companyId, db)
  ]);

  if (!company || !customer) {
    logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Missing company or customer context for failed subscription invoice");
    return;
  }

  await emitEventWithExecutor(db, {
    companyId,
    eventType: "payment.failed",
    actorType: "system",
    entityType: "maintenance_plan",
    entityId: plan.id,
    customerId: plan.customerId,
    payload: {
      amount: centsToCurrencyString(stripeInvoice.amount_due),
      stripeInvoiceId: stripeInvoice.id,
      stripeSubscriptionId
    },
    summary: `Renewal payment failed for maintenance plan ${plan.name}`
  });

  try {
    await notificationsQueue.add(
      "send-service-agreement-email",
      {
        companyId,
        maintenancePlanId: plan.id,
        emailType: "payment_failed",
        manageUrl: `${env.APP_URL.replace(/\/$/, "")}/settings/service-agreements`
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
  } catch (error: unknown) {
    logContext.error(
      {
        err: error,
        companyId,
        customerId: customer.id,
        maintenancePlanId: plan.id
      },
      "Failed to enqueue service agreement payment failure notification"
    );
  }
}

function buildUpdatedCompanySettings(
  company: CompanyRow,
  account: Stripe.Account
): Record<string, unknown> {
  const existingSettings =
    company.settings && typeof company.settings === "object" && !Array.isArray(company.settings)
      ? { ...(company.settings as Record<string, unknown>) }
      : {};

  return {
    ...existingSettings,
    stripeConnect: {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    }
  };
}

export async function handleAccountUpdated(
  event: Stripe.AccountUpdatedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const account = event.data.object;
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.stripeAccountId, account.id), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    logContext.warn({ eventId: event.id, eventType: event.type, stripeAccountId: account.id }, "Company not found for Stripe account update");
    return;
  }

  await db.transaction(async (tx: TransactionExecutor) => {
    const updatedCompanies = await tx
      .update(companies)
      .set({
        settings: buildUpdatedCompanySettings(company, account),
        updatedAt: new Date()
      })
      .where(and(eq(companies.id, company.id), isNull(companies.deletedAt)))
      .returning();
    const updatedCompany = updatedCompanies[0];

    if (!updatedCompany) {
      return;
    }

    await emitEventWithExecutor(tx, {
      companyId: updatedCompany.id,
      eventType: "company.updated",
      actorType: "system",
      entityType: "company",
      entityId: updatedCompany.id,
      payload: {
        stripeAccountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted
      },
      summary: `Stripe Connect account status updated for ${updatedCompany.name}`
    });
  });
}

export async function stripeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const event = request.stripeEvent;

  if (!event) {
    return reply.code(400).send({
      error: "INVALID_STRIPE_EVENT",
      message: "Stripe event was not verified"
    });
  }

  if (await isEventProcessed(event.id)) {
    return reply.code(200).send({
      received: true
    });
  }

  const claimed = await claimEventProcessing(event.id);

  if (!claimed) {
    return reply.code(200).send({
      received: true
    });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event, request.log);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event, request.log);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event, request.log);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event, request.log);
        break;
      case "invoice.created":
        await handleInvoiceCreated(event, request.log);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event, request.log);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event, request.log);
        break;
      case "account.updated":
        await handleAccountUpdated(event, request.log);
        break;
      default:
        if (isStripeDisputeEventType(event.type)) {
          await handleStripeDisputeEvent(event, request.log);
          break;
        }
        request.log.warn(
          {
            eventId: event.id,
            eventType: event.type
          },
          "Unhandled Stripe event type"
        );
        break;
    }

    await markEventProcessed(event.id, event.type);
  } catch (error: unknown) {
    request.log.error(
      {
        err: error,
        eventId: event.id,
        eventType: event.type
      },
      "Stripe webhook handler error"
    );
    await clearEventProcessingClaim(event.id);
  }

  return reply.code(200).send({
    received: true
  });
}
