import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import pino from "pino";
import type Stripe from "stripe";

import { env } from "@fsm/config";
import {
  centsToMoneyString,
  computeCheckoutFees,
  computeRefundableCents,
  customerPlatformFeeDisclosure,
  moneyStringToCents
} from "@fsm/config/stripe-pricing";
import {
  activityEvents,
  automationRules,
  companies,
  customers,
  db,
  emitEventWithExecutor,
  estimateItems,
  estimates,
  invoices,
  invoiceItems,
  jobs,
  markInvoiceOverdueIfNeeded,
  payments,
  users
} from "@fsm/db";
import { isReceiptEmailAllowed } from "@fsm/comms";
import { aiQueue, invoicesQueue, notificationsQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  type CreateInvoiceInput,
  type Invoice,
  type InvoiceDetail,
  type InvoiceItem,
  type InvoiceItemType,
  type InvoiceListItem,
  type InvoicePaymentSummary,
  type InvoiceStatus,
  type ListInvoicesQuery,
  type PaginatedResult,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type PublicInvoicePaymentLink,
  type PublicInvoicePaymentLinkView,
  type RecordPaymentInput,
  type UpdateInvoiceInput
} from "@fsm/types";

import { readRenvaniSubscriptionPlan } from "../lib/company-renvani-plan.js";
import { dispatchEventAutomation } from "./automation/event-automation.registry.js";
import { generateInvoiceNumber } from "../lib/invoice-number.js";
import {
  buildPublicPayViewFields,
  loadPublicPayContext,
  type PublicPayContext
} from "../lib/public-pay-view.js";
import { featureFlags } from "@fsm/config/feature-flags";
import {
  createInvoiceCheckoutSession,
  expireInvoiceCheckoutSession,
  retrieveInvoiceCheckoutClientSecret
} from "../lib/stripe.js";
import { listItems, recalculateTotals } from "./invoice-items.service.js";
import { assertPriceBookItemsInCompany, findLivePriceBookItemIds } from "./price-book-item-scope.js";

type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type EstimateRow = typeof estimates.$inferSelect;
type EstimateItemRow = typeof estimateItems.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceItemRow = typeof invoiceItems.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type UserRow = typeof users.$inferSelect;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type SelectExecutor = Pick<typeof db, "select">;
type AutomationRuleType = (typeof automationRules.$inferSelect)["ruleType"];

const logger = pino({
  name: "invoice-service"
});

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_RESULT_WINDOW = 10_000;
const OVERDUE_CHECK_DELAY_BUFFER_MS = 60 * 60 * 1000;

function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

function formatTaxRate(value: Decimal): string {
  return value.toFixed(4);
}

function formatQuantity(value: Decimal): string {
  return value.toFixed(3);
}

function parseIsoDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeInvoiceStatus(status: InvoiceRow["status"]): InvoiceStatus {
  return status as InvoiceStatus;
}

function normalizeInvoiceItemType(itemType: InvoiceItemRow["itemType"]): InvoiceItemType {
  return itemType as InvoiceItemType;
}

function normalizePaymentMethod(method: PaymentRow["method"]): PaymentMethod {
  return method as PaymentMethod;
}

function normalizePaymentStatus(status: PaymentRow["status"]): PaymentStatus {
  return status as PaymentStatus;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    ...row,
    status: normalizeInvoiceStatus(row.status)
  };
}

function toInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    ...row,
    priceBookItemId: row.productCatalogId,
    itemType: normalizeInvoiceItemType(row.itemType)
  };
}

function paymentFeeFields(row: PaymentRow): Pick<
  Payment,
  "serviceFeeAmount" | "bookingFeeAmount" | "feeRefundable" | "amountRefunded" | "refundableAmount"
> {
  const amountRefunded = row.amountRefunded ?? "0.00";
  return {
    serviceFeeAmount: row.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: row.bookingFeeAmount ?? "0.00",
    // Fees are non-refundable by policy regardless of stored value.
    feeRefundable: false,
    amountRefunded,
    refundableAmount: centsToMoneyString(
      computeRefundableCents({
        amountCents: moneyStringToCents(row.amount),
        amountRefundedCents: moneyStringToCents(amountRefunded)
      })
    )
  };
}

function toPayment(row: PaymentRow): Payment {
  return {
    ...row,
    ...paymentFeeFields(row),
    method: normalizePaymentMethod(row.method),
    status: normalizePaymentStatus(row.status)
  };
}

function toInvoicePaymentSummary(row: PaymentRow): InvoicePaymentSummary {
  return {
    id: row.id,
    amount: row.amount,
    method: normalizePaymentMethod(row.method),
    status: normalizePaymentStatus(row.status),
    paidAt: row.paidAt,
    stripePaymentIntentId: row.stripePaymentIntentId,
    serviceFeeAmount: row.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: row.bookingFeeAmount ?? "0.00",
    feeRefundable: false
  };
}

function toInvoiceListItem(row: InvoiceRow, customer: CustomerRow): InvoiceListItem {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    title: row.title,
    status: normalizeInvoiceStatus(row.status),
    total: row.total,
    amountPaid: row.amountPaid ?? "0.00",
    balanceDue: row.balanceDue,
    serviceFeeAmount: row.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: row.bookingFeeAmount ?? "0.00",
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName
    },
    createdAt: row.createdAt
  };
}

function toInvoiceDetail(
  row: InvoiceRow,
  customer: CustomerRow,
  job: JobRow | null,
  items: InvoiceItem[],
  paymentRows: PaymentRow[]
): InvoiceDetail {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    title: row.title,
    status: normalizeInvoiceStatus(row.status),
    subtotal: row.subtotal,
    taxRate: row.taxRate,
    taxAmount: row.taxAmount,
    discountAmount: row.discountAmount,
    total: row.total,
    amountPaid: row.amountPaid ?? "0.00",
    balanceDue: row.balanceDue,
    serviceFeeAmount: row.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: row.bookingFeeAmount ?? "0.00",
    issuedAt: row.issuedAt,
    sentAt: row.sentAt,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    stripePaymentLinkUrl: row.stripePaymentLinkUrl,
    paymentToken: row.paymentToken,
    messageToCustomer: row.messageToCustomer,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email
    },
    job: job
      ? {
          id: job.id,
          jobNumber: job.jobNumber,
          title: job.title
        }
      : null,
    items,
    payments: paymentRows.map((payment) => toInvoicePaymentSummary(payment)),
    createdAt: row.createdAt
  };
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function buildInvoiceSummary(invoiceNumber: string, eventLabel: string): string {
  return `Invoice ${invoiceNumber} ${eventLabel}`;
}

