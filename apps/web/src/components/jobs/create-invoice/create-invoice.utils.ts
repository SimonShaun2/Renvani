import type { AddInvoiceItemInput, CreateInvoiceInput, InvoiceItemType, JobProduct, JobStatus } from "@fsm/types";

import {
  CREATE_INVOICE_HIDDEN_STATUSES,
  CREATE_INVOICE_PRIMARY_STATUSES,
  type CreateInvoiceButtonState
} from "./create-invoice.config";

export function resolveCreateInvoiceButtonState(input: {
  status: JobStatus;
  hasCustomer: boolean;
  chargesEnabled: boolean | null;
  existingInvoiceId: string | null;
}): CreateInvoiceButtonState {
  if (CREATE_INVOICE_HIDDEN_STATUSES.includes(input.status)) return "hidden";
  if (input.existingInvoiceId) return "view";
  if (!input.hasCustomer || input.chargesEnabled === false) return "disabled";
  return CREATE_INVOICE_PRIMARY_STATUSES.includes(input.status) ? "primary" : "secondary";
}

export interface DraftLine {
  key: string;
  name: string;
  quantity: string;
  unitPrice: string;
  include: boolean;
  isTaxable: boolean;
  itemType: InvoiceItemType;
  priceBookItemId?: string;
}

function toItemType(category: string): InvoiceItemType {
  return category === "service" || category === "labor" || category === "fee" ? category : "material";
}

export function linesFromJobProducts(products: JobProduct[]): DraftLine[] {
  return products.map((product) => ({
    key: product.id,
    name: product.name,
    quantity: String(Number.parseFloat(product.quantity) || 0),
    unitPrice: (Number.parseFloat(product.unitPrice) || 0).toFixed(2),
    include: true,
    isTaxable: product.isTaxable !== false,
    itemType: toItemType(product.category)
  }));
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (value: string) => Number.parseFloat(value);

export function lineTotal(line: DraftLine): number {
  const qty = num(line.quantity);
  const price = num(line.unitPrice);
  return Number.isFinite(qty) && Number.isFinite(price) ? round2(qty * price) : 0;
}

export interface InvoiceTotals {
  subtotal: number;
  /** null when the shop has no tax rate on record. */
  tax: number | null;
  discount: number;
  /** null on Flat or when the plan is unknown (no fee line). */
  serviceFee: number | null;
  total: number;
}

/** Service Fee is charged on the invoice total after tax (and discount). Flat plans have no fee. */
export function computeInvoiceTotals(input: {
  lines: DraftLine[];
  taxRate: number | null;
  discount: number;
  plan: "flex" | "flat" | null;
  feePercent: number | null;
}): InvoiceTotals {
  const included = input.lines.filter((line) => line.include);
  const subtotal = round2(included.reduce((sum, line) => sum + lineTotal(line), 0));
  const taxable = included.filter((line) => line.isTaxable).reduce((sum, line) => sum + lineTotal(line), 0);
  const tax = input.taxRate && input.taxRate > 0 ? round2(taxable * input.taxRate) : null;
  const discount = round2(Math.max(0, input.discount || 0));
  const afterTax = round2(Math.max(0, subtotal + (tax ?? 0) - discount));
  const serviceFee =
    input.plan === "flex" && input.feePercent && input.feePercent > 0 ? round2((afterTax * input.feePercent) / 100) : null;
  return { subtotal, tax, discount, serviceFee, total: round2(afterTax + (serviceFee ?? 0)) };
}

export interface CreateInvoiceErrors {
  lines: Record<string, string>;
  items?: string;
  dueAt?: string;
}

export function validateCreateInvoice(lines: DraftLine[], dueDate: string, today: string): CreateInvoiceErrors {
  const errors: CreateInvoiceErrors = { lines: {} };
  const included = lines.filter((line) => line.include);
  if (included.length === 0) errors.items = "Add at least one item";
  for (const line of included) {
    if (!line.name.trim() || !(num(line.quantity) > 0) || !(num(line.unitPrice) > 0)) {
      errors.lines[line.key] = "Quantity and price must be more than 0";
    }
  }
  if (dueDate && dueDate < today) errors.dueAt = "Due date can't be in the past";
  return errors;
}

export function hasCreateInvoiceErrors(errors: CreateInvoiceErrors): boolean {
  return Boolean(errors.items || errors.dueAt || Object.keys(errors.lines).length);
}

export function buildCreateInvoicePayload(input: {
  jobId: string;
  customerId: string;
  title: string;
  lines: DraftLine[];
  taxRate: number | null;
  discount: number;
  dueDate: string;
  messageToCustomer: string;
  internalNotes: string;
}): CreateInvoiceInput {
  const items: AddInvoiceItemInput[] = input.lines
    .filter((line) => line.include)
    .map((line, index) => ({
      name: line.name.trim(),
      itemType: line.itemType,
      quantity: num(line.quantity),
      unitPrice: num(line.unitPrice),
      isTaxable: line.isTaxable,
      sortOrder: index,
      ...(line.priceBookItemId ? { priceBookItemId: line.priceBookItemId } : {})
    }));
  return {
    customerId: input.customerId,
    fromJobId: input.jobId,
    title: input.title,
    items,
    ...(input.taxRate && input.taxRate > 0 ? { taxRate: input.taxRate } : {}),
    ...(input.discount > 0 ? { discountAmount: input.discount } : {}),
    ...(input.dueDate ? { dueAt: new Date(`${input.dueDate}T23:59:59`).toISOString() } : {}),
    ...(input.messageToCustomer.trim() ? { messageToCustomer: input.messageToCustomer.trim() } : {}),
    ...(input.internalNotes.trim() ? { internalNotes: input.internalNotes.trim() } : {})
  };
}

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
