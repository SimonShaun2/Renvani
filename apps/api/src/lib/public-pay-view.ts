import { and, desc, eq, isNull } from "drizzle-orm";

import { buildCardStatementDescriptor } from "@fsm/config/stripe-branding";
import {
  centsToMoneyString,
  computeCheckoutFees,
  formatServiceFeeLineItemName,
  moneyStringToCents,
  serviceFeeRateBpsForPlan
} from "@fsm/config/stripe-pricing";
import { companies, customers, db, invoiceItems, invoices, jobs, payments, properties } from "@fsm/db";
import { AppError, ErrorCode, type PublicPayFeeBreakdown, type PublicPayViewFields } from "@fsm/types";

import { readRenvaniSubscriptionPlan, type RenvaniSubscriptionPlan } from "./company-renvani-plan.js";
import { retrievePaymentIntentCardSummary, type PaymentCardSummary } from "./stripe.js";

type SelectExecutor = Pick<typeof db, "select">;
type InvoiceRow = typeof invoices.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type PropertyRow = typeof properties.$inferSelect;
type InvoiceItemRow = typeof invoiceItems.$inferSelect;

/** Max line items shown on a public pay page (bounds payload + query cost). */
export const PUBLIC_PAY_MAX_LINE_ITEMS = 100;

/** Everything a public pay view needs, loaded once per request with a fixed number of queries. */
export interface PublicPayContext {
  invoice: InvoiceRow;
  company: CompanyRow;
  customer: CustomerRow | null;
  job: JobRow | null;
  property: PropertyRow | null;
  items: InvoiceItemRow[];
  latestPayment: PaymentRow | null;
  plan: RenvaniSubscriptionPlan | null;
  isOnlineBooking: boolean;
}

async function first<T>(rows: Promise<T[]>): Promise<T | null> {
  const [row] = await rows;
  return row ?? null;
}

/**
 * Loads company, customer, job, line items and latest payment in one parallel round (5 queries),
 * plus at most one property lookup. No per-item queries.
 */