function generatePaymentToken(): string {
  return randomBytes(24).toString("base64url");
}

function compareNullableDates(left: Date | null, right: Date | null, sortOrder: "asc" | "desc"): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return sortOrder === "asc"
    ? left.getTime() - right.getTime()
    : right.getTime() - left.getTime();
}

function addMoneyStrings(leftValue: string | null, rightValue: string | null): string {
  return formatMoney(new Decimal(leftValue ?? "0").add(rightValue ?? "0"));
}

function applyPaymentToInvoice(invoice: InvoiceRow, paymentAmount: Decimal): {
  amountPaid: string;
  balanceDue: string;
  status: InvoiceStatus;
  paidAt: Date | null;
} {
  const nextAmountPaid = new Decimal(invoice.amountPaid ?? "0").add(paymentAmount);
  const total = new Decimal(invoice.total);
  const nextBalanceDue = Decimal.max(total.sub(nextAmountPaid), new Decimal(0));

  if (nextBalanceDue.lte(0)) {
    return {
      amountPaid: formatMoney(nextAmountPaid),
      balanceDue: formatMoney(nextBalanceDue),
      status: "paid",
      paidAt: new Date()
    };
  }

  if (nextAmountPaid.gt(0)) {
    return {
      amountPaid: formatMoney(nextAmountPaid),
      balanceDue: formatMoney(nextBalanceDue),
      status: "partially_paid",
      paidAt: null
    };
  }

  return {
    amountPaid: formatMoney(nextAmountPaid),
    balanceDue: formatMoney(nextBalanceDue),
    status: normalizeInvoiceStatus(invoice.status),
    paidAt: null
  };
}

function resolveStripePaymentMethod(paymentIntent: Stripe.PaymentIntent): PaymentMethod {
  // Guard: some events/fixtures omit payment_method_types; never crash payment recording on it.
  const paymentMethodType = paymentIntent.payment_method_types?.[0];

  switch (paymentMethodType) {
    case "card":
      return "card";
    case "us_bank_account":
      return "ach";
    default:
      return "other";
  }
}

async function getUserRecord(
  companyId: string,
  userId: string,
  executor: SelectExecutor
): Promise<UserRow> {
  const [user] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  }

  return user;
}

