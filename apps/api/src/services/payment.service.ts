import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  centsToMoneyString,
  computeRefundableCents,
  moneyStringToCents
} from "@fsm/config/stripe-pricing";
import { db, payments } from "@fsm/db";
import {
  type ListPaymentsQuery,
  type PaginatedResult,
  type Payment,
  type PaymentMethod,
  type PaymentStatus
} from "@fsm/types";

type PaymentRow = typeof payments.$inferSelect;

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_RESULT_WINDOW = 10_000;

function normalizePaymentMethod(value: PaymentRow["method"]): PaymentMethod {
  return value as PaymentMethod;
}

function normalizePaymentStatus(value: PaymentRow["status"]): PaymentStatus {
  return value as PaymentStatus;
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

function parseIsoDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

export async function listPayments(
  companyId: string,
  query: ListPaymentsQuery
): Promise<PaginatedResult<Payment>> {
  const createdAfter = parseIsoDateTime(query.createdAfter);
  const createdBefore = parseIsoDateTime(query.createdBefore);
  const page = query.page ?? DEFAULT_LIST_PAGE;
  const limit = Math.min(query.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.companyId, companyId), isNull(payments.deletedAt)))
    .limit(MAX_RESULT_WINDOW);

  const filteredRows = rows.filter((row) => {
    if (query.invoiceId && row.invoiceId !== query.invoiceId) {
      return false;
    }

    if (query.customerId && row.customerId !== query.customerId) {
      return false;
    }

    if (query.method && row.method !== query.method) {
      return false;
    }

    if (query.status && row.status !== query.status) {
      return false;
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
    if (sortBy === "amount") {
      const comparison = new Decimal(left.amount).cmp(right.amount);
      return sortOrder === "asc" ? comparison : comparison * -1;
    }

    const comparison = left.createdAt.getTime() - right.createdAt.getTime();
    return sortOrder === "asc" ? comparison : comparison * -1;
  });

  const total = sortedRows.length;
  const offset = (page - 1) * limit;

  return {
    data: sortedRows.slice(offset, offset + limit).map((row) => toPayment(row)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
