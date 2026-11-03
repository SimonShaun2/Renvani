import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { resolveRenvaniPlanFromStripePriceId } from "@fsm/config/stripe-pricing";
import { companies, db, emitEventWithExecutor } from "@fsm/db";

interface CompanyStripePlatformBillingSettings {
  subscriptionId?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | null;
  planTier?: "flex" | "flat" | null;
}

interface CompanySettings {
  stripePlatformBilling?: CompanyStripePlatformBillingSettings | null;
}

type CompanyRow = typeof companies.$inferSelect;
type TransactionExecutor = Pick<typeof db, "insert" | "update">;

const PLATFORM_BILLING_KIND = "platform_mvp";

function getMetadataString(
  metadata: Record<string, string | undefined> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isPlatformMvpBillingMetadata(
  metadata: Record<string, string | undefined> | null | undefined
): boolean {
  return getMetadataString(metadata, "billingKind") === PLATFORM_BILLING_KIND;
}

function readExistingSettings(company: CompanyRow): CompanySettings {
  if (!company.settings || typeof company.settings !== "object" || Array.isArray(company.settings)) {
    return {};
  }

  return company.settings as CompanySettings;
}

function readSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const price = subscription.items?.data?.[0]?.price;
  if (!price) {
    return null;
  }

  return typeof price === "string" ? price : price.id;
}

function resolvePlanTierFromSubscription(subscription: Stripe.Subscription): "flex" | "flat" | null {
  const metadataPlan = getMetadataString(subscription.metadata, "planTier");
  if (metadataPlan === "flex" || metadataPlan === "flat") {
    return metadataPlan;
  }

  const priceId = readSubscriptionPriceId(subscription);
  return priceId ? resolveRenvaniPlanFromStripePriceId(priceId) : null;
}

function buildPlatformBillingSnapshot(subscription: Stripe.Subscription): CompanyStripePlatformBillingSettings {
  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    planTier: resolvePlanTierFromSubscription(subscription)
  };
}

function mergePlatformBillingIntoSettings(
  company: CompanyRow,
  snapshot: CompanyStripePlatformBillingSettings
): Record<string, unknown> {
  const existingSettings = readExistingSettings(company);

  return {
    ...existingSettings,
    stripePlatformBilling: {
      ...existingSettings.stripePlatformBilling,
      ...snapshot
    }
  };
}

async function getCompanyById(companyId: string): Promise<CompanyRow | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  return company ?? null;
}

export function isPlatformMvpSubscriptionForCompany(
  company: CompanyRow,
  stripeSubscriptionId: string
): boolean {
  const billing = readExistingSettings(company).stripePlatformBilling;
  return billing?.subscriptionId === stripeSubscriptionId;
}

export async function shouldIgnoreMaintenancePlanSubscriptionInvoice(
  companyId: string,
  stripeSubscriptionId: string
): Promise<boolean> {
  const company = await getCompanyById(companyId);

  if (!company) {
    return false;
  }

  return isPlatformMvpSubscriptionForCompany(company, stripeSubscriptionId);
}

function subscriptionSummary(
  subscription: Stripe.Subscription,
  eventType: string
): string {
  if (eventType === "customer.subscription.deleted" || subscription.status === "canceled") {
    return "Platform subscription cancelled";
  }

  if (eventType === "customer.subscription.created") {
    return "Platform subscription activated";
  }

  return "Platform subscription updated";
}

export async function handlePlatformSubscriptionUpsert(
  event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionCreatedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const subscription = event.data.object;

  if (!isPlatformMvpBillingMetadata(subscription.metadata)) {
    return;
  }

  const companyId = getMetadataString(subscription.metadata, "companyId");

  if (!companyId) {
    logContext.warn({ eventId: event.id, eventType: event.type }, "Platform billing subscription missing companyId metadata");
    return;
  }

  const company = await getCompanyById(companyId);

  if (!company) {
    logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Company not found for platform billing subscription");
    return;
  }

  const snapshot = buildPlatformBillingSnapshot(subscription);
  const stripeCustomerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  await db.transaction(async (tx: TransactionExecutor) => {
    const updatedCompanies = await tx
      .update(companies)
      .set({
        settings: mergePlatformBillingIntoSettings(company, snapshot),
        ...(stripeCustomerId && !company.stripeCustomerId ? { stripeCustomerId } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .returning();
    const updatedCompany = updatedCompanies[0];

    if (!updatedCompany) {
      return;
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "company.updated",
      actorType: "system",
      entityType: "company",
      entityId: companyId,
      payload: {
        billingKind: PLATFORM_BILLING_KIND,
        stripePlatformBilling: snapshot,
        stripeSubscriptionId: subscription.id
      },
      summary: subscriptionSummary(subscription, event.type)
    });
  });
}

export async function handlePlatformSubscriptionDeleted(
  event: Stripe.CustomerSubscriptionDeletedEvent,
  logContext: FastifyRequest["log"]
): Promise<void> {
  const subscription = event.data.object;

  if (!isPlatformMvpBillingMetadata(subscription.metadata)) {
    return;
  }

  const companyId = getMetadataString(subscription.metadata, "companyId");

  if (!companyId) {
    logContext.warn({ eventId: event.id, eventType: event.type }, "Platform billing subscription missing companyId metadata");
    return;
  }

  const company = await getCompanyById(companyId);

  if (!company) {
    logContext.warn({ eventId: event.id, eventType: event.type, companyId }, "Company not found for platform billing subscription");
    return;
  }

  const snapshot: CompanyStripePlatformBillingSettings = {
    subscriptionId: subscription.id,
    status: "canceled",
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null
  };

  await db.transaction(async (tx: TransactionExecutor) => {
    const updatedCompanies = await tx
      .update(companies)
      .set({
        settings: mergePlatformBillingIntoSettings(company, snapshot),
        updatedAt: new Date()
      })
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .returning();
    const updatedCompany = updatedCompanies[0];

    if (!updatedCompany) {
      return;
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "company.updated",
      actorType: "system",
      entityType: "company",
      entityId: companyId,
      payload: {
        billingKind: PLATFORM_BILLING_KIND,
        stripePlatformBilling: snapshot,
        stripeSubscriptionId: subscription.id
      },
      summary: subscriptionSummary(subscription, event.type)
    });
  });
}
