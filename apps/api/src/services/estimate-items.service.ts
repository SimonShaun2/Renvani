import { and, asc, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { db, estimateItems, estimates } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type AddEstimateItemInput,
  type Estimate,
  type EstimateItem,
  type EstimateItemType,
  type UpdateEstimateItemInput
} from "@fsm/types";

type EstimateRow = typeof estimates.$inferSelect;
type EstimateItemRow = typeof estimateItems.$inferSelect;
type EstimateExecutor = Pick<typeof db, "select" | "insert" | "update">;

function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

function formatTaxRate(value: Decimal): string {
  return value.toFixed(4);
}

function formatQuantity(value: Decimal): string {
  return value.toFixed(3);
}

function toEstimateItem(row: EstimateItemRow): EstimateItem {
  return {
    ...row,
    itemType: row.itemType as EstimateItemType
  };
}

async function getEstimateRecord(
  companyId: string,
  estimateId: string,
  executor: Pick<typeof db, "select">
): Promise<EstimateRow> {
  const [estimate] = await executor
    .select()
    .from(estimates)
    .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
    .limit(1);

  if (!estimate) {
    throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
  }

  return estimate;
}

async function getEstimateItemRecord(
  companyId: string,
  estimateId: string,
  itemId: string,
  executor: Pick<typeof db, "select">
): Promise<EstimateItemRow> {
  const [item] = await executor
    .select()
    .from(estimateItems)
    .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.estimateId, estimateId), eq(estimateItems.id, itemId), isNull(estimateItems.deletedAt)))
    .limit(1);

  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Estimate item not found");
  }

  return item;
}

function assertDraftEstimate(estimate: Estimate | EstimateRow): void {
  if (estimate.status !== "draft") {
    throw new AppError(ErrorCode.CONFLICT, "Only draft estimates can be modified");
  }
}

function normalizeItemInput(input: AddEstimateItemInput | UpdateEstimateItemInput): {
  name?: string;
  description?: string | null;
  itemType?: EstimateItemType;
  quantity?: string;
  unitPrice?: string;
  total?: string;
  isTaxable?: boolean;
  sortOrder?: number;
} {
  const normalizedQuantity =
    input.quantity !== undefined ? formatQuantity(new Decimal(input.quantity)) : undefined;
  const normalizedUnitPrice =
    input.unitPrice !== undefined ? formatMoney(new Decimal(input.unitPrice)) : undefined;

  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
    ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
    ...(normalizedQuantity !== undefined ? { quantity: normalizedQuantity } : {}),
    ...(normalizedUnitPrice !== undefined ? { unitPrice: normalizedUnitPrice } : {}),
    ...(
      normalizedQuantity !== undefined && normalizedUnitPrice !== undefined
        ? {
            total: formatMoney(new Decimal(normalizedQuantity).mul(normalizedUnitPrice))
          }
        : {}
    ),
    ...(input.isTaxable !== undefined ? { isTaxable: input.isTaxable } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
  };
}

export async function listItems(companyId: string, estimateId: string): Promise<EstimateItem[]> {
  await getEstimateRecord(companyId, estimateId, db);
  const rows = await db
    .select()
    .from(estimateItems)
    .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.estimateId, estimateId), isNull(estimateItems.deletedAt)))
    .orderBy(asc(estimateItems.sortOrder));

  return rows.map((row) => toEstimateItem(row));
}

export async function addItem(
  companyId: string,
  estimateId: string,
  input: AddEstimateItemInput
): Promise<EstimateItem> {
  return db.transaction(async (tx) => {
    const estimate = await getEstimateRecord(companyId, estimateId, tx);
    assertDraftEstimate(estimate);

    const normalizedInput = normalizeItemInput(input);
    const insertedItems = await tx
      .insert(estimateItems)
      .values({
        companyId,
        estimateId,
        name: normalizedInput.name ?? input.name.trim(),
        description: normalizedInput.description ?? null,
        itemType: normalizedInput.itemType ?? "service",
        quantity: normalizedInput.quantity ?? formatQuantity(new Decimal(input.quantity)),
        unitPrice: normalizedInput.unitPrice ?? formatMoney(new Decimal(input.unitPrice)),
        total:
          normalizedInput.total ??
          formatMoney(new Decimal(input.quantity).mul(input.unitPrice)),
        isTaxable: normalizedInput.isTaxable ?? true,
        sortOrder: normalizedInput.sortOrder ?? 0
      })
      .returning();
    const item = insertedItems[0];

    if (!item) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create estimate item");
    }

    await recalculateTotals(estimateId, tx);

    return toEstimateItem(item);
  });
}

