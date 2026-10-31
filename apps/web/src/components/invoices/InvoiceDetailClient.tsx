"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CreditCard, Printer, Send, Trash2 } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { EditableLineItemsTable } from "@/src/components/estimates/EditableLineItemsTable";
import {
  buildInvoicePublicPath,
  computeRevenueTotals,
  formatMoneyInput,
  formatStatusLabel,
  getInvoiceStatusTone,
  lineItemFromInvoiceItem,
  normalizeLineItems,
  parseMoneyValue,
  type RevenueLineItemDraft
} from "@/src/components/estimates/estimates.utils";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ConfirmDialog } from "@/src/components/ui/ConfirmDialog";
import { invoiceConfirmDescription } from "@/src/components/invoices/invoice-confirm.utils";
import { Sheet } from "@/src/components/ui/Sheet";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useCompany } from "@/src/hooks/jobs.hooks";
import {
  useAddInvoiceItem,
  useDeleteInvoiceItem,
  useInvoice,
  useRecordPayment,
  useResendPaymentReminder,
  useSendInvoice,
  useUpdateInvoice,
  useUpdateInvoiceItem,
  useVoidInvoice
} from "@/src/hooks/invoices.hooks";
import { cn, formatDate } from "@/src/lib/utils";
import { getCompanyTaxRate } from "@/src/components/jobs/jobs.utils";

import { RecordPaymentModal } from "./RecordPaymentModal";

interface InvoiceDetailClientProps {
  invoiceId: string;
}

interface VoidFormState {
  reason: string;
}

const defaultVoidState: VoidFormState = {
  reason: ""
};

function lineItemsMatch(left: RevenueLineItemDraft, right: RevenueLineItemDraft): boolean {
  return (
    left.name === right.name &&
    left.description === right.description &&
    left.itemType === right.itemType &&
    formatMoneyInput(left.quantity) === formatMoneyInput(right.quantity) &&
    formatMoneyInput(left.unitPrice) === formatMoneyInput(right.unitPrice) &&
    left.isTaxable === right.isTaxable &&
    left.sortOrder === right.sortOrder &&
    (left.priceBookItemId ?? null) === (right.priceBookItemId ?? null)
  );
}