async function getCompanyRecord(
  companyId: string,
  executor: SelectExecutor
): Promise<CompanyRow> {
  const [company] = await executor
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

async function getCustomerRecord(
  companyId: string,
  customerId: string,
  executor: SelectExecutor
): Promise<CustomerRow> {
  const [customer] = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  return customer;
}

async function getJobRecord(
  companyId: string,
  jobId: string,
  executor: SelectExecutor
): Promise<JobRow> {
  const [job] = await executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  return job;
}

async function getEstimateRecord(
  companyId: string,
  estimateId: string,
  executor: SelectExecutor
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

async function getInvoiceRecord(
  companyId: string,
  invoiceId: string,
  executor: SelectExecutor
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

async function getInvoiceById(invoiceId: string, executor: SelectExecutor): Promise<InvoiceRow> {
  const [invoice] = await executor
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  return invoice;
}

async function getInvoiceByPaymentToken(token: string, executor: SelectExecutor): Promise<InvoiceRow> {
  const [invoice] = await executor
    .select()
    .from(invoices)
    .where(and(eq(invoices.paymentToken, token), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  return invoice;
}

async function getPaymentByIntentId(
  stripePaymentIntentId: string,
  executor: SelectExecutor
): Promise<PaymentRow | null> {
  const [payment] = await executor
    .select()
    .from(payments)
    .where(and(eq(payments.stripePaymentIntentId, stripePaymentIntentId), isNull(payments.deletedAt)))
    .limit(1);

  return payment ?? null;
}

async function getInvoiceItems(
  companyId: string,
  invoiceId: string,
  executor: SelectExecutor
): Promise<InvoiceItem[]> {
  const rows = await executor
    .select()
    .from(invoiceItems)
    .where(and(eq(invoiceItems.companyId, companyId), eq(invoiceItems.invoiceId, invoiceId), isNull(invoiceItems.deletedAt)));

  return rows
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((row) => toInvoiceItem(row));
}

async function getInvoicePaymentRows(
  companyId: string,
  invoiceId: string,
  executor: SelectExecutor
): Promise<PaymentRow[]> {
  const rows = await executor
    .select()
    .from(payments)
    .where(and(eq(payments.companyId, companyId), eq(payments.invoiceId, invoiceId), isNull(payments.deletedAt)));

  return rows.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

async function getEstimateItemRows(
  companyId: string,
  estimateId: string,
  executor: SelectExecutor
): Promise<EstimateItemRow[]> {
  const rows = await executor
    .select()
    .from(estimateItems)
    .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.estimateId, estimateId), isNull(estimateItems.deletedAt)));

  return rows.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

async function findAutomationRule(
  companyId: string,
  ruleType: AutomationRuleType
): Promise<(typeof automationRules.$inferSelect) | null> {
  return (
    await db.query.automationRules.findFirst({
      where: (table, operators) =>
        operators.and(
          operators.eq(table.companyId, companyId),
          operators.eq(table.ruleType, ruleType),
          operators.eq(table.isEnabled, true),
          operators.isNull(table.deletedAt)
        )
    })
  ) ?? null;
}

function assertInvoiceIsDraft(invoice: InvoiceRow): void {
  if (invoice.status !== "draft") {
    throw new AppError(ErrorCode.CONFLICT, "Only draft invoices can be modified");
  }
}

function assertJobBelongsToCustomer(job: JobRow, customerId: string): void {
  if (job.customerId !== customerId) {
    throw new AppError(ErrorCode.CONFLICT, "Job does not belong to customer");
  }
}

function assertEstimateBelongsToCustomer(estimate: EstimateRow, customerId: string): void {
  if (estimate.customerId !== customerId) {
    throw new AppError(ErrorCode.CONFLICT, "Estimate does not belong to customer");
  }
}

function normalizeCreateInvoiceInput(input: CreateInvoiceInput) {
  return {
    customerId: input.customerId,
    jobId: input.fromJobId ?? input.jobId,
    estimateId: input.fromEstimateId ?? input.estimateId,
    title: normalizeOptionalString(input.title) ?? null,
    messageToCustomer: normalizeOptionalString(input.messageToCustomer) ?? null,
    internalNotes: normalizeOptionalString(input.internalNotes) ?? null,
    taxRate: formatTaxRate(new Decimal(input.taxRate ?? 0)),
    discountAmount: formatMoney(new Decimal(input.discountAmount ?? 0)),
    dueAt: parseIsoDateTime(input.dueAt),
    items: input.items ?? []
  };
}

function normalizeUpdateInvoiceInput(input: UpdateInvoiceInput) {
  return {
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
    ...(input.estimateId !== undefined ? { estimateId: input.estimateId } : {}),
    ...(input.title !== undefined ? { title: normalizeOptionalString(input.title) ?? null } : {}),
    ...(
      input.messageToCustomer !== undefined
        ? { messageToCustomer: normalizeOptionalString(input.messageToCustomer) ?? null }
        : {}
    ),
    ...(input.internalNotes !== undefined ? { internalNotes: normalizeOptionalString(input.internalNotes) ?? null } : {}),
    ...(input.taxRate !== undefined ? { taxRate: formatTaxRate(new Decimal(input.taxRate)) } : {}),
    ...(input.discountAmount !== undefined ? { discountAmount: formatMoney(new Decimal(input.discountAmount)) } : {}),
    ...(input.dueAt !== undefined ? { dueAt: parseIsoDateTime(input.dueAt) } : {})
  };
}

function normalizeRecordPaymentInput(input: RecordPaymentInput) {
  return {
    amount: formatMoney(new Decimal(input.amount)),
    method: input.method,
    checkNumber: normalizeOptionalString(input.checkNumber) ?? null,
    referenceNumber: normalizeOptionalString(input.referenceNumber) ?? null,
    notes: normalizeOptionalString(input.notes) ?? null,
    paidAt: parseIsoDateTime(input.paidAt) ?? new Date()
  };
}

async function buildInvoiceDetail(companyId: string, invoice: InvoiceRow, executor: SelectExecutor): Promise<InvoiceDetail> {
  const [customer, job, items, paymentRows] = await Promise.all([
    getCustomerRecord(companyId, invoice.customerId, executor),
    invoice.jobId ? getJobRecord(companyId, invoice.jobId, executor) : Promise.resolve(null),
    getInvoiceItems(companyId, invoice.id, executor),
    getInvoicePaymentRows(companyId, invoice.id, executor)
  ]);

  return toInvoiceDetail(invoice, customer, job, items, paymentRows);
}

async function emitInvoiceEvent(
  executor: TransactionExecutor,
  input: {
    invoice: InvoiceRow;
    eventType: typeof activityEvents.$inferInsert.eventType;
    actorId?: string | null;
    actorType?: string | null;
    actorName?: string | null;
    summary: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await emitEventWithExecutor(executor, {
    companyId: input.invoice.companyId,
    eventType: input.eventType,
    entityType: "invoice",
    entityId: input.invoice.id,
    customerId: input.invoice.customerId,
    invoiceId: input.invoice.id,
    payload: input.payload ?? {},
    summary: input.summary,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorType ? { actorType: input.actorType } : {}),
    ...(input.actorName ? { actorName: input.actorName } : {}),
    ...(input.invoice.jobId ? { jobId: input.invoice.jobId } : {}),
    ...(input.invoice.estimateId ? { estimateId: input.invoice.estimateId } : {})
  });
}

export async function listInvoices(
  companyId: string,
  query: ListInvoicesQuery
): Promise<PaginatedResult<InvoiceListItem>> {
  const dueBefore = parseIsoDateTime(query.dueBefore);
  const dueAfter = parseIsoDateTime(query.dueAfter);
  const createdAfter = parseIsoDateTime(query.createdAfter);
  const createdBefore = parseIsoDateTime(query.createdBefore);
  const page = query.page ?? DEFAULT_LIST_PAGE;
  const limit = Math.min(query.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";
  const search = normalizeOptionalString(query.search)?.toLowerCase();
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
    .limit(MAX_RESULT_WINDOW);

  const filteredRows = rows.filter((row) => {
    if (query.status && row.status !== query.status) {
      return false;
    }

    if (query.customerId && row.customerId !== query.customerId) {
      return false;
    }

    if (query.jobId && row.jobId !== query.jobId) {
      return false;
    }

    if (search && !row.invoiceNumber.toLowerCase().includes(search)) {
      return false;
    }

    if (dueAfter) {
      if (!row.dueAt || row.dueAt.getTime() < dueAfter.getTime()) {
        return false;
      }
    }

    if (dueBefore) {
      if (!row.dueAt || row.dueAt.getTime() > dueBefore.getTime()) {
        return false;
      }
    }

    if (createdAfter && row.createdAt.getTime() < createdAfter.getTime()) {
      return false;
    }

    if (createdBefore && row.createdAt.getTime() > createdBefore.getTime()) {
      return false;
    }

    return true;
  });

  const sortedRows = [...filteredRows].sort((left, right) => {
    if (sortBy === "total") {
      const comparison = new Decimal(left.total).cmp(right.total);
      return sortOrder === "asc" ? comparison : comparison * -1;
    }

    if (sortBy === "status") {
      const comparison = left.status.localeCompare(right.status);
      return sortOrder === "asc" ? comparison : comparison * -1;
    }

    if (sortBy === "dueAt") {
      return compareNullableDates(left.dueAt, right.dueAt, sortOrder);
    }

    const comparison = left.createdAt.getTime() - right.createdAt.getTime();
    return sortOrder === "asc" ? comparison : comparison * -1;
  });

  const customerIds = [...new Set(sortedRows.map((row) => row.customerId))];
  const companyCustomers = customerIds.length === 0
    ? []
    : await db
        .select()
        .from(customers)
        .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
        .limit(MAX_RESULT_WINDOW);
  const customerMap = new Map(companyCustomers.map((row) => [row.id, row]));
  const total = sortedRows.length;
  const offset = (page - 1) * limit;
  const data = sortedRows.slice(offset, offset + limit).flatMap((row) => {
    const customer = customerMap.get(row.customerId);

    if (!customer) {
      return [];
    }

    return [toInvoiceListItem(row, customer)];
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getInvoice(companyId: string, invoiceId: string): Promise<InvoiceDetail> {
  const invoice = await getInvoiceRecord(companyId, invoiceId, db);
  return buildInvoiceDetail(companyId, invoice, db);
}

function buildPublicPaymentPageUrl(paymentToken: string): string {
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  return `${appBaseUrl}/pay/${paymentToken}`;
}

export async function getPublicInvoicePaymentLink(token: string): Promise<PublicInvoicePaymentLinkView> {
  const { link, context } = await loadPublicInvoicePayment(token);
  return { ...link, ...buildPublicPayViewFields(context) };
}

/** Public pay link (legacy keys) plus the preloaded context used to build `fields`. */
export async function loadPublicInvoicePayment(
  token: string
): Promise<{ link: PublicInvoicePaymentLink; context: PublicPayContext }> {
  const invoice = await getInvoiceByPaymentToken(token, db);

  if (!invoice.stripePaymentLinkId && !invoice.stripePaymentLinkUrl) {
    throw new AppError(ErrorCode.CONFLICT, "Invoice payment link is unavailable");
  }

  const context = await loadPublicPayContext(invoice, db);
  const fees = computeCheckoutFees({ chargeCents: moneyStringToCents(invoice.balanceDue), plan: context.plan });
  const totalFeeCents = fees.serviceFeeCents;

  const disclosure = customerPlatformFeeDisclosure();
  const paymentLinkUrl =
    invoice.stripePaymentLinkUrl?.includes("/pay/") === true
      ? invoice.stripePaymentLinkUrl
      : buildPublicPaymentPageUrl(token);

  let checkoutClientSecret: string | null = null;
  if (featureFlags.stripeRenvaniEmbeddedCheckout && invoice.stripePaymentLinkId) {
    checkoutClientSecret = await retrieveInvoiceCheckoutClientSecret(invoice.stripePaymentLinkId);
  }

  const link: PublicInvoicePaymentLink = {
    invoiceNumber: invoice.invoiceNumber,
    paymentLinkUrl,
    checkoutClientSecret,
    invoiceAmount: centsToMoneyString(fees.chargeCents),
    platformFeeAmount: centsToMoneyString(totalFeeCents),
    totalDue: centsToMoneyString(fees.totalCents),
    serviceFeeAmount: centsToMoneyString(fees.serviceFeeCents),
    bookingFeeAmount: "0.00",
    invoiceAmountCents: fees.chargeCents,
    serviceFeeCents: fees.serviceFeeCents,
    bookingFeeCents: 0,
    totalDueCents: fees.totalCents,
    feeRefundable: false,
    platformFeePercent: fees.serviceFeeCents > 0 ? fees.serviceFeeRateBps / 100 : null,
    serviceFeePercent: fees.serviceFeeCents > 0 ? fees.serviceFeeRateBps / 100 : null,
    platformFeePaidByCustomer: totalFeeCents > 0,
    platformFeeDisclosure: disclosure.length > 0 ? disclosure : null
  };

  return { link, context };
}

export async function createInvoice(
  companyId: string,
  actorId: string,
  input: CreateInvoiceInput
): Promise<Invoice> {
  const normalizedInput = normalizeCreateInvoiceInput(input);

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, normalizedInput.customerId, tx);
    const job = normalizedInput.jobId ? await getJobRecord(companyId, normalizedInput.jobId, tx) : null;
    const estimate = normalizedInput.estimateId ? await getEstimateRecord(companyId, normalizedInput.estimateId, tx) : null;

    if (job) {
      assertJobBelongsToCustomer(job, customer.id);
    }

    if (estimate) {
      assertEstimateBelongsToCustomer(estimate, customer.id);
    }

    const invoiceNumber = await generateInvoiceNumber(companyId, tx);
    const insertedInvoices = await tx
      .insert(invoices)
      .values({
        companyId,
        invoiceNumber,
        customerId: customer.id,
        jobId: job?.id ?? estimate?.jobId ?? null,
        estimateId: estimate?.id ?? null,
        createdById: actor.id,
        status: "draft",
        title: normalizedInput.title ?? job?.title ?? estimate?.title ?? null,
        messageToCustomer: normalizedInput.messageToCustomer,
        internalNotes: normalizedInput.internalNotes,
        taxRate: normalizedInput.taxRate,
        discountAmount: normalizedInput.discountAmount,
        dueAt: normalizedInput.dueAt,
        balanceDue: "0.00"
      })
      .returning();
    const createdInvoice = insertedInvoices[0];

    if (!createdInvoice) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create invoice");
    }

    const estimateRows = estimate ? await getEstimateItemRows(companyId, estimate.id, tx) : [];
    const sourceItems = estimateRows.length > 0
      ? estimateRows.map((item) => ({
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isTaxable: item.isTaxable ?? true,
          sortOrder: item.sortOrder ?? 0,
          priceBookItemId: item.productCatalogId
        }))
      : normalizedInput.items;

    if (sourceItems.length > 0) {
      if (estimateRows.length > 0) {
        // Lines copied from the caller's own estimate: a catalog item soft-deleted since the
        // estimate was written must not block invoicing — drop the stale link instead.
        const liveIds = await findLivePriceBookItemIds(
          tx,
          companyId,
          sourceItems.map((item) => ("priceBookItemId" in item ? item.priceBookItemId : null))
        );
        for (const item of sourceItems) {
          if ("priceBookItemId" in item && item.priceBookItemId && !liveIds.has(item.priceBookItemId)) {
            item.priceBookItemId = null;
          }
        }
      } else {
        // Client-supplied ids must belong to the caller's company (404 otherwise).
        await assertPriceBookItemsInCompany(
          tx,
          companyId,
          sourceItems.map((item) => ("priceBookItemId" in item ? item.priceBookItemId : null))
        );
      }
      await tx
        .insert(invoiceItems)
        .values(
          sourceItems.map((item, index) => ({
            companyId,
            invoiceId: createdInvoice.id,
            name: item.name.trim(),
            description: normalizeOptionalString(item.description) ?? null,
            itemType: item.itemType ?? "service",
            quantity: typeof item.quantity === "string" ? item.quantity : formatQuantity(new Decimal(item.quantity)),
            unitPrice: typeof item.unitPrice === "string" ? item.unitPrice : formatMoney(new Decimal(item.unitPrice)),
            total: formatMoney(
              new Decimal(typeof item.quantity === "string" ? item.quantity : item.quantity).mul(
                typeof item.unitPrice === "string" ? item.unitPrice : item.unitPrice
              )
            ),
            isTaxable: item.isTaxable ?? true,
            sortOrder: item.sortOrder ?? index,
            ...("priceBookItemId" in item && item.priceBookItemId
              ? { productCatalogId: item.priceBookItemId }
              : {})
          }))
        )
        .returning();
    }

    await recalculateTotals(createdInvoice.id, tx);

    const [persistedInvoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, createdInvoice.id))
      .limit(1);

    if (!persistedInvoice) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to load created invoice");
    }

    await emitInvoiceEvent(tx, {
      invoice: persistedInvoice,
      eventType: "invoice.created",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildInvoiceSummary(persistedInvoice.invoiceNumber, "created")
    });

    return toInvoice(persistedInvoice);
  });
}

export async function updateInvoice(
  companyId: string,
  actorId: string,
  invoiceId: string,
  input: UpdateInvoiceInput
): Promise<Invoice> {
  const existingInvoice = await getInvoiceRecord(companyId, invoiceId, db);
  assertInvoiceIsDraft(existingInvoice);
  const normalizedInput = normalizeUpdateInvoiceInput(input);

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customerId = normalizedInput.customerId ?? existingInvoice.customerId;
    const jobId = normalizedInput.jobId ?? existingInvoice.jobId;
    const estimateId = normalizedInput.estimateId ?? existingInvoice.estimateId;
    const customer = await getCustomerRecord(companyId, customerId, tx);
    const job = jobId ? await getJobRecord(companyId, jobId, tx) : null;
    const estimate = estimateId ? await getEstimateRecord(companyId, estimateId, tx) : null;

    if (job) {
      assertJobBelongsToCustomer(job, customer.id);
    }

    if (estimate) {
      assertEstimateBelongsToCustomer(estimate, customer.id);
    }

    const updatedInvoices = await tx
      .update(invoices)
      .set({
        ...(normalizedInput.customerId !== undefined ? { customerId } : {}),
        ...(normalizedInput.jobId !== undefined ? { jobId } : {}),
        ...(normalizedInput.estimateId !== undefined ? { estimateId } : {}),
        ...(normalizedInput.title !== undefined ? { title: normalizedInput.title } : {}),
        ...(normalizedInput.messageToCustomer !== undefined ? { messageToCustomer: normalizedInput.messageToCustomer } : {}),
        ...(normalizedInput.internalNotes !== undefined ? { internalNotes: normalizedInput.internalNotes } : {}),
        ...(normalizedInput.taxRate !== undefined ? { taxRate: normalizedInput.taxRate } : {}),
        ...(normalizedInput.discountAmount !== undefined ? { discountAmount: normalizedInput.discountAmount } : {}),
        ...(normalizedInput.dueAt !== undefined ? { dueAt: normalizedInput.dueAt } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
      .returning();
    const updatedInvoice = updatedInvoices[0];

    if (!updatedInvoice) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
    }

    await recalculateTotals(updatedInvoice.id, tx);

    const [persistedInvoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, updatedInvoice.id))
      .limit(1);

    if (!persistedInvoice) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to load updated invoice");
    }

    await emitInvoiceEvent(tx, {
      invoice: persistedInvoice,
      eventType: "invoice.updated",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildInvoiceSummary(persistedInvoice.invoiceNumber, "updated")
    });

    return toInvoice(persistedInvoice);
  });
}

