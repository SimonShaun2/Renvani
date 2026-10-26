import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  buildVipMembershipJoinUrl,
  signVipMembershipJoinToken
} from "@fsm/config/vip-membership-portal-token";
import {
  computeCustomerPaidPlatformFee,
  formatCustomerPlatformFeeLineItemName
} from "@fsm/config/stripe-pricing";
import { env } from "@fsm/config";
import {
  companies,
  customers,
  db,
  emitEventWithExecutor,
  maintenancePlans,
  vipMembershipTiers
} from "@fsm/db";
import { AppError, ErrorCode, type ServiceAgreementStripeStatus } from "@fsm/types";

import { resolveCompanyConnectApplicationFeeFraction } from "../lib/company-renvani-plan.js";
import {
  cancelServiceAgreementSubscription,
  createServiceAgreementPrice,
  createStripeCustomer,
  createVipMembershipCheckoutSession,
  pauseServiceAgreementSubscription,
  retrieveServiceAgreementSubscriptionSnapshot,
  updateServiceAgreementSubscriptionCancelAtPeriodEnd
} from "../lib/stripe.js";
import { loadVipMembershipPolicy } from "./vip-membership-policy.service.js";
import { requireVipTierStripePrice } from "./vip-membership-tier-stripe.service.js";

type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type TierRow = typeof vipMembershipTiers.$inferSelect;
type PlanRow = typeof maintenancePlans.$inferSelect;

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
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

async function getCustomer(companyId: string, customerId: string): Promise<CustomerRow> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt))
    )
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  return customer;
}

async function getTier(companyId: string, tierId: string): Promise<TierRow> {
  const [tier] = await db
    .select()
    .from(vipMembershipTiers)
    .where(
      and(
        eq(vipMembershipTiers.companyId, companyId),
        eq(vipMembershipTiers.id, tierId),
        isNull(vipMembershipTiers.deletedAt),
        eq(vipMembershipTiers.isActive, true)
      )
    )
    .limit(1);

  if (!tier) {
    throw new AppError(ErrorCode.NOT_FOUND, "VIP tier not found");
  }

  return tier;
}

async function getVipPlan(companyId: string, planId: string): Promise<PlanRow> {
  const [plan] = await db
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.companyId, companyId),
        eq(maintenancePlans.id, planId),
        isNull(maintenancePlans.deletedAt)
      )
    )
    .limit(1);

  if (!plan || !plan.vipTierId) {
    throw new AppError(ErrorCode.NOT_FOUND, "VIP membership not found");
  }

  return plan;
}

const STRIPE_STATUS_VALUES: ServiceAgreementStripeStatus[] = [
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid"
];

function toStripeStatus(value: string | null | undefined): ServiceAgreementStripeStatus | null {
  if (!value) {
    return null;
  }

  return STRIPE_STATUS_VALUES.includes(value as ServiceAgreementStripeStatus)
    ? (value as ServiceAgreementStripeStatus)
    : null;
}

async function loadVipMembershipStripeStatus(plan: PlanRow): Promise<ServiceAgreementStripeStatus | null> {
  if (!plan.stripeSubscriptionId) {
    return null;
  }

  try {
    const snapshot = await retrieveServiceAgreementSubscriptionSnapshot(plan.stripeSubscriptionId, {
      companyId: plan.companyId,
      agreementId: plan.id
    });

    return toStripeStatus(snapshot.status);
  } catch {
    return null;
  }
}

export interface VipMembershipListItem {
  id: string;
  customerId: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  vipTierId: string | null;
  tierName: string;
  status: PlanRow["status"];
  monthlyPrice: string | null;
  discountPercent: string;
  stripeSubscriptionId: string | null;
  stripeStatus: ServiceAgreementStripeStatus | null;
  stripeCancelAtPeriodEnd: boolean;
  stripeCurrentPeriodEnd: string | null;
  startDate: string;
}

