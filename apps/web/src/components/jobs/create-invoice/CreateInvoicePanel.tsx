"use client";

import "./create-invoice.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { JobDetail, JobProduct } from "@fsm/types";

import { serviceFeeLabel } from "@/src/components/payments/payments.utils";
import { useCreateInvoice } from "@/src/hooks/invoices.hooks";
import { usePriceBookItemSearch } from "@/src/hooks/price-book.hooks";
import { api } from "@/src/lib/api";

import { CREATE_INVOICE_COPY as COPY, PAYMENTS_SETUP_HREF } from "./create-invoice.config";
import {
  buildCreateInvoicePayload,
  computeInvoiceTotals,
  formatUsd,
  hasCreateInvoiceErrors,
  lineTotal,
  linesFromJobProducts,
  validateCreateInvoice,
  type CreateInvoiceErrors,
  type DraftLine
} from "./create-invoice.utils";

export interface CreateInvoicePanelProps {
  job: JobDetail;
  products: JobProduct[];
  taxRate: number | null;
  plan: "flex" | "flat" | null;
  feePercent: number | null;
  paymentsReady: boolean;
  confirmIncomplete: boolean;
  onClose: () => void;
}

const inputClass = "w-full rounded-[10px] border border-[#e6dccb] bg-white px-3 py-2.5 text-sm text-[#0f1530]";
const inputErrorClass = "w-full rounded-[10px] border border-[#c0392b] bg-white px-3 py-2.5 text-sm text-[#0f1530]";
const monoClass = "font-mono text-[12px] font-medium text-[#5e6684]";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function CreateInvoicePanel(props: CreateInvoicePanelProps) {
  const { job, taxRate, plan, feePercent, paymentsReady, confirmIncomplete, onClose } = props;
  const router = useRouter();
  const createInvoice = useCreateInvoice();
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromJobProducts(props.products));
  const [discount, setDiscount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(false);
  const [confirmed, setConfirmed] = useState(!confirmIncomplete);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [errors, setErrors] = useState<CreateInvoiceErrors>({ lines: {} });
  const [submitError, setSubmitError] = useState(false);
  const priceBook = usePriceBookItemSearch(searchOpen ? search : "");

  const totals = useMemo(
    () => computeInvoiceTotals({ lines, taxRate, discount: Number.parseFloat(discount) || 0, plan, feePercent }),
    [lines, taxRate, discount, plan, feePercent]
  );
  const feeLabel = plan === "flex" ? serviceFeeLabel(feePercent) : null;
  const customerName = `${job.customer.firstName} ${job.customer.lastName}`.trim();
  const address = job.property ? `${job.property.addressLine1}, ${job.property.city}, ${job.property.state}` : null;

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine(line: Omit<DraftLine, "key" | "include">) {
    setLines((current) => [...current, { ...line, key: `new-${Date.now()}-${current.length}`, include: true }]);
  }

  async function handleSubmit() {
    const nextErrors = validateCreateInvoice(lines, dueDate, todayIso());
    setErrors(nextErrors);
    setSubmitError(false);
    if (hasCreateInvoiceErrors(nextErrors) || !job.customerId) {
      setSubmitError(true);
      return;
    }
    try {
      const response = await createInvoice.mutateAsync(
        buildCreateInvoicePayload({
          jobId: job.id,
          customerId: job.customerId,
          title: job.title,
          lines,
          taxRate,
          discount: Number.parseFloat(discount) || 0,
          dueDate,
          messageToCustomer: message,
          internalNotes: notes
        })
      );
      if (sendNow) {
        await api.post(`/api/v1/invoices/${response.invoice.id}/send`, {}).catch(() => undefined);
      }
      router.push(`/invoices/${response.invoice.id}`);
    } catch {
      setSubmitError(true);
    }
  }

  const header = (
    <>
      <div className="flex items-center justify-between font-mono text-[10px] font-medium text-[#5e6684]">
        <button type="button" onClick={onClose} aria-label="Close" className="sm:hidden">
          <X className="h-5 w-5 text-[#0f1530]" />
        </button>
        <span>{COPY.eyebrow}</span>
        <span className="hidden sm:inline">Job {job.jobNumber}</span>
      </div>
      <h2 id="create-invoice-title" className="text-[24px] font-semibold text-[#0f1530]">
        {COPY.title}
      </h2>
      <div className="flex flex-col gap-[3px] rounded-[10px] border border-[#e6dccb] px-[14px] py-[12px]">
        <p className="text-[15px] font-semibold text-[#0f1530]">{customerName || "—"}</p>
        {address ? <p className="hidden text-[13px] text-[#2a3360] sm:block">{address}</p> : null}
        <p className={monoClass}>
          {job.jobNumber} · {job.title}
        </p>
      </div>
    </>
  );

  return (
    <div
      className="create-invoice-backdrop fixed inset-0 z-50 flex items-stretch justify-center bg-[#0f1530]/40 sm:items-start sm:overflow-y-auto sm:p-8"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-invoice-title"
        className="create-invoice-panel flex w-full flex-col gap-[14px] overflow-y-auto bg-[#fbf6ef] p-4 sm:max-w-[640px] sm:overflow-visible sm:rounded-[14px] sm:border sm:border-[#e6dccb] sm:bg-white sm:p-[28px]"
      >
        {header}

        {!paymentsReady ? (
          <>
            <div className="rounded-[12px] border border-[#f6b400] bg-[#fff3d6] p-5" data-testid="payments-not-set-up">
              <p className="text-[17px] font-semibold text-[#0f1530]">{COPY.paymentsTitle}</p>
              <p className="mt-2 text-[13px] text-[#2a3360]">{COPY.paymentsBody}</p>
              <Link href={PAYMENTS_SETUP_HREF} className="mt-4 inline-flex rounded-[10px] bg-[#0f1530] px-4 py-2.5 text-sm font-semibold text-white">
                {COPY.paymentsCta}
              </Link>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
                {COPY.close}
              </button>
            </div>
          </>
        ) : !confirmed ? (
          <div className="rounded-[12px] border border-[#e6dccb] bg-white p-5" data-testid="confirm-incomplete">
            <p className="text-[15px] font-semibold text-[#0f1530]">{COPY.incompleteConfirm}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
                {COPY.cancel}
              </button>
              <button type="button" onClick={() => setConfirmed(true)} className="rounded-[10px] bg-[#0f1530] px-4 py-2.5 text-sm font-semibold text-white">
                {COPY.button}
              </button>
            </div>
          </div>
        ) : (
          <>
            {submitError ? (
              <p role="alert" className="create-invoice-error rounded-[10px] bg-[#fde3dc] px-3 py-2.5 text-[13px] text-[#c0392b]">
                {COPY.submitError}
              </p>
            ) : null}

            <div className="overflow-hidden rounded-[12px] border border-[#e6dccb] bg-white">
              <div className="hidden gap-[10px] bg-[#fbf6ef] px-3 py-2 font-mono text-[13px] font-medium text-[#5e6684] sm:flex">
                <span className="w-4" />
                <span className="flex-1">ITEM</span>
                <span className="w-[60px]">QTY</span>
                <span className="w-[90px]">UNIT PRICE</span>
                <span className="w-[90px]">LINE TOTAL</span>
              </div>
              {lines.map((line) => {
                const lineError = errors.lines[line.key];
                return (
                  <div key={line.key} className="border-t border-[#f0e8da] px-3 py-2.5 first:border-t-0 sm:first:border-t">
                    <div className="flex flex-wrap items-center gap-[10px]">
                      <input
                        type="checkbox"
                        aria-label={`Include ${line.name || "line"}`}
                        checked={line.include}
                        onChange={(event) => updateLine(line.key, { include: event.target.checked })}
                        className="h-4 w-4 accent-[#0f1530]"
                      />
                      <input
                        aria-label="Item"
                        value={line.name}
                        onChange={(event) => updateLine(line.key, { name: event.target.value })}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0f1530]"
                      />
                      <input
                        aria-label="Qty"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        className={`w-[60px] rounded-[8px] px-2 py-1 text-[13px] ${lineError ? "border border-[#c0392b]" : "border border-transparent"}`}
                      />
                      <input
                        aria-label="Unit price"
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                        className="w-[90px] rounded-[8px] border border-transparent px-2 py-1 text-[13px]"
                      />
                      <span className="w-[90px] text-right text-[13px] font-semibold text-[#0f1530] sm:text-left">{formatUsd(lineTotal(line))}</span>
                    </div>
                    {lineError ? <p className="mt-1 pl-[26px] font-mono text-[11px] text-[#c0392b]">{lineError}</p> : null}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-4 border-t border-[#f0e8da] px-3 py-2.5 text-[13px] font-semibold text-[#2f5bd3]">
                <button type="button" onClick={() => setSearchOpen((value) => !value)}>
                  {COPY.addFromPriceBook}
                </button>
                <button type="button" onClick={() => addLine({ name: "", quantity: "1", unitPrice: "", isTaxable: true, itemType: "service" })}>
                  {COPY.customLine}
                </button>
              </div>
              {searchOpen ? (
                <div className="border-t border-[#f0e8da] px-3 py-2.5">
                  <input
                    aria-label="Search price book"
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className={inputClass}
                  />
                  <ul className="mt-2 space-y-1">
                    {(priceBook.data?.items ?? []).map((item) => (
                      <li key={item.priceBookItemId}>
                        <button
                          type="button"
                          className="flex w-full justify-between rounded-[8px] px-2 py-1.5 text-left text-[13px] hover:bg-[#fbf6ef]"
                          onClick={() => {
                            addLine({
                              name: item.name,
                              quantity: "1",
                              unitPrice: (Number.parseFloat(item.unitPrice) || 0).toFixed(2),
                              isTaxable: item.isTaxable,
                              itemType: item.itemType,
                              priceBookItemId: item.priceBookItemId
                            });
                            setSearchOpen(false);
                            setSearch("");
                          }}
                        >
                          <span>{item.name}</span>
                          <span>{formatUsd(Number.parseFloat(item.unitPrice) || 0)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {errors.items ? <p className="font-mono text-[11px] text-[#c0392b]">{errors.items}</p> : null}

            <div className="order-last flex flex-col gap-2 rounded-[12px] bg-[#fbf6ef] p-[14px] text-[13px] text-[#2a3360] max-sm:sticky max-sm:bottom-0 max-sm:border max-sm:border-[#e6dccb] max-sm:bg-white sm:order-none" data-testid="totals">
              <div className="hidden justify-between sm:flex"><span>{COPY.subtotal}</span><span>{formatUsd(totals.subtotal)}</span></div>
              <div className="hidden justify-between sm:flex">
                <span>{taxRate && taxRate > 0 ? COPY.tax((taxRate * 100).toFixed(2).replace(/\.?0+$/, "")) : "Tax"}</span>
                <span>{totals.tax === null ? "—" : formatUsd(totals.tax)}</span>
              </div>
              <label className="hidden items-center justify-between sm:flex">
                <span>{COPY.discount}</span>
                <input aria-label="Discount" inputMode="decimal" value={discount} placeholder="0.00" onChange={(event) => setDiscount(event.target.value)} className="w-[90px] rounded-[8px] border border-[#e6dccb] bg-white px-2 py-1 text-right" />
              </label>
              {feeLabel && totals.serviceFee !== null ? (
                <div className="flex justify-between" data-testid="service-fee"><span>{feeLabel}</span><span>{formatUsd(totals.serviceFee)}</span></div>
              ) : null}
              <div className="flex items-baseline justify-between font-semibold text-[#0f1530]">
                <span>{COPY.customerTotal}</span>
                <span className="text-[20px]">{formatUsd(totals.total)}</span>
              </div>
              <button type="button" onClick={handleSubmit} disabled={createInvoice.isPending} className="mt-2 rounded-[10px] bg-[#0f1530] px-4 py-3 text-sm font-semibold text-white sm:hidden">
                {COPY.button}
              </button>
            </div>

            <label className="flex flex-col gap-2 text-[13px] text-[#2a3360]">
              <span className={errors.dueAt ? "text-[#c0392b]" : undefined}>{COPY.dueDate}</span>
              <input type="date" aria-label={COPY.dueDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={errors.dueAt ? inputErrorClass : inputClass} />
              <span className={monoClass}>{dueDate ? "" : COPY.dueOnReceipt}</span>
              {errors.dueAt ? <span className="font-mono text-[11px] text-[#c0392b]">{errors.dueAt}</span> : null}
            </label>
            <label className="flex flex-col gap-2 text-[13px] text-[#2a3360]">
              <span>{COPY.messageToCustomer}</span>
              <input value={message} onChange={(event) => setMessage(event.target.value)} className={inputClass} />
            </label>
            <label className="hidden flex-col gap-2 text-[13px] text-[#2a3360] sm:flex">
              <span>{COPY.internalNotes}</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
            </label>
            <label className="flex items-center gap-3 text-[13px] text-[#2a3360]">
              <input type="checkbox" role="switch" checked={sendNow} onChange={(event) => setSendNow(event.target.checked)} className="h-4 w-8 accent-[#0f1530]" />
              <span>{COPY.sendNow}</span>
            </label>
            <div className="hidden justify-end gap-3 sm:flex">
              <button type="button" onClick={onClose} className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
                {COPY.cancel}
              </button>
              <button type="button" onClick={handleSubmit} disabled={createInvoice.isPending} className="rounded-[10px] bg-[#0f1530] px-4 py-2.5 text-sm font-semibold text-white">
                {COPY.button}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