export async function sendInvoice(
  companyId: string,
  actorId: string,
  invoiceId: string
): Promise<Invoice> {
  const existingInvoice = await getInvoiceRecord(companyId, invoiceId, db);
  assertInvoiceIsDraft(existingInvoice);

  if (new Decimal(existingInvoice.total).lte(0)) {
    throw new AppError(ErrorCode.CONFLICT, "Invoice total must be greater than zero before sending");
  }

  const [company, customer, items] = await Promise.all([
    getCompanyRecord(companyId, db),
    getCustomerRecord(companyId, existingInvoice.customerId, db),
    getInvoiceItems(companyId, existingInvoice.id, db)
  ]);

  if (!company.stripeAccountId) {
    throw new AppError(ErrorCode.CONFLICT, "Company must connect Stripe before sending invoices");
  }

  if (!customer.email) {
    throw new AppError(ErrorCode.CONFLICT, "Customer must have an email before sending an invoice");
  }

  const sentAt = new Date();
  const dueAt =
    existingInvoice.dueAt ??
    new Date(sentAt.getTime() + env.INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);

  let checkoutSessionId: string | null = null;
  const paymentToken = existingInvoice.paymentToken ?? generatePaymentToken();

  try {
    const checkoutSession = await createInvoiceCheckoutSession({
      companyId,
      invoiceId: existingInvoice.id,
      customerId: existingInvoice.customerId,
      customerEmail: customer.email,
      receiptEmail: isReceiptEmailAllowed(customer) ? customer.email.trim() : null,
      companyStripeAccountId: company.stripeAccountId,
      companyName: company.name,
      invoiceNumber: existingInvoice.invoiceNumber,
      total: existingInvoice.balanceDue,
      paymentToken,
      renvaniPlan: readRenvaniSubscriptionPlan(company),
      items: items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        total: item.total
      }))
    });
    checkoutSessionId = checkoutSession.id;
    const customerPaymentUrl = buildPublicPaymentPageUrl(paymentToken);

    const sentInvoice = await db.transaction(async (tx) => {
      const actor = await getUserRecord(companyId, actorId, tx);
      const updatedInvoices = await tx
        .update(invoices)
        .set({
          stripePaymentLinkId: checkoutSession.id,
          stripePaymentLinkUrl: checkoutSession.url ?? customerPaymentUrl,
          paymentToken,
          issuedAt: sentAt,
          sentAt,
          dueAt,
          status: "sent",
          updatedAt: sentAt
        })
        .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
        .returning();
      const updatedInvoice = updatedInvoices[0];

      if (!updatedInvoice) {
        throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
      }

      await emitInvoiceEvent(tx, {
        invoice: updatedInvoice,
        eventType: "invoice.sent",
        actorId: actor.id,
        actorName: buildActorName(actor.firstName, actor.lastName),
        summary: buildInvoiceSummary(updatedInvoice.invoiceNumber, "sent")
      });

      return updatedInvoice;
    });

    const overdueDelay = Math.max(dueAt.getTime() - sentAt.getTime() + OVERDUE_CHECK_DELAY_BUFFER_MS, 0);

    try {
      await notificationsQueue.add(
        "send-invoice-email",
        {
          companyId,
          invoiceId: sentInvoice.id,
          customerId: sentInvoice.customerId
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
    } catch (error: unknown) {
      logger.error(
        {
          err: error,
          companyId,
          invoiceId: sentInvoice.id
        },
        "Failed to enqueue invoice email notification"
      );
    }

    try {
      await invoicesQueue.add(
        "check-invoice-overdue",
        {
          companyId,
          invoiceId: sentInvoice.id
        },
        {
          delay: overdueDelay,
          attempts: 3
        }
      );
    } catch (error: unknown) {
      logger.error(
        {
          err: error,
          companyId,
          invoiceId: sentInvoice.id
        },
        "Failed to enqueue invoice overdue check"
      );
    }

    return toInvoice(sentInvoice);
  } catch (error) {
    if (checkoutSessionId) {
      try {
        await expireInvoiceCheckoutSession(checkoutSessionId);
      } catch (cleanupError: unknown) {
        logger.error(
          {
            err: cleanupError,
            companyId,
            invoiceId
          },
          "Failed to expire checkout session after send failure"
        );
      }
    }

    throw error;
  }
}

