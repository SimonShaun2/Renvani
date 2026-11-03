import { LEGACY_BOOKING_FEE_LABEL, serviceFeeNote } from "@/src/lib/service-fee-copy";
import { formatServiceFeeLineItemName, SERVICE_FEE_RATE_BPS } from "@fsm/config/stripe-pricing";

import type { PublicPaymentLinkResponse } from "@fsm/types";

/** Figma 53:3–53:465 (Customer / 07 Pay invoice): Flex · Flat · Failed · Paid. */
export type PayInvoiceState = "flex" | "flat" | "failed" | "paid";

export interface PayFeeLine {
  key: "service" | "booking";
  label: string;
  amount: string;
}

export interface PayInvoiceSummary {
  subtotal: string;
  feeLines: PayFeeLine[];
  /** Frame 53:38 fee note; only when a Service Fee line is shown (Flex). */
  serviceFeeNote: string | null;
  totalDue: string;
}

const DECLINED_STATUSES = new Set(["failed", "declined"]);
const CANCELED_STATUSES = new Set(["canceled", "cancelled"]);

export interface PayNotice {
  tone: "error" | "neutral";
  title: string;
  body: string;
}

/** Banner for a Stripe return: declined (53:143 / 53:390) vs a neutral canceled notice. */
export function resolvePayNotice(status: string | null): PayNotice | null {
  const value = status?.toLowerCase() ?? "";
  if (DECLINED_STATUSES.has(value)) {
    return { tone: "error", title: "Your card was declined", body: "No charge was made. Try another card or pay by bank account." };
  }
  if (CANCELED_STATUSES.has(value)) {
    return { tone: "neutral", title: "Payment canceled", body: "No charge was made. You can pay whenever you're ready." };
  }
  return null;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "Oct 30". Date-only "YYYY-MM-DD" is read as local date parts (no UTC shift); timestamps use Date. */
export function formatShortDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string | null {
  if (!value) {
    return null;
  }
  const parts = DATE_ONLY.exec(value);
  const date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", options);
}

function centsToUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

function hasCents(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Rate in bps for the Service Fee label: API percent when present, else the shared config constant. */
export function resolveServiceFeeRateBps(platformFeePercent: number | null | undefined): number {
  return typeof platformFeePercent === "number" && platformFeePercent > 0
    ? Math.round(platformFeePercent * 100)
    : SERVICE_FEE_RATE_BPS;
}

export function formatServiceFeeNote(rateBps: number = SERVICE_FEE_RATE_BPS): string {
  return serviceFeeNote(rateBps / 100);
}

/**
 * Builds the invoice summary lines. Flex shows "Service Fee (2%)" (charged at checkout);
 * Flat shows none. There is no booking fee: total due = invoice + Service Fee (Flex) or invoice only (Flat).
 * Older API payloads without split cents fall back to the combined platform fee as the Service Fee line.
 */
export function buildPayInvoiceSummary(payment: PublicPaymentLinkResponse): PayInvoiceSummary {
  const rateBps = resolveServiceFeeRateBps(payment.platformFeePercent);
  const feeLines: PayFeeLine[] = [];
  const hasSplit = typeof payment.serviceFeeCents === "number" || typeof payment.bookingFeeCents === "number";

  if (hasSplit) {
    if (hasCents(payment.serviceFeeCents)) {
      feeLines.push({ key: "service", label: formatServiceFeeLineItemName(rateBps), amount: centsToUsd(payment.serviceFeeCents) });
    }
  } else if (payment.platformFeePaidByCustomer && payment.platformFeePercent != null && Number(payment.platformFeeAmount) > 0) {
    feeLines.push({ key: "service", label: formatServiceFeeLineItemName(rateBps), amount: payment.platformFeeAmount });
  }

  const showsServiceFee = feeLines.some((line) => line.key === "service");

  return {
    subtotal: payment.invoiceAmount,
    feeLines,
    serviceFeeNote: showsServiceFee ? formatServiceFeeNote(rateBps) : null,
    totalDue: payment.totalDue
  };
}

/** `?status=success` is Stripe's return URL; failed/declined/canceled returns show a notice (see resolvePayNotice). */
export function resolvePayInvoiceState(payment: PublicPaymentLinkResponse, status: string | null): PayInvoiceState {
  if (status === "success" || payment.invoiceStatus === "paid") {
    return "paid";
  }
  if (resolvePayNotice(status)) {
    return "failed";
  }
  return buildPayInvoiceSummary(payment).feeLines.some((line) => line.key === "service") ? "flex" : "flat";
}

export function formatUsd(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return amount;
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export interface PaidDetailRow {
  label: string;
  value: string;
}

/**
 * Paid panel rows (53:219 / 53:465) from API fields, shown only when present.
 * "Paid with Visa ••4242" is omitted: the public API does not return card brand/last4.
 */
export function buildPaidDetails(view: {
  paidAt?: string | null;
  statementDescriptor?: string | null;
  receiptEmail?: string | null;
}): PaidDetailRow[] {
  const rows: PaidDetailRow[] = [];
  const date = formatShortDate(view.paidAt, { month: "short", day: "numeric", year: "numeric" });
  if (date) rows.push({ label: "Date", value: date });
  if (view.statementDescriptor) rows.push({ label: "Statement shows", value: view.statementDescriptor });
  if (view.receiptEmail) rows.push({ label: "Receipt sent to", value: view.receiptEmail });
  return rows;
}

export type PayLoadErrorKind = "temporary" | "invalid" | "unavailable";

/**
 * 5xx, 429 and network failures are temporary (retry); 400 is a malformed link;
 * 404/410 and other 4xx keep the expired/unavailable copy.
 */
export function classifyPayLoadError(error: unknown): PayLoadErrorKind {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : NaN;
  if (!Number.isFinite(status) || status === 0 || status >= 500 || status === 429) return "temporary";
  if (status === 400) return "invalid";
  return "unavailable";
}

export const PAY_LOAD_ERROR_COPY: Record<PayLoadErrorKind, { title: string; subtitle: string }> = {
  temporary: {
    title: "Something went wrong",
    subtitle: "We couldn't load this invoice right now. This is usually temporary — please try again."
  },
  invalid: {
    title: "Payment link invalid",
    subtitle: "This payment link isn't valid. Check the link or contact your service provider for a new one."
  },
  unavailable: {
    title: "Payment link unavailable",
    subtitle: "This payment link may have expired. Contact your service provider to request a new invoice link."
  }
};

/**
 * Legacy receipts only: returns the "Online booking fee" row when that receipt was actually charged one
 * (stored amount/cents > 0). "0.00", 0 or missing fields return null, so new receipts never show it.
 */
export function legacyBookingFeeDetail(receipt: {
  bookingFeeCents?: number | null;
  bookingFeeAmount?: string | number | null;
}): { label: string; value: string } | null {
  const cents = Number(receipt.bookingFeeCents ?? 0);
  const amount = Number(receipt.bookingFeeAmount ?? 0);
  if (!(Number.isFinite(cents) && cents > 0) && !(Number.isFinite(amount) && amount > 0)) return null;
  const value = Number.isFinite(amount) && amount > 0 ? amount : cents / 100;
  return { label: LEGACY_BOOKING_FEE_LABEL, value: formatUsd(value.toFixed(2)) };
}