export function InvoiceDetailClient({ invoiceId }: InvoiceDetailClientProps) {
  const invoiceQuery = useInvoice(invoiceId);
  const companyQuery = useCompany();
  const updateInvoice = useUpdateInvoice(invoiceId);
  const sendInvoice = useSendInvoice(invoiceId);
  const recordPayment = useRecordPayment(invoiceId);
  const voidInvoice = useVoidInvoice(invoiceId);
  const resendReminder = useResendPaymentReminder(invoiceId);
  const addInvoiceItem = useAddInvoiceItem(invoiceId);
  const updateInvoiceItem = useUpdateInvoiceItem(invoiceId);
  const deleteInvoiceItem = useDeleteInvoiceItem(invoiceId);

  const [title, setTitle] = useState("");
  const [messageToCustomer, setMessageToCustomer] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0.00");
  const [dueAt, setDueAt] = useState("");
  const [items, setItems] = useState<RevenueLineItemDraft[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"send" | "remind" | null>(null);
  const [voidForm, setVoidForm] = useState<VoidFormState>(defaultVoidState);

  const invoice = invoiceQuery.data?.invoice;
  const taxRate = invoice?.taxRate ? parseMoneyValue(invoice.taxRate) : getCompanyTaxRate(companyQuery.data?.company.settings);

  useEffect(() => {
    if (!invoice) {
      return;
    }

    setTitle(invoice.title ?? "");
    setMessageToCustomer(invoice.messageToCustomer ?? "");
    setDiscountAmount(formatMoneyInput(invoice.discountAmount ?? "0"));
    setDueAt(invoice.dueAt ? String(invoice.dueAt).slice(0, 10) : "");
    setItems(normalizeLineItems(invoice.items.map((item) => lineItemFromInvoiceItem(item))));
  }, [invoice]);

  const totals = useMemo(
    () => computeRevenueTotals(items, taxRate, parseMoneyValue(discountAmount)),
    [discountAmount, items, taxRate]
  );
  const publicPaymentPath = buildInvoicePublicPath(invoice?.paymentToken);
  const publicPaymentUrl =
    typeof window !== "undefined" && publicPaymentPath ? `${window.location.origin}${publicPaymentPath}` : publicPaymentPath;

  async function handleSaveDraft() {
    if (!invoice) {
      return;
    }

    setErrorMessage(null);
    setSaveState("saving");

    try {
      await updateInvoice.mutateAsync({
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(messageToCustomer.trim() ? { messageToCustomer: messageToCustomer.trim() } : {}),
        discountAmount: parseMoneyValue(discountAmount),
        ...(dueAt ? { dueAt: new Date(`${dueAt}T12:00:00`).toISOString() } : {})
      });

      const existingById = new Map(invoice.items.map((item) => [item.id, item]));
      const normalizedItems = normalizeLineItems(items);

      for (const item of normalizedItems) {
        if (!item.id) {
          await addInvoiceItem.mutateAsync({
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
            itemType: item.itemType,
            quantity: parseMoneyValue(item.quantity),
            unitPrice: parseMoneyValue(item.unitPrice),
            isTaxable: item.isTaxable,
            sortOrder: item.sortOrder,
            ...(item.priceBookItemId ? { priceBookItemId: item.priceBookItemId } : {})
          });
          continue;
        }

        const existing = existingById.get(item.id);
        if (!existing) {
          continue;
        }

        const snapshot = lineItemFromInvoiceItem(existing);
        if (lineItemsMatch(item, snapshot)) {
          continue;
        }

        await updateInvoiceItem.mutateAsync({
          itemId: item.id,
          input: {
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
            itemType: item.itemType,
            quantity: parseMoneyValue(item.quantity),
            unitPrice: parseMoneyValue(item.unitPrice),
            isTaxable: item.isTaxable,
            sortOrder: item.sortOrder,
            ...(item.priceBookItemId !== undefined ? { priceBookItemId: item.priceBookItemId } : {})
          }
        });
      }

      const localIds = new Set(normalizedItems.map((item) => item.id).filter((value): value is string => Boolean(value)));
      for (const existing of invoice.items) {
        if (!localIds.has(existing.id)) {
          await deleteInvoiceItem.mutateAsync(existing.id);
        }
      }

      await invoiceQuery.refetch();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (error) {
      setSaveState("idle");
      setErrorMessage(error instanceof Error ? error.message : "Invoice changes could not be saved.");
    }
  }

  if (invoiceQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[140px]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SkeletonCard className="h-[760px]" />
          <SkeletonCard className="h-[520px]" />
        </div>
      </div>
    );
  }

  if (invoiceQuery.isError || !invoice) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Invoice not found"
        subtitle="This invoice may have been deleted or you may not have access to it in the current company."
        action={(
          <Link href="/invoices" className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
            Back to invoices
          </Link>
        )}
      />
    );
  }

  const isDraft = invoice.status === "draft";
  const isOverdue = invoice.status === "overdue";
  const isPaid = invoice.status === "paid";
  const isUnpaid = ["draft", "sent", "viewed", "partially_paid", "overdue"].includes(invoice.status);

  return (
    <>
      <PageLayout
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`${invoice.customer.firstName} ${invoice.customer.lastName}${invoice.job ? ` • ${invoice.job.title}` : ""}`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge label={formatStatusLabel(invoice.status)} tone={getInvoiceStatusTone(invoice.status)} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
            >
              <Printer className="h-4 w-4" />
              Download / Print
            </button>
          </div>
        )}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="surface-card px-6 py-6">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/invoices" className="text-sm font-semibold text-brand-accent">
                  ← All Invoices
                </Link>
                <StatBadge label={formatStatusLabel(invoice.status)} tone={getInvoiceStatusTone(invoice.status)} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Bill To</p>
                  <p className="mt-3 text-base font-semibold text-neutral-900">
                    {invoice.customer.firstName} {invoice.customer.lastName}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">{invoice.customer.email ?? invoice.customer.phone ?? "No contact on file"}</p>
                </div>

                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Related Job</p>
                  <p className="mt-3 text-base font-semibold text-neutral-900">
                    {invoice.job ? `${invoice.job.jobNumber} — ${invoice.job.title}` : "No related job"}
                  </p>
                </div>

                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Dates</p>
                  <p className="mt-3 text-sm text-neutral-700">Issued {invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}</p>
                  <p className="mt-1 text-sm text-neutral-700">Due {invoice.dueAt ? formatDate(invoice.dueAt) : "—"}</p>
                  {invoice.paidAt ? <p className="mt-1 text-sm text-neutral-700">Paid {formatDate(invoice.paidAt)}</p> : null}
                </div>
              </div>
            </section>

            <section className="surface-card px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Invoice Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    readOnly={!isDraft}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-neutral-900 outline-none transition",
                      isDraft
                        ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                        : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Due Date</label>
                  <input
                    type="date"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    readOnly={!isDraft}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-neutral-900 outline-none transition",
                      isDraft
                        ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                        : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                    )}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Customer Message</label>
                <textarea
                  value={messageToCustomer}
                  onChange={(event) => setMessageToCustomer(event.target.value)}
                  readOnly={!isDraft}
                  rows={4}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-neutral-700 outline-none transition",
                    isDraft
                      ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                      : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                  )}
                />
              </div>
            </section>

            <EditableLineItemsTable
              title="Line Items"
              subtitle={isDraft ? "Adjust scope, add products, and save the draft before sending." : "Sent invoices are read-only and locked for collections."}
              items={items}
              readOnly={!isDraft}
              onChange={setItems}
            />

            {errorMessage ? (
              <section className="rounded-[28px] border border-error/20 bg-error-light px-5 py-4 text-sm text-error">
                {errorMessage}
              </section>
            ) : null}
          </div>

          <aside className="space-y-6">
            <section className="surface-card px-5 py-5">
              {isPaid ? (
                <div className="rounded-[24px] border border-success/20 bg-success-light px-4 py-4">
                  <p className="text-sm font-semibold text-success">Payment received</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    <CurrencyDisplay value={invoice.amountPaid} showCents className="font-semibold text-neutral-900" /> collected
                    {invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""}.
                  </p>
                </div>
              ) : isOverdue ? (
                <div className="rounded-[24px] border border-error/20 bg-error-light px-4 py-4">
                  <p className="text-sm font-semibold text-error">Invoice overdue</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    Balance due: <CurrencyDisplay value={invoice.balanceDue} showCents className="font-semibold text-neutral-900" />
                  </p>
                </div>
              ) : isUnpaid ? (
                <div className="rounded-[24px] border border-brand-accent/15 bg-brand-accent-light/35 px-4 py-4">
                  <p className="text-sm font-semibold text-brand-accent">Awaiting payment</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    Balance due: <CurrencyDisplay value={invoice.balanceDue} showCents className="font-semibold text-neutral-900" />
                  </p>
                </div>
              ) : null}

              <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4 text-sm">
                <div className="flex items-center justify-between gap-3 text-neutral-500">
                  <span>Subtotal</span>
                  <CurrencyDisplay value={isDraft ? totals.subtotal : invoice.subtotal} showCents />
                </div>
                <div className="flex items-center justify-between gap-3 text-neutral-500">
                  <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
                  <CurrencyDisplay value={isDraft ? totals.taxAmount : invoice.taxAmount} showCents />
                </div>
                <div className="flex items-center justify-between gap-3 text-neutral-500">
                  <span>Discount</span>
                  {isDraft ? (
                    <input
                      value={discountAmount}
                      onChange={(event) => setDiscountAmount(event.target.value)}
                      className="w-24 rounded-xl border border-neutral-200 bg-white px-2 py-1 text-right text-sm text-neutral-900 outline-none transition focus:border-brand-accent"
                    />
                  ) : (
                    <CurrencyDisplay value={invoice.discountAmount} showCents />
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-neutral-200 pt-4">
                <div className="flex items-center justify-between gap-3 text-base font-semibold text-neutral-900">
                  <span>Total</span>
                  <CurrencyDisplay value={isDraft ? totals.total : invoice.total} showCents className="text-2xl" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-neutral-500">
                  <span>Paid</span>
                  <CurrencyDisplay value={invoice.amountPaid} showCents />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900">
                  <span>Balance Due</span>
                  <CurrencyDisplay value={invoice.balanceDue} showCents />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {isDraft ? (
                  <>
                    <button
                      type="button"
                      disabled={saveState === "saving"}
                      onClick={() => {
                        void handleSaveDraft();
                      }}
                      className="w-full rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saveState === "saving" ? "Saving..." : "Save Draft"}
                    </button>
                    <button
                      type="button"
                      disabled={sendInvoice.isPending}
                      onClick={() => setConfirmAction("send")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Send className="h-4 w-4" />
                      {sendInvoice.isPending ? "Sending..." : "Send Payment Link"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={sendInvoice.isPending}
                      onClick={() => setConfirmAction("send")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Send className="h-4 w-4" />
                      {sendInvoice.isPending ? "Sending..." : "Send Payment Link"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecordPaymentOpen(true)}
                      className="w-full rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Record Payment
                    </button>

                    {isOverdue ? (
                      <button
                        type="button"
                        disabled={resendReminder.isPending}
                        onClick={() => setConfirmAction("remind")}
                        className="w-full rounded-full border border-error/25 px-5 py-3 text-sm font-semibold text-error transition hover:bg-error-light disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {resendReminder.isPending ? "Sending..." : "Send Reminder"}
                      </button>
                    ) : null}

                    {invoice.status !== "void" ? (
                      <button
                        type="button"
                        onClick={() => setVoidOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-600 transition hover:border-error/30 hover:text-error"
                      >
                        <Trash2 className="h-4 w-4" />
                        Void Invoice
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              <p className={cn("mt-3 text-xs", saveState === "saved" ? "text-success" : "text-neutral-400")}>
                {saveState === "saved" ? "Draft saved." : isDraft ? "Draft changes are saved manually from this panel." : "Payment actions update the invoice immediately."}
              </p>
            </section>

            <section className="surface-card px-5 py-5">
              <h3 className="text-sm font-semibold text-neutral-900">Payment Link</h3>
              <div className="mt-4 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="break-all text-sm text-brand-accent">
                  {invoice.stripePaymentLinkUrl ?? publicPaymentUrl ?? "Send the invoice to generate a customer payment link."}
                </p>
              </div>
              {publicPaymentUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(publicPaymentUrl);
                  }}
                  className="mt-3 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
                >
                  Copy Renvani Link
                </button>
              ) : null}
            </section>

            {invoice.payments.length > 0 ? (
              <section className="surface-card px-5 py-5">
                <h3 className="text-sm font-semibold text-neutral-900">Payments</h3>
                <div className="mt-4 space-y-3">
                  {invoice.payments.map((payment) => (
                    <div key={payment.id} className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">
                          <CurrencyDisplay value={payment.amount} showCents />
                        </p>
                        <StatBadge label={formatStatusLabel(payment.status)} tone={payment.status === "succeeded" ? "green" : "orange"} />
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">
                        {formatStatusLabel(payment.method)}
                        {payment.paidAt ? ` • ${formatDate(payment.paidAt)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </PageLayout>

      <RecordPaymentModal
        open={recordPaymentOpen}
        balanceDue={invoice.balanceDue}
        isPending={recordPayment.isPending}
        onClose={() => setRecordPaymentOpen(false)}
        onSubmit={async (input) => {
          try {
            await recordPayment.mutateAsync(input);
            setRecordPaymentOpen(false);
            await invoiceQuery.refetch();
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Payment could not be recorded.");
          }
        }}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === "remind" ? "Send payment reminder?" : "Send payment link?"}
        description={invoiceConfirmDescription(confirmAction ?? "send", invoice.customer, invoice.balanceDue)}
        confirmLabel={confirmAction === "remind" ? "Send reminder" : "Send invoice"}
        isPending={sendInvoice.isPending || resendReminder.isPending}
        onCancel={() => {
          if (sendInvoice.isPending || resendReminder.isPending) {
            return;
          }
          setConfirmAction(null);
        }}
        onConfirm={() => {
          const action = confirmAction;
          const mutation = action === "remind" ? resendReminder : sendInvoice;
          void mutation
            .mutateAsync()
            .then(() => invoiceQuery.refetch())
            .catch((error: unknown) => {
              setErrorMessage(
                error instanceof Error ? error.message : action === "remind" ? "Reminder could not be sent." : "Invoice could not be sent."
              );
            })
            .finally(() => setConfirmAction(null));
        }}
      />

      <Sheet
        open={voidOpen}
        onClose={() => {
          setVoidOpen(false);
          setVoidForm(defaultVoidState);
        }}
        title="Void Invoice"
        description="Voiding requires a reason and cannot be undone."
      >
        <div className="space-y-5 px-6 py-6">
          <div className="rounded-[24px] border border-warning/20 bg-warning-light px-4 py-4 text-sm text-neutral-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>The invoice will be marked void and removed from active collections once confirmed.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Reason</label>
            <textarea
              value={voidForm.reason}
              onChange={(event) => setVoidForm({ reason: event.target.value })}
              rows={4}
              placeholder="Why is this invoice being voided?"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={() => {
                setVoidOpen(false);
                setVoidForm(defaultVoidState);
              }}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={voidInvoice.isPending || voidForm.reason.trim().length === 0}
              onClick={() => {
                void voidInvoice
                  .mutateAsync(voidForm.reason.trim())
                  .then(async () => {
                    setVoidOpen(false);
                    setVoidForm(defaultVoidState);
                    await invoiceQuery.refetch();
                  })
                  .catch((error: unknown) => {
                    setErrorMessage(error instanceof Error ? error.message : "Invoice could not be voided.");
                  });
              }}
              className="rounded-full bg-error px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {voidInvoice.isPending ? "Voiding..." : "Void Invoice"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
