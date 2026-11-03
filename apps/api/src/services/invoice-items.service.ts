import { and, asc, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { db, invoiceItems, invoices } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type AddInvoiceItemInput,
  type Invoice,
  type InvoiceItem,
  type InvoiceItemType,
  type UpdateInvoiceItemInput
} from "@fsm/types";

import { assertPriceBookItemsInCompany } from "./price-book-item-scope.js";

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceItemRow = typeof invoiceItems.$inferSelect;
type InvoiceExecutor = Pick<typeof db, "select" | "insert" | "update">;

function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

function formatTaxRate(value: Decimal): string {
  return value.toFixed(4);
}

function formatQuantity(value: Decimal): string {
  return value.toFixed(3);
}

function toInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    ...row,
    priceBookItemId: row.productCatalogId,
    itemType: row.itemType as InvoiceItemType
  };
}

function normalizePriceBookItemId(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getInvoiceRecord(
  companyId: string,
  invoiceId: string,
  executor: Pick<typeof db, "select">
): Promise<InvoiceRow> {
  const [invoice] = await executor
    .select()
    .from(invoices)
    .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  return invoice;
}

async function getInvoiceItemRecord(
  companyId: string,
  invoiceId: string,
  itemId: string,
  executor: Pick<typeof db, "select">
): Promise<InvoiceItemRow> {
  const [item] = await executor
    .select()
    .from(invoiceItems)
    .where(and(
      eq(invoiceItems.companyId, companyId),
      eq(invoiceItems.invoiceId, invoiceId),
      eq(invoiceItems.id, itemId),
      isNull(invoiceItems.deletedAt)
    ))
    .limit(1);

  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice item not found");
  }

  return item;
}

function assertDraftInvoice(invoice: Invoice | InvoiceRow): void {
  if (invoice.status !== "draft") {
    throw new AppError(ErrorCode.CONFLICT, "Only draft invoices can be modified");
  }
}

function normalizeItemInput(input: AddInvoiceItemInput | UpdateInvoiceItemInput): {
  name?: string;
  description?: string | null;
  itemType?: InvoiceItemType;
  quantity?: string;
  unitPrice?: string;
  total?: string;
  isTaxable?: boolean;
  sortOrder?: number;
  productCatalogId?: string | null;
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
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.priceBookItemId !== undefined
      ? { productCatalogId: normalizePriceBookItemId(input.priceBookItemId) ?? null }
      : {})
  };
}

export async function listItems(companyId: string, invoiceId: string): Promise<InvoiceItem[]> {
  await getInvoiceRecord(companyId, invoiceId, db);
  const rows = await db
    .select()
    .from(invoiceItems)
    .where(and(eq(invoiceItems.companyId, companyId), eq(invoiceItems.invoiceId, invoiceId), isNull(invoiceItems.deletedAt)))
    .orderBy(asc(invoiceItems.sortOrder));

  return rows.map((row) => toInvoiceItem(row));
}

export async function addItem(
  companyId: string,
  invoiceId: string,
  input: AddInvoiceItemInput
): Promise<InvoiceItem> {
  return db.transaction(async (tx) => {
    const invoice = await getInvoiceRecord(companyId, invoiceId, tx);
    assertDraftInvoice(invoice);

    const normalizedInput = normalizeItemInput(input);
    await assertPriceBookItemsInCompany(tx, companyId, [normalizedInput.productCatalogId]);
    const insertedItems = await tx
      .insert(invoiceItems)
      .values({
        companyId,
        invoiceId,
        name: normalizedInput.name ?? input.name.trim(),
        description: normalizedInput.description ?? null,
        itemType: normalizedInput.itemType ?? "service",
        quantity: normalizedInput.quantity ?? formatQuantity(new Decimal(input.quantity)),
        unitPrice: normalizedInput.unitPrice ?? formatMoney(new Decimal(input.unitPrice)),
        total:
          normalizedInput.total ??
          formatMoney(new Decimal(input.quantity).mul(input.unitPrice)),
        isTaxable: normalizedInput.isTaxable ?? true,
        sortOrder: normalizedInput.sortOrder ?? 0,
        ...(normalizedInput.productCatalogId !== undefined
          ? { productCatalogId: normalizedInput.productCatalogId }
          : {})
      })
      .returning();
    const item = insertedItems[0];

    if (!item) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create invoice item");
    }

    await recalculateTotals(invoiceId, tx);

    return toInvoiceItem(item);
  });
}