export async function listVipMemberships(companyId: string): Promise<VipMembershipListItem[]> {
  const rows = await db
    .select({
      plan: maintenancePlans,
      tier: vipMembershipTiers,
      customer: customers
    })
    .from(maintenancePlans)
    .innerJoin(vipMembershipTiers, eq(vipMembershipTiers.id, maintenancePlans.vipTierId))
    .innerJoin(
      customers,
      and(eq(customers.id, maintenancePlans.customerId), eq(customers.companyId, companyId))
    )
    .where(and(eq(maintenancePlans.companyId, companyId), isNull(maintenancePlans.deletedAt)))
    .orderBy(desc(maintenancePlans.createdAt));

  return Promise.all(
    rows.map(async ({ plan, tier, customer }) => {
      const stripeStatus = await loadVipMembershipStripeStatus(plan);

      return {
        id: plan.id,
        customerId: plan.customerId,
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName
        },
        vipTierId: plan.vipTierId,
        tierName: tier.name,
        status: plan.status,
        monthlyPrice: plan.price,
        discountPercent: tier.discountPercent,
        stripeSubscriptionId: plan.stripeSubscriptionId,
        stripeStatus,
        stripeCancelAtPeriodEnd: plan.stripeCancelAtPeriodEnd ?? false,
        stripeCurrentPeriodEnd: plan.stripeCurrentPeriodEnd
          ? plan.stripeCurrentPeriodEnd.toISOString()
          : null,
        startDate: plan.startDate
      };
    })
  );
}

export async function createVipMembershipJoinLink(
  companyId: string,
  customerId: string,
  vipTierId: string
): Promise<{ joinUrl: string; joinToken: string }> {
  await getTier(companyId, vipTierId);
  await getCustomer(companyId, customerId);

  const joinToken = signVipMembershipJoinToken(companyId, customerId, vipTierId);
  const joinUrl = buildVipMembershipJoinUrl(env.APP_URL, joinToken);

  return { joinUrl, joinToken };
}

