import { and, asc, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { db, emitEventWithExecutor, vipMembershipTiers } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type CreateVipMembershipTierInput,
  type UpdateVipMembershipTierInput,
  type VipMembershipTier
} from "@fsm/types";

type VipTierRow = typeof vipMembershipTiers.$inferSelect;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

function normalizePrice(value: string): string {
  return new Decimal(value.trim()).toFixed(2);
}

function normalizeDiscountPercent(value: string): string {
  const decimal = new Decimal(value.trim());
  if (decimal.isNegative() || decimal.greaterThan(100)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "discountPercent must be between 0 and 100");
  }
  return decimal.toFixed(2);
}

function toTier(row: VipTierRow): VipMembershipTier {
  return {
    ...row,
    monthlyPrice: row.monthlyPrice,
    discountPercent: row.discountPercent
  };
}

export async function listVipMembershipTiers(companyId: string): Promise<VipMembershipTier[]> {
  const rows = await db
    .select()
    .from(vipMembershipTiers)
    .where(and(eq(vipMembershipTiers.companyId, companyId), isNull(vipMembershipTiers.deletedAt)))
    .orderBy(asc(vipMembershipTiers.sortOrder), asc(vipMembershipTiers.name));

  return rows.map(toTier);
}

export async function createVipMembershipTier(
  companyId: string,
  actorId: string,
  input: CreateVipMembershipTierInput
): Promise<VipMembershipTier> {
  const now = new Date();
  const name = input.name.trim();
  const monthlyPrice = normalizePrice(input.monthlyPrice);
  const discountPercent = normalizeDiscountPercent(input.discountPercent);

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(vipMembershipTiers)
      .values({
        companyId,
        name,
        description: input.description?.trim() ?? null,
        monthlyPrice,
        discountPercent,
        includedVisitsPerMonth: input.includedVisitsPerMonth ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    const tier = inserted[0];
    if (!tier) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create VIP tier");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "vip.tier.created",
      actorId,
      entityType: "vip_membership_tier",
      entityId: tier.id,
      payload: { name: tier.name, monthlyPrice: tier.monthlyPrice },
      summary: `VIP tier ${tier.name} created`
    });

    return toTier(tier);
  });
}

async function getTierForCompany(
  companyId: string,
  tierId: string,
  executor: TransactionExecutor = db
): Promise<VipTierRow> {
  const [row] = await executor
    .select()
    .from(vipMembershipTiers)
    .where(
      and(
        eq(vipMembershipTiers.companyId, companyId),
        eq(vipMembershipTiers.id, tierId),
        isNull(vipMembershipTiers.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "VIP tier not found");
  }

  return row;
}

export async function updateVipMembershipTier(
  companyId: string,
  actorId: string,
  tierId: string,
  input: UpdateVipMembershipTierInput
): Promise<VipMembershipTier> {
  await getTierForCompany(companyId, tierId);
  const now = new Date();

  const updateValues = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
    ...(input.monthlyPrice !== undefined ? { monthlyPrice: normalizePrice(input.monthlyPrice) } : {}),
    ...(input.discountPercent !== undefined
      ? { discountPercent: normalizeDiscountPercent(input.discountPercent) }
      : {}),
    ...(input.includedVisitsPerMonth !== undefined
      ? { includedVisitsPerMonth: input.includedVisitsPerMonth }
      : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    updatedAt: now
  };

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(vipMembershipTiers)
      .set(updateValues)
      .where(and(eq(vipMembershipTiers.companyId, companyId), eq(vipMembershipTiers.id, tierId)))
      .returning();

    const tier = updated[0];
    if (!tier) {
      throw new AppError(ErrorCode.NOT_FOUND, "VIP tier not found");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "vip.tier.updated",
      actorId,
      entityType: "vip_membership_tier",
      entityId: tier.id,
      payload: updateValues,
      summary: `VIP tier ${tier.name} updated`
    });

    return toTier(tier);
  });
}

export async function deleteVipMembershipTier(
  companyId: string,
  actorId: string,
  tierId: string
): Promise<void> {
  const existing = await getTierForCompany(companyId, tierId);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(vipMembershipTiers)
      .set({ deletedAt: now, updatedAt: now, isActive: false })
      .where(and(eq(vipMembershipTiers.companyId, companyId), eq(vipMembershipTiers.id, tierId)));

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "vip.tier.deleted",
      actorId,
      entityType: "vip_membership_tier",
      entityId: tierId,
      payload: { name: existing.name },
      summary: `VIP tier ${existing.name} archived`
    });
  });
}
