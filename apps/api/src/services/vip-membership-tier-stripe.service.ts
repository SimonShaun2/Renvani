import { eq } from "drizzle-orm";

import { db, vipMembershipTiers } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { createServiceAgreementPrice } from "../lib/stripe.js";

export async function ensureVipTierStripeMonthlyPrice(
  companyId: string,
  tierId: string,
  tierName: string,
  monthlyPrice: string
): Promise<string> {
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
    .where(eq(vipMembershipTiers.id, tierId));

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
  } catch {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to provision Stripe price for VIP tier");
  }
}