export async function recordPayment(
  companyId: string,
  actorId: string,
  invoiceId: string,
  input: RecordPaymentInput
): Promise<Payment> {
  const existingInvoice = await getInvoiceRecord(companyId, invoiceId, db);

  if (existingInvoice.status === "void" || existingInvoice.status === "paid") {
    throw new AppError(ErrorCode.CONFLICT, "Invoice cannot accept additional payments");
  }

  const normalizedInput = normalizeRecordPaymentInput(input);
  const paymentAmount = new Decimal(normalizedInput.amount);

  const result = await db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, existingInvoice.customerId, tx);
    const insertedPayments = await tx
      .insert(payments)
      .values({
        companyId,
        invoiceId: existingInvoice.id,
        customerId: existingInvoice.customerId,
        collectedById: actor.id,
        amount: normalizedInput.amount,
        method: normalizedInput.method,
        status: "succeeded",
        checkNumber: normalizedInput.checkNumber,
        referenceNumber: normalizedInput.referenceNumber,
        notes: normalizedInput.notes,
        paidAt: normalizedInput.paidAt
      })
      .returning();
    const payment = insertedPayments[0];

    if (!payment) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to record payment");
    }

    const nextInvoiceValues = applyPaymentToInvoice(existingInvoice, paymentAmount);
    const updatedInvoices = await tx
      .update(invoices)
      .set({
        amountPaid: nextInvoiceValues.amountPaid,
        balanceDue: nextInvoiceValues.balanceDue,
        status: nextInvoiceValues.status,
        paidAt: nextInvoiceValues.paidAt,
        updatedAt: new Date()
      })
      .where(and(eq(invoices.companyId, companyId), eq(invoices.id, existingInvoice.id), isNull(invoices.deletedAt)))
      .returning();
    const updatedInvoice = updatedInvoices[0];

    if (!updatedInvoice) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
    }

    await tx
      .update(customers)
      .set({
        lifetimeValue: addMoneyStrings(customer.lifetimeValue, normalizedInput.amount),
        updatedAt: new Date()
      })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customer.id), isNull(customers.deletedAt)))
      .returning();

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "payment.received",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "payment",
      entityId: payment.id,
      customerId: payment.customerId,
      invoiceId: payment.invoiceId,
      ...(updatedInvoice.jobId ? { jobId: updatedInvoice.jobId } : {}),
      ...(updatedInvoice.estimateId ? { estimateId: updatedInvoice.estimateId } : {}),
      payload: {
        amount: payment.amount,
        method: payment.method,
        status: payment.status
      },
      summary: `Payment received for invoice ${updatedInvoice.invoiceNumber}`
    });

    if (updatedInvoice.status === "paid") {
      await emitInvoiceEvent(tx, {
        invoice: updatedInvoice,
        eventType: "invoice.paid",
        actorId: actor.id,
        actorName: buildActorName(actor.firstName, actor.lastName),
        summary: buildInvoiceSummary(updatedInvoice.invoiceNumber, "paid")
      });
    }

    return {
      payment: toPayment(payment),
      paid: updatedInvoice.status === "paid"
    };
  });

  if (result.paid) {
    await dispatchEventAutomation({ eventType: "invoice.paid", companyId, invoiceId });
  }

  return result.payment;
}