export async function loadPublicPayContext(
  invoice: InvoiceRow,
  executor: SelectExecutor = db
): Promise<PublicPayContext> {
  const { companyId } = invoice;
  const [company, customer, job, items, latestPayment] = await Promise.all([
    first(executor.select().from(companies)
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt))).limit(1)),
    first(executor.select().from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, invoice.customerId), isNull(customers.deletedAt)))
      .limit(1)),
    invoice.jobId
      ? first(executor.select().from(jobs)
          .where(and(eq(jobs.companyId, companyId), eq(jobs.id, invoice.jobId), isNull(jobs.deletedAt))).limit(1))
      : Promise.resolve(null),
    executor.select().from(invoiceItems)
      .where(and(eq(invoiceItems.companyId, companyId), eq(invoiceItems.invoiceId, invoice.id)))
      .orderBy(invoiceItems.sortOrder)
      .limit(PUBLIC_PAY_MAX_LINE_ITEMS),
    first(executor.select().from(payments)
      .where(and(eq(payments.companyId, companyId), eq(payments.invoiceId, invoice.id), isNull(payments.deletedAt)))
      .orderBy(desc(payments.createdAt))
      .limit(1))
  ]);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }
  if (invoice.jobId && !job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  const property = job?.propertyId
    ? await first(executor.select().from(properties)
        .where(and(eq(properties.companyId, companyId), eq(properties.id, job.propertyId), isNull(properties.deletedAt)))
        .limit(1))
    : null;

  return {
    invoice,
    company,
    customer,
    job,
    property,
    items,
    latestPayment,
    plan: readRenvaniSubscriptionPlan(company),
    isOnlineBooking: Array.isArray(job?.tags) && job.tags.includes("online_booking")
  };
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function money(value: string | number | null | undefined): string {
  return centsToMoneyString(moneyStringToCents(value));
}

function maskEmail(email: string | null | undefined): string | null {
  const at = email?.indexOf("@") ?? -1;
  if (!email || at < 1) {
    return null;
  }
  return `${email.charAt(0)}•••${email.slice(at)}`;
}

function formatAddress(property: PropertyRow | null): string | null {
  if (!property) {
    return null;
  }
  const street = [property.addressLine1, property.addressLine2].filter(Boolean).join(" ");
  const cityLine = [property.city, [property.state, property.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, cityLine].filter(Boolean).join(", ") || null;
}

function customerName(customer: CustomerRow | null): string | null {
  if (!customer) {
    return null;
  }
  return customer.displayName?.trim() || [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || null;
}

function paidCents(payment: PaymentRow): number {
  return moneyStringToCents(payment.amount)
    + moneyStringToCents(payment.serviceFeeAmount)
    + moneyStringToCents(payment.bookingFeeAmount);
}

function isSucceeded(payment: PaymentRow | null): payment is PaymentRow {
  return payment?.status === "succeeded";
}

/**
 * Service Fee vs booking fee split. A succeeded payment uses the fees stamped at checkout;
 * otherwise the split is previewed with computeCheckoutFees (Flat -> no Service Fee,
 * booking fee only when an online-booked invoice is paid in full at checkout).
 */
export function buildPublicPayFeeBreakdown(ctx: PublicPayContext): PublicPayFeeBreakdown {
  const rateBps = serviceFeeRateBpsForPlan(ctx.plan);
  const payment = ctx.latestPayment;
  let invoiceCents: number;
  let serviceFeeCents: number;
  let bookingFeeCents: number;

  if (isSucceeded(payment)) {
    invoiceCents = moneyStringToCents(payment.amount);
    serviceFeeCents = moneyStringToCents(payment.serviceFeeAmount);
    bookingFeeCents = moneyStringToCents(payment.bookingFeeAmount);
  } else {
    const fees = computeCheckoutFees({
      chargeCents: moneyStringToCents(ctx.invoice.balanceDue),
      isOnlineBooking: ctx.isOnlineBooking,
      paysInvoiceInFull: true,
      plan: ctx.plan
    });
    invoiceCents = fees.chargeCents;
    serviceFeeCents = fees.serviceFeeCents;
    bookingFeeCents = fees.bookingFeeCents;
  }

  return {
    invoiceAmount: centsToMoneyString(invoiceCents),
    serviceFeeLabel: serviceFeeCents > 0 ? formatServiceFeeLineItemName(rateBps) : null,
    serviceFeeAmount: centsToMoneyString(serviceFeeCents),
    serviceFeeRateBps: serviceFeeCents > 0 ? rateBps : 0,
    bookingFeeAmount: centsToMoneyString(bookingFeeCents),
    totalPaid: centsToMoneyString(invoiceCents + serviceFeeCents + bookingFeeCents),
    feeRefundable: false
  };
}

type Builder<K extends keyof PublicPayViewFields> = (ctx: PublicPayContext) => PublicPayViewFields[K];

/**
 * Extension point: one pure builder per field. Add a key to PublicPayViewFields and a builder
 * here; every builder reads only the preloaded context, so new fields add no queries.
 */
const FIELD_BUILDERS: { [K in Exclude<keyof PublicPayViewFields, "cardBrand" | "cardLast4" | "feeBreakdown">]: Builder<K> } = {
  shopName: (ctx) => ctx.company.name || null,
  shopLogoUrl: (ctx) => ctx.company.logoUrl ?? null,
  shopUrl: (ctx) => ctx.company.website ?? null,
  statementDescriptor: (ctx) => buildCardStatementDescriptor(ctx.company.name),
  customerName: (ctx) => customerName(ctx.customer),
  serviceAddress: (ctx) => formatAddress(ctx.property),
  serviceDate: (ctx) => iso(ctx.job?.actualEnd ?? ctx.job?.scheduledStart ?? null),
  dueAt: (ctx) => iso(ctx.invoice.dueAt),
  lineItems: (ctx) => ctx.items.map((item) => ({
    description: item.name || item.description || "",
    quantity: String(item.quantity),
    unit: money(item.unitPrice),
    total: money(item.total)
  })),
  invoiceStatus: (ctx) => ctx.invoice.status,
  paymentStatus: (ctx) => ctx.latestPayment?.status ?? null,
  paidAmount: (ctx) => (isSucceeded(ctx.latestPayment) ? centsToMoneyString(paidCents(ctx.latestPayment)) : null),
  paidAt: (ctx) => (isSucceeded(ctx.latestPayment) ? iso(ctx.latestPayment.paidAt ?? ctx.invoice.paidAt) : null),
  receiptEmail: (ctx) => maskEmail(ctx.customer?.email),
  plan: (ctx) => ctx.plan
};

/** Card brand/last4 only for a succeeded card payment; one Stripe read, fail-soft. */
async function loadCard(ctx: PublicPayContext): Promise<PaymentCardSummary | null> {
  const payment = ctx.latestPayment;
  if (!isSucceeded(payment) || payment.method !== "card" || !payment.stripePaymentIntentId) {
    return null;
  }
  try {
    return await retrievePaymentIntentCardSummary(payment.stripePaymentIntentId);
  } catch {
    return null;
  }
}

export interface BuildPublicPayViewOptions {
  /** Adds the Service Fee vs booking fee split (receipt). */
  includeFeeBreakdown?: boolean;
}

export async function buildPublicPayViewFields(
  ctx: PublicPayContext,
  options: BuildPublicPayViewOptions = {}
): Promise<PublicPayViewFields> {
  const base = Object.fromEntries(
    Object.entries(FIELD_BUILDERS).map(([key, build]) => [key, (build as Builder<keyof PublicPayViewFields>)(ctx)])
  ) as Omit<PublicPayViewFields, "cardBrand" | "cardLast4" | "feeBreakdown">;
  const card = await loadCard(ctx);

  return {
    ...base,
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    ...(options.includeFeeBreakdown ? { feeBreakdown: buildPublicPayFeeBreakdown(ctx) } : {})
  };
}
