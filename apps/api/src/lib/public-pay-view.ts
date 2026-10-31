import { and, desc, eq, isNull } from "drizzle-orm";

import { isReceiptEmailAllowed } from "@fsm/comms";
import { buildCardStatementDescriptor } from "@fsm/config/stripe-branding";
import {
  centsToMoneyString,
  computeCheckoutFees,
  formatServiceFeeLineItemName,
  moneyStringToCents,
  serviceFeeRateBpsForPlan
} from "@fsm/config/stripe-pricing";
import { companies, customers, db, invoiceItems, invoices, jobs, payments, properties } from "@fsm/db";
import { AppError, ErrorCode, type PublicPayReceiptFees, type PublicPayViewFields } from "@fsm/types";

import { readRenvaniSubscriptionPlan, type RenvaniSubscriptionPlan } from "./company-renvani-plan.js";

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
    plan: readRenvaniSubscriptionPlan(company)
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
  return property?.addressLine1?.trim() || null;
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
 * Receipt fee split. A succeeded payment uses the fees recorded at checkout (including a legacy
 * online-booking fee recorded before it was removed on 2026-10-27); otherwise computeCheckoutFees
 * previews the Service Fee only (Flat -> none). Label from SERVICE_FEE_RATE_BPS via plan.
 */
export function buildPublicPayReceiptFees(ctx: PublicPayContext): PublicPayReceiptFees {
  const payment = ctx.latestPayment;
  const fees = isSucceeded(payment)
    ? {
        serviceFeeCents: moneyStringToCents(payment.serviceFeeAmount),
        bookingFeeCents: moneyStringToCents(payment.bookingFeeAmount)
      }
    : {
        serviceFeeCents: computeCheckoutFees({ chargeCents: moneyStringToCents(ctx.invoice.balanceDue), plan: ctx.plan })
          .serviceFeeCents,
        bookingFeeCents: 0
      };

  return {
    serviceFeeLabel: fees.serviceFeeCents > 0 ? formatServiceFeeLineItemName(serviceFeeRateBpsForPlan(ctx.plan)) : null,
    serviceFeeAmount: centsToMoneyString(fees.serviceFeeCents),
    serviceFeeCents: fees.serviceFeeCents,
    bookingFeeAmount: centsToMoneyString(fees.bookingFeeCents),
    bookingFeeCents: fees.bookingFeeCents,
    feeRefundable: false
  };
}

/**
 * Extension point: one pure builder per field over the preloaded context (no extra queries).
 * Card brand/last4 are intentionally absent: payments has no stored card columns and a live
 * Stripe read on an unauthenticated GET is not worth the cost/abuse surface.
 */
const FIELD_BUILDERS: { [K in keyof PublicPayViewFields]: (ctx: PublicPayContext) => PublicPayViewFields[K] } = {
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
  paid: (ctx) => ctx.invoice.status === "paid",
  receiptEmailed: (ctx) => isSucceeded(ctx.latestPayment) && isReceiptEmailAllowed(ctx.customer),
  plan: (ctx) => ctx.plan
};

export function buildPublicPayViewFields(ctx: PublicPayContext): PublicPayViewFields {
  const out = {} as Record<keyof PublicPayViewFields, unknown>;
  for (const key of Object.keys(FIELD_BUILDERS) as Array<keyof PublicPayViewFields>) {
    out[key] = FIELD_BUILDERS[key](ctx);
  }
  return out as PublicPayViewFields;
}

/** Response-schema allowlist for the additive keys (kept next to the builders). */
export const PUBLIC_PAY_VIEW_FIELD_SCHEMA = {
  shopName: { type: ["string", "null"] },
  shopLogoUrl: { type: ["string", "null"] },
  shopUrl: { type: ["string", "null"] },
  statementDescriptor: { type: ["string", "null"] },
  customerName: { type: ["string", "null"] },
  serviceAddress: { type: ["string", "null"] },
  serviceDate: { type: ["string", "null"] },
  dueAt: { type: ["string", "null"] },
  lineItems: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: { type: "string" },
        quantity: { type: "string" },
        unit: { type: "string" },
        total: { type: "string" }
      }
    }
  },
  invoiceStatus: { type: "string" },
  paymentStatus: { type: ["string", "null"] },
  paidAmount: { type: ["string", "null"] },
  paidAt: { type: ["string", "null"] },
  receiptEmail: { type: ["string", "null"] },
  paid: { type: "boolean" },
  receiptEmailed: { type: "boolean" },
  plan: { type: ["string", "null"] }
} as const satisfies Record<keyof PublicPayViewFields, unknown>;