export async function resendInvoiceReminder(
  companyId: string,
  actorId: string,
  invoiceId: string
): Promise<Invoice> {
  const existingInvoice = await getInvoiceRecord(companyId, invoiceId, db);

  if (!["sent", "viewed", "partially_paid", "overdue"].includes(existingInvoice.status)) {
    throw new AppError(ErrorCode.CONFLICT, "Invoice is not eligible for reminders");
  }

  if (new Decimal(existingInvoice.balanceDue).lte(0)) {
    throw new AppError(ErrorCode.CONFLICT, "Invoice has no outstanding balance");
  }

  if (!existingInvoice.stripePaymentLinkUrl) {
    throw new AppError(ErrorCode.CONFLICT, "Invoice must be sent before a reminder can be queued");
  }

  const reminderLevel =
    existingInvoice.reminder1SentAt === null
      ? 1
      : existingInvoice.reminder2SentAt === null
        ? 2
        : existingInvoice.reminder3SentAt === null
          ? 3
          : null;

  if (!reminderLevel) {
    throw new AppError(ErrorCode.CONFLICT, "All reminder levels have already been sent");
  }

  await getUserRecord(companyId, actorId, db);

  await notificationsQueue.add(
    "send-invoice-reminder",
    {
      companyId,
      invoiceId: existingInvoice.id,
      customerId: existingInvoice.customerId,
      reminderLevel
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      jobId: `manual-send-invoice-reminder-${existingInvoice.id}-${reminderLevel}-${Date.now()}`
    }
  );

  return toInvoice(existingInvoice);
}