export async function updateItem(
  companyId: string,
  invoiceId: string,
  itemId: string,
  input: UpdateInvoiceItemInput
): Promise<InvoiceItem> {
  return db.transaction(async (tx) => {
    const invoice = await getInvoiceRecord(companyId, invoiceId, tx);
    assertDraftInvoice(invoice);

    const existingItem = await getInvoiceItemRecord(companyId, invoiceId, itemId, tx);
    const normalizedInput = normalizeItemInput(input);
    await assertPriceBookItemsInCompany(tx, companyId, [normalizedInput.productCatalogId]);
    const nextQuantity = normalizedInput.quantity ?? existingItem.quantity;
    const nextUnitPrice = normalizedInput.unitPrice ?? existingItem.unitPrice;
    const updatedItems = await tx
      .update(invoiceItems)
      .set({
        ...(normalizedInput.name !== undefined ? { name: normalizedInput.name } : {}),
        ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
        ...(normalizedInput.itemType !== undefined ? { itemType: normalizedInput.itemType } : {}),
        ...(normalizedInput.quantity !== undefined ? { quantity: normalizedInput.quantity } : {}),
        ...(normalizedInput.unitPrice !== undefined ? { unitPrice: normalizedInput.unitPrice } : {}),
        total: formatMoney(new Decimal(nextQuantity).mul(nextUnitPrice)),
        ...(normalizedInput.isTaxable !== undefined ? { isTaxable: normalizedInput.isTaxable } : {}),
        ...(normalizedInput.sortOrder !== undefined ? { sortOrder: normalizedInput.sortOrder } : {}),
        ...(normalizedInput.productCatalogId !== undefined
          ? { productCatalogId: normalizedInput.productCatalogId }
          : {}),
        updatedAt: new Date()
      })
      .where(and(eq(invoiceItems.companyId, companyId), eq(invoiceItems.id, itemId), isNull(invoiceItems.deletedAt)))
      .returning();
    const item = updatedItems[0];

    if (!item) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invoice item not found");
    }

    await recalculateTotals(invoiceId, tx);

    return toInvoiceItem(item);
  });
}

export async function removeItem(
  companyId: string,
  invoiceId: string,
  itemId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const invoice = await getInvoiceRecord(companyId, invoiceId, tx);
    assertDraftInvoice(invoice);
    await getInvoiceItemRecord(companyId, invoiceId, itemId, tx);

    await tx
      .update(invoiceItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(invoiceItems.companyId, companyId), eq(invoiceItems.id, itemId), isNull(invoiceItems.deletedAt)))
      .returning();

    await recalculateTotals(invoiceId, tx);
  });
}

export async function recalculateTotals(
  invoiceId: string,
  tx: InvoiceExecutor
): Promise<void> {
  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  const items = await tx
    .select()
    .from(invoiceItems)
    .where(and(eq(invoiceItems.invoiceId, invoiceId), isNull(invoiceItems.deletedAt)));

  let subtotal = new Decimal(0);
  let taxableSubtotal = new Decimal(0);

  for (const item of items) {
    const lineTotal = new Decimal(item.total);
    subtotal = subtotal.add(lineTotal);

    if (item.isTaxable !== false) {
      taxableSubtotal = taxableSubtotal.add(lineTotal);
    }
  }

  const taxRate = new Decimal(invoice.taxRate ?? "0");
  const vipDiscount = await import("./vip-membership-discount.service.js").then((mod) =>
    mod.computeVipMembershipDiscountAmount(invoice.companyId, invoice.customerId, subtotal, tx)
  );
  const discountAmount = vipDiscount.greaterThan(0)
    ? vipDiscount
    : new Decimal(invoice.discountAmount ?? "0");
  const amountPaid = new Decimal(invoice.amountPaid ?? "0");
  const taxAmount = taxableSubtotal.mul(taxRate);
  const total = subtotal.add(taxAmount).sub(discountAmount);
  const balanceDue = Decimal.max(total.sub(amountPaid), new Decimal(0));

  await tx
    .update(invoices)
    .set({
      subtotal: formatMoney(subtotal),
      taxRate: formatTaxRate(taxRate),
      taxAmount: formatMoney(taxAmount),
      discountAmount: formatMoney(discountAmount),
      total: formatMoney(total),
      balanceDue: formatMoney(balanceDue),
      updatedAt: new Date()
    })
    .where(eq(invoices.id, invoiceId))
    .returning();
}
