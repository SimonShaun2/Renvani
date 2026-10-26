import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";

import { db, emitEventWithExecutor, maintenancePlans, vipMembershipTiers } from "@fsm/db";

type TransactionExecutor = Pick<typeof db, "insert" | "select">;

function getMetadataString(
  metadata: Record<string, string | undefined> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function provisionVipMembershipFromSubscription(
  subscription: Stripe.Subscription,
  companyId: string
): Promise<void> {
  const vipTierId = getMetadataString(subscription.metadata, "vipTierId");
  const customerId = getMetadataString(subscription.metadata, "customerId");
  const planId = getMetadataString(subscription.metadata, "planId");

  if (!vipTierId || !customerId || !planId) {
    return;
  }

  const [existing] = await db
    .select()
    .from(maintenancePlans)
    .where(
      and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.id, planId), isNull(maintenancePlans.deletedAt))
    )
    .limit(1);

  if (existing) {
    return;
  }

  const [tier] = await db
    .select()
    .from(vipMembershipTiers)
    .where(
      and(
        eq(vipMembershipTiers.companyId, companyId),
        eq(vipMembershipTiers.id, vipTierId),
        isNull(vipMembershipTiers.deletedAt)
      )
    )
    .limit(1);

  if (!tier) {
    return;
  }

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : new Date();
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const shopPriceId = subscription.items.data[0]?.price?.id ?? null;

  await db.transaction(async (tx: TransactionExecutor) => {
    await tx.insert(maintenancePlans).values({
      id: planId,
      companyId,
      customerId,
      vipTierId,
      name: `${tier.name} VIP`,
      description: tier.description,
      frequency: "monthly",
      status: "active",
      price: tier.monthlyPrice,
      billingCycle: "monthly",
      stripeSubscriptionId: subscription.id,
      stripePriceId: shopPriceId,
      stripeCurrentPeriodStart: periodStart,
      stripeCurrentPeriodEnd: periodEnd,
      stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
      startDate: formatDateOnly(periodStart),
      nextServiceDate: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "maintenance_plan.created",
      actorType: "customer",
      entityType: "maintenance_plan",
      entityId: planId,
      customerId,
      payload: {
        vipTierId,
        stripeSubscriptionId: subscription.id
      },
      summary: `VIP membership ${tier.name} activated`
    });
  });
}
