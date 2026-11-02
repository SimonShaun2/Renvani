"use client";

import Link from "next/link";
import { useState } from "react";
import type { JobDetail, JobProduct } from "@fsm/types";

import { useInvoices } from "@/src/hooks/invoices.hooks";
import { useStripeConnectStatus } from "@/src/hooks/stripe-connect.hooks";

import { CREATE_INVOICE_COPY, PAYMENTS_SETUP_HREF, type CreateInvoiceButtonState } from "./create-invoice.config";
import { resolveCreateInvoiceButtonState } from "./create-invoice.utils";
import { CreateInvoicePanel } from "./CreateInvoicePanel";

interface CreateInvoiceActionProps {
  job: JobDetail;
  products: JobProduct[];
  taxRate: number | null;
}

const BUTTON_CLASS: Record<Exclude<CreateInvoiceButtonState, "hidden">, string> = {
  primary: "rounded-[10px] bg-[#0f1530] px-4 py-2.5 text-sm font-semibold text-white",
  secondary: "rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]",
  view: "rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]",
  disabled: "cursor-not-allowed rounded-[10px] bg-[#eef0f5] px-4 py-2.5 text-sm font-semibold text-[#a3a9bd]"
};

export function CreateInvoiceAction({ job, products, taxRate }: CreateInvoiceActionProps) {
  const [open, setOpen] = useState(false);
  const invoicesQuery = useInvoices({ jobId: job.id, page: 1, limit: 1 });
  const stripeQuery = useStripeConnectStatus();
  const existing = invoicesQuery.data?.data?.[0] ?? null;
  const chargesEnabled = stripeQuery.data ? Boolean(stripeQuery.data.chargesEnabled) : null;
  const state = resolveCreateInvoiceButtonState({
    status: job.status,
    hasCustomer: Boolean(job.customerId),
    chargesEnabled,
    existingInvoiceId: existing?.id ?? null
  });

  if (state === "hidden") return null;

  if (state === "view" && existing) {
    return (
      <Link href={`/invoices/${existing.id}`} className={BUTTON_CLASS.view} data-state="view">
        {CREATE_INVOICE_COPY.viewInvoice(existing.invoiceNumber)}
      </Link>
    );
  }

  if (state === "disabled") {
    return (
      <span className="group relative inline-flex">
        <button type="button" disabled aria-describedby="create-invoice-tip" className={BUTTON_CLASS.disabled} data-state="disabled">
          {CREATE_INVOICE_COPY.button}
        </button>
        <Link
          id="create-invoice-tip"
          role="tooltip"
          href={PAYMENTS_SETUP_HREF}
          className="absolute left-0 top-full z-10 mt-2 hidden whitespace-nowrap rounded-[8px] bg-[#0f1530] px-3 py-2 text-xs font-medium text-white group-focus-within:block group-hover:block"
        >
          {CREATE_INVOICE_COPY.disabledTooltip} →
        </Link>
      </span>
    );
  }

  return (
    <>
      <button type="button" className={BUTTON_CLASS[state]} data-state={state} onClick={() => setOpen(true)}>
        {CREATE_INVOICE_COPY.button}
      </button>
      {open ? (
        <CreateInvoicePanel
          job={job}
          products={products}
          taxRate={taxRate}
          plan={stripeQuery.data?.renvaniPlanTier ?? null}
          feePercent={stripeQuery.data?.platformFeePercent ?? null}
          paymentsReady={chargesEnabled !== false}
          confirmIncomplete={state === "secondary"}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
