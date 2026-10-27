import type { ReactNode } from "react";

import type { PublicPaymentLinkResponse } from "@/src/hooks/invoices.hooks";
import { buildPayInvoiceSummary, formatUsd, type PayInvoiceState } from "./pay-invoice.utils";

/** Figma tokens (file jiGHTNUJNltWbHA4Il3hk7, Customer 05): cream #fbf6ef, line #e6dccb, ink #0f1530, ink2 #2a3360, muted #5e6684. */

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Top bar 53:4 + footer 53:11 around the page body. */
export function PayInvoiceShell({ shopName, invoiceNumber, children }: { shopName: string | null | undefined; invoiceNumber: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fbf6ef] text-[#0f1530]" data-node-id="53:3">
      <header className="flex items-center justify-between gap-4 px-5 py-5 md:border-b md:border-[#e6dccb] md:bg-white md:px-12">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="h-7 w-7 shrink-0 rounded-lg bg-[#2f7d4f]" />
          <p className="truncate text-base font-semibold">{shopName ?? "Secure payment"}</p>
        </div>
        <p className="shrink-0 text-[13px] text-[#5e6684]">Invoice {invoiceNumber}</p>
      </header>
      <main className="flex justify-center px-5 pb-8 pt-0 md:px-12 md:pt-12">{children}</main>
      <footer className="flex justify-center px-5 pb-10 md:px-12">
        <p className="font-mono text-[11px] font-medium text-[#5e6684]">Powered by Renvani</p>
      </footer>
    </div>
  );
}

function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[#2a3360]">{label}</span>
      <span>{formatUsd(amount)}</span>
    </div>
  );
}

const divider = <div className="h-px w-full bg-[#e6dccb]" />;
const card = "w-full rounded-[14px] border border-[#e6dccb] bg-white p-6";