export async function updateItem(
  companyId: string,
  estimateId: string,
  itemId: string,
  input: UpdateEstimateItemInput
): Promise<EstimateItem> {
  return db.transaction(async (tx) => {
    const estimate = await getEstimateRecord(companyId, estimateId, tx);
    assertDraftEstimate(estimate);

    const existingItem = await getEstimateItemRecord(companyId, estimateId, itemId, tx);
    const normalizedInput = normalizeItemInput(input);
    const nextQuantity = normalizedInput.quantity ?? existingItem.quantity;
    const nextUnitPrice = normalizedInput.unitPrice ?? existingItem.unitPrice;
    const updatedItems = await tx
      .update(estimateItems)
      .set({
        ...(normalizedInput.name !== undefined ? { name: normalizedInput.name } : {}),
        ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
        ...(normalizedInput.itemType !== undefined ? { itemType: normalizedInput.itemType } : {}),
        ...(normalizedInput.quantity !== undefined ? { quantity: normalizedInput.quantity } : {}),
        ...(normalizedInput.unitPrice !== undefined ? { unitPrice: normalizedInput.unitPrice } : {}),
        total: formatMoney(new Decimal(nextQuantity).mul(nextUnitPrice)),
        ...(normalizedInput.isTaxable !== undefined ? { isTaxable: normalizedInput.isTaxable } : {}),
        ...(normalizedInput.sortOrder !== undefined ? { sortOrder: normalizedInput.sortOrder } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.id, itemId), isNull(estimateItems.deletedAt)))
      .returning();
    const item = updatedItems[0];

    if (!item) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate item not found");
    }

    await recalculateTotals(estimateId, tx);

    return toEstimateItem(item);
  });
}

export async function removeItem(
  companyId: string,
  estimateId: string,
  itemId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const estimate = await getEstimateRecord(companyId, estimateId, tx);
    assertDraftEstimate(estimate);
    await getEstimateItemRecord(companyId, estimateId, itemId, tx);

    await tx
      .update(estimateItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.id, itemId), isNull(estimateItems.deletedAt)))
      .returning();

    await recalculateTotals(estimateId, tx);
  });
}

export async function recalculateTotals(
  estimateId: string,
  tx: EstimateExecutor
): Promise<void> {
  const [estimate] = await tx
    .select()
    .from(estimates)
    .where(and(eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
    .limit(1);

  if (!estimate) {
    throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
  }

  const items = await tx
    .select()
    .from(estimateItems)
    .where(and(eq(estimateItems.estimateId, estimateId), isNull(estimateItems.deletedAt)));

  let subtotal = new Decimal(0);
  let taxableSubtotal = new Decimal(0);

  for (const item of items) {
    const lineTotal = new Decimal(item.total);
    subtotal = subtotal.add(lineTotal);

    if (item.isTaxable !== false) {
      taxableSubtotal = taxableSubtotal.add(lineTotal);
    }
  }

  const taxRate = new Decimal(estimate.taxRate ?? "0");
  const vipDiscount = await import("./vip-membership-discount.service.js").then((mod) =>
    mod.computeVipMembershipDiscountAmount(estimate.companyId, estimate.customerId, subtotal, tx)
  );
  const discountAmount = vipDiscount.greaterThan(0)
    ? vipDiscount
    : new Decimal(estimate.discountAmount ?? "0");
  const taxAmount = taxableSubtotal.mul(taxRate);
  const total = subtotal.add(taxAmount).sub(discountAmount);

  await tx
    .update(estimates)
    .set({
      subtotal: formatMoney(subtotal),
      taxRate: formatTaxRate(taxRate),
      taxAmount: formatMoney(taxAmount),
      discountAmount: formatMoney(discountAmount),
      total: formatMoney(total),
      updatedAt: new Date()
    })
    .where(eq(estimates.id, estimateId))
    .returning();
}
