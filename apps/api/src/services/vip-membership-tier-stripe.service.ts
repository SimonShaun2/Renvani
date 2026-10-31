import { and, eq, isNull } from "drizzle-orm";

import { db, vipMembershipTiers } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { createServiceAgreementPrice } from "../lib/stripe.js";

export async function ensureVipTierStripeMonthlyPrice(
  companyId: string,
  tierId: string,
  tierName: string,
  monthlyPrice: string
): Promise<string> {
  // Tenant guard: the tier must belong to companyId before any Stripe side effect (no orphan prices).
  const [tier] = await db
    .select({ id: vipMembershipTiers.id })
    .from(vipMembershipTiers)
    .where(
      and(
        eq(vipMembershipTiers.id, tierId),
        eq(vipMembershipTiers.companyId, companyId),
        isNull(vipMembershipTiers.deletedAt)
      )
    )
    .limit(1);

  if (!tier) {
    throw new AppError(ErrorCode.NOT_FOUND, "VIP tier not found");
  }

  const price = await createServiceAgreementPrice({
    companyId,
    templateId: tierId,
    name: `${tierName} VIP membership`,
    amount: monthlyPrice,
    interval: "month",
    productName: `${tierName} — monthly VIP`
  });

  await db
    .update(vipMembershipTiers)
    .set({
      stripeMonthlyPriceId: price.id,
      updatedAt: new Date()
    })
    .where(and(eq(vipMembershipTiers.id, tierId), eq(vipMembershipTiers.companyId, companyId)));

  return price.id;
}

export async function requireVipTierStripePrice(
  companyId: string,
  tierId: string,
  tierName: string,
  monthlyPrice: string,
  existingPriceId: string | null
): Promise<string> {
  if (existingPriceId) {
    return existingPriceId;
  }

  try {
    return await ensureVipTierStripeMonthlyPrice(companyId, tierId, tierName, monthlyPrice);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to provision Stripe price for VIP tier");
  }
}
