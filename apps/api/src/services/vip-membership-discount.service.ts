import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { db, maintenancePlans, vipMembershipTiers } from "@fsm/db";

type DiscountExecutor = Pick<typeof db, "select">;

function formatMoney(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export async function resolveActiveVipTierDiscountPercent(
  companyId: string,
  customerId: string,
  executor: DiscountExecutor = db
): Promise<Decimal | null> {
  const plans = await executor
    .select({
      vipTierId: maintenancePlans.vipTierId
    })
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.companyId, companyId),
        eq(maintenancePlans.customerId, customerId),
        eq(maintenancePlans.status, "active"),
        isNull(maintenancePlans.deletedAt)
      )
    )
    .limit(5);

  const plan = plans.find((row) => row.vipTierId);
  if (!plan?.vipTierId) {
    return null;
  }

  const [tier] = await executor
    .select({
      discountPercent: vipMembershipTiers.discountPercent
    })
    .from(vipMembershipTiers)
    .where(
      and(
        eq(vipMembershipTiers.companyId, companyId),
        eq(vipMembershipTiers.id, plan.vipTierId),
        isNull(vipMembershipTiers.deletedAt)
      )
    )
    .limit(1);

  if (!tier) {
    return null;
  }

  const percent = new Decimal(tier.discountPercent);
  if (percent.isZero()) {
    return null;
  }

  return percent;
}

export async function computeVipMembershipDiscountAmount(
  companyId: string,
  customerId: string,
  subtotal: Decimal,
  executor: DiscountExecutor = db
): Promise<Decimal> {
  const percent = await resolveActiveVipTierDiscountPercent(companyId, customerId, executor);
  if (!percent) {
    return new Decimal(0);
  }

  const discount = subtotal.mul(percent).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return discount.greaterThan(subtotal) ? subtotal : discount;
}

export async function computeVipMembershipDiscountMoney(
  companyId: string,
  customerId: string,
  subtotal: Decimal,
  executor: DiscountExecutor = db
): Promise<string> {
  return formatMoney(await computeVipMembershipDiscountAmount(companyId, customerId, subtotal, executor));
}
