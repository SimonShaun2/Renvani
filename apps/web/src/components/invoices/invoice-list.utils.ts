import type { InvoiceListRecord } from "@/src/hooks/invoices.hooks";

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(["sent", "viewed", "partially_paid", "overdue"]);

export type InvoiceRowTone = "green" | "amber" | "red" | "neutral";

export interface InvoiceRowState {
  label: string;
  tone: InvoiceRowTone;
}

function money(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days past the due date (0 = due today, negative = not yet due). */
export function daysPastDue(dueAt: string, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(dueAt))) / DAY_MS);
}

export function isOpenInvoice(invoice: InvoiceListRecord): boolean {
  return OPEN_STATUSES.has(invoice.status) && money(invoice.balanceDue) > 0;
}

/** Row state pill from frame 10:752 (Paid / Due today / Overdue N d), derived from list fields only. */
export function getInvoiceRowState(invoice: InvoiceListRecord, now: Date): InvoiceRowState {
  if (invoice.status === "paid") return { label: "Paid", tone: "green" };
  if (invoice.status === "void") return { label: "Void", tone: "neutral" };
  if (invoice.status === "draft") return { label: "Draft", tone: "neutral" };
  if (isOpenInvoice(invoice) && invoice.dueAt) {
    const late = daysPastDue(invoice.dueAt, now);
    if (late > 0) return { label: `Overdue ${late} d`, tone: "red" };
    if (late === 0) return { label: "Due today", tone: "amber" };
  }
  if (invoice.status === "partially_paid") return { label: "Partially paid", tone: "amber" };
  if (invoice.status === "viewed") return { label: "Viewed", tone: "neutral" };
  return { label: "Sent", tone: "neutral" };
}

export interface InvoiceKpis {
  outstanding: { total: number; count: number };
  overdue7: { total: number; count: number };
}

/**
 * Outstanding and Overdue >7d. Callers must only render these when the list
 * response is complete (total <= rows loaded); otherwise they'd undercount.
 */
export function buildInvoiceKpis(records: InvoiceListRecord[], now: Date): InvoiceKpis {
  const open = records.filter(isOpenInvoice);
  const overdue7 = open.filter((invoice) => invoice.dueAt !== null && daysPastDue(invoice.dueAt, now) > 7);
  const sum = (rows: InvoiceListRecord[]) => rows.reduce((acc, row) => acc + money(row.balanceDue), 0);
  return {
    outstanding: { total: sum(open), count: open.length },
    overdue7: { total: sum(overdue7), count: overdue7.length }
  };
}

export function sumSucceededPayments(payments: Array<{ amount: string; status: string }>): number {
  return payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((acc, payment) => acc + money(payment.amount), 0);
}

export function isCompletePage(response: { data: unknown[]; total: number } | undefined): boolean {
  return response !== undefined && response.total <= response.data.length;
}
