import { and, eq, isNull } from "drizzle-orm";

import { companies, db, emitEventWithExecutor } from "@fsm/db";
import {
  resolvePlatformBillingPriceId,
  type RenvaniSubscriptionPlan
} from "@fsm/config/stripe-pricing";
import { featureFlags } from "@fsm/config/feature-flags";
import type { CompanySettings } from "@fsm/types";
import { AppError, ErrorCode, type StripePlatformBillingStatus } from "@fsm/types";

import {
  createPlatformBillingCheckoutSession,
  createStripePlatformCustomer
} from "../lib/stripe.js";

type CompanyRow = typeof companies.$inferSelect;

function isPlatformBillingConfigured(): boolean {
  // FEATURE FLAG: stripe-platform-billing-mvp
  if (!featureFlags.stripePlatformBillingMvp) {
    return false;
  }

  return (
    resolvePlatformBillingPriceId("flex") !== null || resolvePlatformBillingPriceId("flat") !== null
  );
}

function readPlatformBillingSettings(company: CompanyRow) {
  const settings = company.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  return (settings as CompanySettings).stripePlatformBilling ?? null;
}

function buildStatus(company: CompanyRow): StripePlatformBillingStatus {
  const billing = readPlatformBillingSettings(company);
  const subscribed =
    billing?.status === "active" ||
    billing?.status === "trialing" ||
    Boolean(billing?.subscriptionId);

  return {
    enabled: isPlatformBillingConfigured(),
    subscribed,
    status: billing?.status ?? null,
    stripeCustomerId: company.stripeCustomerId,
    stripeSubscriptionId: billing?.subscriptionId ?? null,
    currentPeriodEnd: billing?.currentPeriodEnd ?? null,
    planTier: billing?.planTier ?? null,
    checkoutAvailable: isPlatformBillingConfigured() && !subscribed
  };
}

async function getCompany(companyId: string): Promise<CompanyRow> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

async function ensureStripeCustomerId(company: CompanyRow): Promise<string> {
  if (company.stripeCustomerId) {
    return company.stripeCustomerId;
  }

  const created = await createStripePlatformCustomer({
    companyId: company.id,
    email: company.email,
    name: company.name
  });

  await db
    .update(companies)
    .set({
      stripeCustomerId: created.id,
      updatedAt: new Date()
    })
    .where(eq(companies.id, company.id));

  return created.id;
}

export async function getPlatformBillingStatus(companyId: string): Promise<StripePlatformBillingStatus> {
  const company = await getCompany(companyId);
  return buildStatus(company);
}

export async function createPlatformBillingCheckout(
  companyId: string,
  actorEmail: string | null,
  plan: RenvaniSubscriptionPlan
): Promise<{ url: string }> {
  if (!isPlatformBillingConfigured()) {
    throw new AppError(ErrorCode.FORBIDDEN, "Platform billing is not enabled");
  }

  const priceId = resolvePlatformBillingPriceId(plan);
  if (!priceId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Platform billing price is not configured for ${plan}`);
  }

  const company = await getCompany(companyId);
  const status = buildStatus(company);
  if (!status.checkoutAvailable) {
    throw new AppError(ErrorCode.CONFLICT, "Company already has an active platform subscription");
  }

  const stripeCustomerId = await ensureStripeCustomerId(company);
  const checkout = await createPlatformBillingCheckoutSession({
    companyId,
    stripeCustomerId,
    priceId,
    planTier: plan,
    customerEmail: actorEmail ?? company.email
  });

  await emitEventWithExecutor(db, {
    eventType: "company.updated",
    companyId,
    entityType: "company",
    entityId: companyId,
    summary: "Platform billing checkout session created",
    payload: {
      checkoutSessionId: checkout.sessionId,
      billingKind: "platform_mvp",
      planTier: plan
    }
  });

  return { url: checkout.url };
}