export async function createVipMembershipCheckout(
  companyId: string,
  customerId: string,
  vipTierId: string
): Promise<{ checkoutUrl: string; sessionId: string; planId: string }> {
  const company = await getCompany(companyId);
  const customer = await getCustomer(companyId, customerId);
  const tier = await getTier(companyId, vipTierId);

  if (!company.stripeAccountId) {
    throw new AppError(ErrorCode.CONFLICT, "Stripe Connect not configured");
  }

  const stripeTierPriceId = await requireVipTierStripePrice(
    companyId,
    tier.id,
    tier.name,
    tier.monthlyPrice,
    tier.stripeMonthlyPriceId
  );

  let stripeCustomerId = customer.stripeCustomerId;
  if (!stripeCustomerId) {
    stripeCustomerId = (
      await createStripeCustomer({
        companyId,
        customerId: customer.id,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`.trim()
      })
    ).id;

    await db
      .update(customers)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customer.id)));
  }

  const connectApplicationFeeFraction = resolveCompanyConnectApplicationFeeFraction(company);
  let stripePlatformFeePriceId: string | null = null;

  if (connectApplicationFeeFraction > 0) {
    const feeBreakdown = computeCustomerPaidPlatformFee(tier.monthlyPrice, connectApplicationFeeFraction);
    stripePlatformFeePriceId = (
      await createServiceAgreementPrice({
        companyId,
        templateId: tier.id,
        name: tier.name,
        productName: formatCustomerPlatformFeeLineItemName(connectApplicationFeeFraction),
        amount: feeBreakdown.platformFeeAmount,
        interval: "month"
      })
    ).id;
  }

  const planId = randomUUID();
  const joinToken = signVipMembershipJoinToken(companyId, customerId, vipTierId);

  const session = await createVipMembershipCheckoutSession({
    companyId,
    companyName: company.name,
    companyStripeAccountId: company.stripeAccountId,
    customerId,
    customerEmail: customer.email,
    stripeCustomerId,
    vipTierId,
    tierName: tier.name,
    planId,
    stripeTierPriceId,
    stripePlatformFeePriceId,
    connectApplicationFeeFraction,
    joinToken
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.sessionId,
    planId
  };
}

export async function getPublicVipJoinPreview(joinToken: string): Promise<{
  companyName: string;
  tierName: string;
  monthlyPrice: string;
  platformFeeAmount: string | null;
  platformFeePercent: number | null;
  totalDueMonthly: string;
  discountPercent: string;
}> {
  const { verifyVipMembershipJoinToken } = await import("@fsm/config/vip-membership-portal-token");
  const parsed = verifyVipMembershipJoinToken(joinToken);

  if (!parsed) {
    throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
  }

  let company: Awaited<ReturnType<typeof getCompany>>;
  let tier: Awaited<ReturnType<typeof getTier>>;
  try {
    company = await getCompany(parsed.companyId);
    tier = await getTier(parsed.companyId, parsed.vipTierId);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) {
      throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
    }
    throw error;
  }

  const fraction = resolveCompanyConnectApplicationFeeFraction(company);
  const fee =
    fraction > 0 ? computeCustomerPaidPlatformFee(tier.monthlyPrice, fraction) : null;

  const totalDue = fee
    ? new Decimal(tier.monthlyPrice).add(fee.platformFeeAmount).toFixed(2)
    : tier.monthlyPrice;

  return {
    companyName: company.name,
    tierName: tier.name,
    monthlyPrice: tier.monthlyPrice,
    platformFeeAmount: fee?.platformFeeAmount ?? null,
    platformFeePercent: fee?.platformFeePercent ?? null,
    totalDueMonthly: totalDue,
    discountPercent: tier.discountPercent
  };
}

export async function startPublicVipCheckout(
  joinToken: string
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const { verifyVipMembershipJoinToken } = await import("@fsm/config/vip-membership-portal-token");
  const parsed = verifyVipMembershipJoinToken(joinToken);

  if (!parsed) {
    throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
  }

  const result = await createVipMembershipCheckout(
    parsed.companyId,
    parsed.customerId,
    parsed.vipTierId
  );

  return { checkoutUrl: result.checkoutUrl, sessionId: result.sessionId };
}

export async function pauseVipMembership(
  companyId: string,
  actorId: string,
  planId: string
): Promise<void> {
  const policy = await loadVipMembershipPolicy(companyId);

  const plan = await getVipPlan(companyId, planId);

  if (plan.status !== "active") {
    throw new AppError(ErrorCode.CONFLICT, "Only active memberships can be paused");
  }

  if (!plan.stripeSubscriptionId) {
    throw new AppError(ErrorCode.CONFLICT, "Membership has no Stripe subscription");
  }

  await pauseServiceAgreementSubscription(plan.stripeSubscriptionId);

  await db.transaction(async (tx) => {
    await tx
      .update(maintenancePlans)
      .set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.id, planId)));

    await emitEventWithExecutor(tx, {
      companyId,
      actorId,
      eventType: "maintenance_plan.updated",
      entityType: "maintenance_plan",
      entityId: planId,
      customerId: plan.customerId,
      payload: { status: "paused", maxPauseMonths: policy.maxPauseMonths },
      summary: `VIP membership paused (max ${policy.maxPauseMonths} months policy)`
    });
  });
}

export async function cancelVipMembership(
  companyId: string,
  actorId: string,
  planId: string,
  cancelImmediately = false
): Promise<void> {
  const plan = await getVipPlan(companyId, planId);

  if (!["active", "paused"].includes(plan.status)) {
    throw new AppError(ErrorCode.CONFLICT, "Membership cannot be cancelled");
  }

  if (plan.stripeSubscriptionId) {
    if (cancelImmediately) {
      await cancelServiceAgreementSubscription(plan.stripeSubscriptionId);
    } else {
      await updateServiceAgreementSubscriptionCancelAtPeriodEnd(plan.stripeSubscriptionId, true);
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(maintenancePlans)
      .set({
        ...(cancelImmediately
          ? { status: "cancelled", endDate: formatDateOnly(new Date()) }
          : { stripeCancelAtPeriodEnd: true }),
        updatedAt: new Date()
      })
      .where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.id, planId)));

    await emitEventWithExecutor(tx, {
      companyId,
      actorId,
      eventType: "maintenance_plan.cancelled",
      entityType: "maintenance_plan",
      entityId: planId,
      customerId: plan.customerId,
      payload: { cancelImmediately },
      summary: cancelImmediately ? "VIP membership cancelled" : "VIP membership cancellation scheduled"
    });
  });
}