export async function voidInvoice(
  companyId: string,
  actorId: string,
  invoiceId: string,
  reason: string
): Promise<Invoice> {
  const existingInvoice = await getInvoiceRecord(companyId, invoiceId, db);

  if (!["draft", "sent", "partially_paid"].includes(existingInvoice.status)) {
    throw new AppError(ErrorCode.CONFLICT, "Invoice cannot be voided");
  }

  if (existingInvoice.status === "paid") {
    throw new AppError(ErrorCode.CONFLICT, "Paid invoices cannot be voided");
  }

  if (existingInvoice.stripePaymentLinkId) {
    await expireInvoiceCheckoutSession(existingInvoice.stripePaymentLinkId);
  }

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const updatedInvoices = await tx
      .update(invoices)
      .set({
        status: "void",
        updatedAt: new Date()
      })
      .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
      .returning();
    const updatedInvoice = updatedInvoices[0];

    if (!updatedInvoice) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
    }

    await emitInvoiceEvent(tx, {
      invoice: updatedInvoice,
      eventType: "invoice.void",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildInvoiceSummary(updatedInvoice.invoiceNumber, "voided"),
      payload: { reason: reason.trim() }
    });

    return toInvoice(updatedInvoice);
  });
}

export async function markOverdue(companyId: string, invoiceId: string): Promise<Invoice> {
  const existingInvoice = await getInvoiceRecord(companyId, invoiceId, db);

  if (existingInvoice.status !== "sent" || !existingInvoice.dueAt || existingInvoice.dueAt.getTime() > Date.now()) {
    return toInvoice(existingInvoice);
  }

  const overdueInvoice = await markInvoiceOverdueIfNeeded(companyId, invoiceId);

  if (!overdueInvoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  const rule = await findAutomationRule(companyId, "invoice_overdue");

  if (rule) {
    try {
      await aiQueue.add(
        "invoice-recovery-check",
        {
          companyId,
          invoiceId: overdueInvoice.id,
          customerId: overdueInvoice.customerId
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
    } catch (error: unknown) {
      logger.error(
        {
          err: error,
          companyId,
          invoiceId: overdueInvoice.id
        },
        "Failed to enqueue invoice recovery AI job"
      );
    }
  }

  return toInvoice(overdueInvoice);
}

function readNonNegativeIntMetadata(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

/**
 * Splits a succeeded checkout PaymentIntent into invoice portion + fees using the metadata stamped
 * at checkout creation. Legacy intents without fee metadata are treated as fee-free (whole amount).
 */
export function readCheckoutFeesFromIntent(paymentIntent: {
  amount: number;
  amount_received?: number | null;
  metadata?: Record<string, string> | null;
}): { invoiceAmountCents: number; serviceFeeCents: number; bookingFeeCents: number } {
  const received = paymentIntent.amount_received || paymentIntent.amount;
  const metadata = paymentIntent.metadata ?? {};
  const serviceFeeCents = readNonNegativeIntMetadata(metadata.serviceFeeCents);
  // Legacy: intents created before the online-booking fee was removed (2026-10-27) may still carry it.
  const bookingFeeCents =
    metadata.bookingFeeCents === undefined ? 0 : readNonNegativeIntMetadata(metadata.bookingFeeCents);

  if (serviceFeeCents === null || bookingFeeCents === null) {
    return { invoiceAmountCents: received, serviceFeeCents: 0, bookingFeeCents: 0 };
  }

  return {
    invoiceAmountCents: Math.max(0, received - serviceFeeCents - bookingFeeCents),
    serviceFeeCents,
    bookingFeeCents
  };
}

export async function handleStripePaymentSuccess(
  stripeEvent: Stripe.PaymentIntentSucceededEvent
): Promise<void> {
  const paymentIntent = stripeEvent.data.object;
  const invoiceId = paymentIntent.metadata.invoiceId;

  if (!invoiceId) {
    return;
  }

  const existingPayment = await getPaymentByIntentId(paymentIntent.id, db);

  if (existingPayment) {
    return;
  }

  const invoice = await getInvoiceById(invoiceId, db);
  const fees = readCheckoutFeesFromIntent(paymentIntent);
  // Only the invoice portion is applied to the balance; fees are recorded on their own columns.
  const paymentAmount = new Decimal(fees.invoiceAmountCents).div(100);

  const recorded = await db.transaction(async (tx) => {
    const customer = await getCustomerRecord(invoice.companyId, invoice.customerId, tx);
    const insertedPayments = await tx
      .insert(payments)
      .values({
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount: formatMoney(paymentAmount),
        serviceFeeAmount: centsToMoneyString(fees.serviceFeeCents),
        bookingFeeAmount: centsToMoneyString(fees.bookingFeeCents),
        feeRefundable: false,
        method: resolveStripePaymentMethod(paymentIntent),
        status: "succeeded",
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId:
          typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : null,
        paidAt: new Date()
      })
      .returning();
    const payment = insertedPayments[0];

    if (!payment) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to persist Stripe payment");
    }

    const nextInvoiceValues = applyPaymentToInvoice(invoice, paymentAmount);
    const updatedInvoices = await tx
      .update(invoices)
      .set({
        amountPaid: nextInvoiceValues.amountPaid,
        balanceDue: nextInvoiceValues.balanceDue,
        status: nextInvoiceValues.status,
        paidAt: nextInvoiceValues.paidAt,
        serviceFeeAmount: addMoneyStrings(invoice.serviceFeeAmount ?? "0.00", centsToMoneyString(fees.serviceFeeCents)),
        bookingFeeAmount: addMoneyStrings(invoice.bookingFeeAmount ?? "0.00", centsToMoneyString(fees.bookingFeeCents)),
        updatedAt: new Date()
      })
      .where(and(eq(invoices.companyId, invoice.companyId), eq(invoices.id, invoice.id), isNull(invoices.deletedAt)))
      .returning();
    const updatedInvoice = updatedInvoices[0];

    if (!updatedInvoice) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
    }

    await tx
      .update(customers)
      .set({
        lifetimeValue: addMoneyStrings(customer.lifetimeValue, payment.amount),
        updatedAt: new Date()
      })
      .where(and(eq(customers.companyId, customer.companyId), eq(customers.id, customer.id), isNull(customers.deletedAt)))
      .returning();

    await emitEventWithExecutor(tx, {
      companyId: invoice.companyId,
      eventType: "payment.received",
      actorType: "system",
      entityType: "payment",
      entityId: payment.id,
      customerId: payment.customerId,
      invoiceId: payment.invoiceId,
      ...(invoice.jobId ? { jobId: invoice.jobId } : {}),
      ...(invoice.estimateId ? { estimateId: invoice.estimateId } : {}),
      payload: {
        amount: payment.amount,
        method: payment.method,
        stripePaymentIntentId: paymentIntent.id
      },
      summary: `Stripe payment received for invoice ${updatedInvoice.invoiceNumber}`
    });

    if (updatedInvoice.status === "paid") {
      await emitInvoiceEvent(tx, {
        invoice: updatedInvoice,
        eventType: "invoice.paid",
        actorType: "system",
        summary: buildInvoiceSummary(updatedInvoice.invoiceNumber, "paid")
      });
    }

    return { payment, customer, paid: updatedInvoice.status === "paid" };
  });

  await enqueueInvoicePaymentReceipt(invoice.companyId, invoice.id, recorded.payment, recorded.customer);

  if (recorded.paid) {
    await dispatchEventAutomation({ eventType: "invoice.paid", companyId: invoice.companyId, invoiceId: invoice.id });
  }
}

/**
 * Resend payment receipt. Only reached when this delivery inserted a NEW payment row (redelivery returns early on
 * the existing intent), and the jobId makes BullMQ drop any duplicate enqueue, so receipts are at most once per payment.
 * Opt-out is re-checked in the worker against fresh customer data; this pre-check just avoids pointless jobs.
 * Enqueue failure is logged, never thrown: the payment is already committed and a 5xx would not re-enqueue.
 */
async function enqueueInvoicePaymentReceipt(
  companyId: string,
  invoiceId: string,
  payment: { id: string; customerId: string; amount: string; paidAt: Date | null },
  customer: { email: string | null; doNotContact?: boolean | null; prefersEmail?: boolean | null }
): Promise<void> {
  if (!isReceiptEmailAllowed(customer)) {
    return;
  }

  try {
    await notificationsQueue.add(
      "send-invoice-receipt",
      {
        companyId,
        invoiceId,
        customerId: payment.customerId,
        paymentId: payment.id,
        amount: payment.amount,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null
      },
      {
        jobId: `invoice-receipt-${payment.id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 }
      }
    );
  } catch (error) {
    logger.error({ err: error, companyId, invoiceId, paymentId: payment.id }, "Failed to enqueue invoice payment receipt");
  }
}

export async function handleStripePaymentFailed(
  stripeEvent: Stripe.PaymentIntentPaymentFailedEvent
): Promise<void> {
  const paymentIntent = stripeEvent.data.object;
  const invoiceId = paymentIntent.metadata.invoiceId;

  if (!invoiceId) {
    return;
  }

  const invoice = await getInvoiceById(invoiceId, db);

  await emitEventWithExecutor(db, {
    companyId: invoice.companyId,
    eventType: "payment.failed",
    actorType: "system",
    entityType: "invoice",
    entityId: invoice.id,
    customerId: invoice.customerId,
    invoiceId: invoice.id,
    ...(invoice.jobId ? { jobId: invoice.jobId } : {}),
    ...(invoice.estimateId ? { estimateId: invoice.estimateId } : {}),
    payload: {
      stripePaymentIntentId: paymentIntent.id,
      message: paymentIntent.last_payment_error?.message ?? null
    },
    summary: `Stripe payment failed for invoice ${invoice.invoiceNumber}`
  });
}

export { listItems };