/** Invoice summary 53:16 (Flex adds the Service Fee line 53:35 and note 53:38; Flat 53:75 omits both). */
export function PayInvoiceSummaryCard({ payment }: { payment: PublicPaymentLinkResponse }) {
  const summary = buildPayInvoiceSummary(payment);
  const due = formatShortDate(payment.dueAt);
  const serviced = formatShortDate(payment.serviceDate);
  const subline = [payment.serviceAddress, serviced ? `Service on ${serviced}` : null].filter(Boolean).join(" · ");
  const lineItems = payment.lineItems ?? [];

  return (
    <section className={`${card} flex flex-col gap-3`} aria-label="Invoice summary">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-mono text-[11px] font-medium uppercase text-[#5e6684]">Invoice {payment.invoiceNumber}</p>
          {payment.customerName ? <p className="text-xl font-semibold">{payment.customerName}</p> : null}
          {subline ? <p className="text-[13px] text-[#5e6684]">{subline}</p> : null}
        </div>
        {due ? <span className="shrink-0 rounded-full bg-[#fff4d6] px-2.5 py-1 text-[13px] text-[#8a5a00]">Due {due}</span> : null}
      </div>
      {divider}
      {lineItems.length > 0 ? (
        <>
          {lineItems.map((item, index) => (
            <Line key={`${item.description}-${index}`} label={item.description} amount={item.total} />
          ))}
          {divider}
        </>
      ) : null}
      <Line label="Subtotal" amount={summary.subtotal} />
      {summary.feeLines.map((line) => (
        <div key={line.key} data-fee-line={line.key}>
          <Line label={line.label} amount={line.amount} />
        </div>
      ))}
      {summary.serviceFeeNote ? <p className="text-[13px] text-[#5e6684]">{summary.serviceFeeNote}</p> : null}
      {payment.platformFeeDisclosure ? <p className="text-[13px] text-[#5e6684]">{payment.platformFeeDisclosure}</p> : null}
      {divider}
      <div className="flex items-center justify-between gap-4 font-semibold">
        <span className="text-base">Total due</span>
        <span className="text-xl">{formatUsd(summary.totalDue)}</span>
      </div>
    </section>
  );
}

/** Payment form 53:43; Failed (53:143 / 53:390) adds the declined banner and "Try again" label. */
export function PayInvoicePaymentCard({
  payment,
  failed,
  checkout
}: {
  payment: PublicPaymentLinkResponse;
  failed: boolean;
  checkout: ReactNode | null;
}) {
  const total = formatUsd(payment.totalDue);

  return (
    <section className={`${card} flex flex-col gap-3.5`} aria-label="Pay securely">
      <h2 className="text-xl font-semibold">Pay securely</h2>
      {failed ? (
        <div role="alert" className="flex flex-col gap-1 rounded-lg bg-[#fbe3dc] p-3.5 text-[#b42318]">
          <p className="text-base font-semibold">Your card was declined</p>
          <p className="text-[13px]">No charge was made. Try another card or pay by bank account.</p>
        </div>
      ) : null}
      {checkout ?? (
        <a
          href={payment.paymentLinkUrl}
          className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#f6b400] px-[18px] text-sm font-semibold text-[#0f1530] transition hover:opacity-90"
        >
          {failed ? `Try again · ${total}` : `Pay ${total}`}
        </a>
      )}
      <p className="text-center text-[13px] text-[#5e6684]">
        {payment.statementDescriptor
          ? `Encrypted payment. Shows as ${payment.statementDescriptor} on your statement.`
          : "Encrypted payment."}
      </p>
    </section>
  );
}

/** Flex / Flat / Failed body: two columns on desktop (516 + 420), stacked on mobile. */
export function PayInvoiceCheckoutBody({
  payment,
  state,
  checkout
}: {
  payment: PublicPaymentLinkResponse;
  state: Exclude<PayInvoiceState, "paid">;
  checkout: ReactNode | null;
}) {
  return (
    <div className="flex w-full max-w-[960px] flex-col items-start gap-4 md:flex-row md:gap-6" data-pay-state={state}>
      <div className="w-full md:min-w-0 md:flex-1">
        <PayInvoiceSummaryCard payment={payment} />
      </div>
      <div className="w-full md:w-[420px] md:shrink-0">
        <PayInvoicePaymentCard payment={payment} failed={state === "failed"} checkout={checkout} />
      </div>
    </div>
  );
}

export interface PaidDetail {
  label: string;
  value: string;
}

/** Success card 53:229 (desktop) / 53:465 (mobile). */
export function PayInvoicePaidCard({
  amount,
  invoiceNumber,
  customerName,
  shopName,
  shopUrl,
  details,
  receiptHref,
  receiptLabel = "Download receipt"
}: {
  amount: string | null;
  invoiceNumber: string;
  customerName?: string | null | undefined;
  shopName?: string | null | undefined;
  shopUrl?: string | null | undefined;
  details: PaidDetail[];
  receiptHref: string | null;
  receiptLabel?: string | undefined;
}) {
  const firstName = customerName?.trim().split(/\s+/)[0];
  const thanks = `Thanks${firstName ? `, ${firstName}` : ""}. ${shopName ?? "Your service provider"} has your payment for ${invoiceNumber}.`;

  return (
    <div className="flex w-full max-w-[960px] flex-col" data-pay-state="paid">
      <section className={`${card} flex flex-col items-center gap-3.5 p-8 text-center`} aria-label="Payment received">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e4f1e8] text-[32px] font-semibold text-[#2f7d4f]">
          ✓
        </span>
        <h1 className="text-[32px] font-semibold">{amount != null ? `Paid ${formatUsd(amount)}` : "Paid"}</h1>
        <p className="text-sm text-[#5e6684]">{thanks}</p>
        {details.length > 0 ? (
          <dl className="flex w-full flex-col gap-2.5 rounded-lg bg-[#fbf6ef] p-4 text-sm">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between gap-4">
                <dt className="text-[#2a3360]">{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="flex w-full flex-wrap items-center justify-center gap-2.5">
          {receiptHref ? (
            <a href={receiptHref} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm font-semibold">
              {receiptLabel}
            </a>
          ) : null}
          {shopUrl && shopName ? (
            <a href={shopUrl} className="inline-flex h-11 items-center justify-center rounded-[10px] px-[18px] text-sm font-semibold text-[#2a3360]">
              Back to {shopName}
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
