import { formatServiceFeeLineItemName, SERVICE_FEE_RATE_BPS } from "@fsm/config/stripe-pricing";

import type { PublicPaymentLinkResponse } from "@/src/hooks/invoices.hooks";

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

const FAILED_STATUSES = new Set(["failed", "canceled", "cancelled", "declined"]);

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

function ratePercentLabel(rateBps: number): string {
  return `${Number((rateBps / 100).toFixed(2))}%`;
}

export function formatServiceFeeNote(rateBps: number = SERVICE_FEE_RATE_BPS): string {
  return `A ${ratePercentLabel(rateBps)} Service Fee applies to payments made online through Renvani.`;
}

/**
 * Builds the invoice summary lines. Flex shows "Service Fee (2%)" (non-refundable, charged at checkout);
 * Flat shows none. The online-booking fee shows only when the API reports one (online-booked invoice paid in full).
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
    if (hasCents(payment.bookingFeeCents)) {
      feeLines.push({ key: "booking", label: "Online booking fee", amount: centsToUsd(payment.bookingFeeCents) });
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

/** `?status=success` is Stripe's return URL; failed/canceled returns show the declined banner (53:143 / 53:390). */
export function resolvePayInvoiceState(payment: PublicPaymentLinkResponse, status: string | null): PayInvoiceState {
  if (status === "success" || payment.invoiceStatus === "paid") {
    return "paid";
  }
  if (status && FAILED_STATUSES.has(status.toLowerCase())) {
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
