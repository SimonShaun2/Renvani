"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Sheet } from "@/src/components/ui/Sheet";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useCustomers, useCustomerJobs } from "@/src/hooks/customers.hooks";
import { useEstimates } from "@/src/hooks/estimates.hooks";
import {
  useCreateInvoice,
  useInvoices,
  useSucceededPaymentsSince,
  type InvoiceListRecord
} from "@/src/hooks/invoices.hooks";
import { cn, formatDate } from "@/src/lib/utils";
import {
  buildInvoiceKpis,
  getInvoiceRowState,
  isCompletePage,
  sumSucceededPayments,
  type InvoiceRowTone
} from "@/src/components/invoices/invoice-list.utils";
import "@/src/components/invoices/invoices-motion.css";

type InvoiceFilter = "all" | "draft" | "sent" | "partially_paid" | "overdue" | "paid";

interface CreateInvoiceFormState {
  customerId: string;
  jobId: string;
  estimateId: string;
  title: string;
}

const invoiceFilterOptions: Array<{ value: InvoiceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" }
];

const defaultCreateState: CreateInvoiceFormState = {
  customerId: "",
  jobId: "",
  estimateId: "",
  title: ""
};

function filterInvoices(records: InvoiceListRecord[], search: string, filter: InvoiceFilter) {
  const normalizedSearch = search.trim().toLowerCase();

  return records.filter((invoice) => {
    if (filter !== "all" && invoice.status !== filter) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const customerName = `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim().toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
      (invoice.title ?? "").toLowerCase().includes(normalizedSearch) ||
      customerName.includes(normalizedSearch)
    );
  });
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function KpiCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#0f1530]">{value}</p>
      <p className="mt-2 text-xs text-[#5e6684]">{caption}</p>
    </div>
  );
}

const UNAVAILABLE = "Not available yet";
const plural = (count: number) => `${count} ${count === 1 ? "invoice" : "invoices"}`;

export function InvoiceKpiCards({
  invoices,
  invoicesComplete,
  collected,
  now
}: {
  invoices: InvoiceListRecord[];
  invoicesComplete: boolean;
  collected: { total: number; count: number } | null;
  now: Date;
}) {
  const kpis = invoicesComplete ? buildInvoiceKpis(invoices, now) : null;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="invoice-kpis">
      <KpiCard
        label={`Collected · ${MONTH_LABEL.format(now)}`}
        value={collected ? usd.format(collected.total) : "—"}
        caption={collected ? `${collected.count} ${collected.count === 1 ? "payment" : "payments"}` : UNAVAILABLE}
      />
      <KpiCard
        label="Outstanding"
        value={kpis ? usd.format(kpis.outstanding.total) : "—"}
        caption={kpis ? plural(kpis.outstanding.count) : UNAVAILABLE}
      />
      <KpiCard
        label="Overdue > 7 days"
        value={kpis ? usd.format(kpis.overdue7.total) : "—"}
        caption={kpis ? plural(kpis.overdue7.count) : UNAVAILABLE}
      />
      <KpiCard label="Avg. days to pay" value="—" caption={UNAVAILABLE} />
    </div>
  );
}

const rowToneClass: Record<InvoiceRowTone, string> = {
  green: "bg-[#e5f4ea] text-[#1f6b3a]",
  amber: "bg-[#fff4d6] text-[#7a5600]",
  red: "bg-[#fde4df] text-[#a3261a]",
  neutral: "bg-[#efe9df] text-[#5e6684]"
};

export function InvoiceStatePill({ state }: { state: { label: string; tone: InvoiceRowTone } }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", rowToneClass[state.tone])}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {state.label}
    </span>
  );
}

export function InvoiceListClient() {
  const router = useRouter();
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateInvoiceFormState>(defaultCreateState);
  const [createError, setCreateError] = useState<string | null>(null);

  const invoicesQuery = useInvoices({
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });
  const customersQuery = useCustomers({
    page: 1,
    limit: 100,
    sortBy: "lastName",
    sortOrder: "asc"
  });
  const customerJobsQuery = useCustomerJobs(createForm.customerId || null, {
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });
  const customerEstimatesQuery = useEstimates({
    ...(createForm.customerId ? { customerId: createForm.customerId } : {}),
    status: "approved",
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });
  const createInvoice = useCreateInvoice();
  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), [now]);
  const paymentsQuery = useSucceededPaymentsSince(monthStart);
  const collected = isCompletePage(paymentsQuery.data)
    ? { total: sumSucceededPayments(paymentsQuery.data!.data), count: paymentsQuery.data!.data.length }
    : null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  const allInvoices = invoicesQuery.data?.data ?? [];
  const filteredInvoices = useMemo(
    () => filterInvoices(allInvoices, search, filter),
    [allInvoices, filter, search]
  );
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / 25));
  const visibleInvoices = filteredInvoices.slice((page - 1) * 25, page * 25);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  if (invoicesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[116px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} className="h-[134px]" />
          ))}
        </div>
        <SkeletonCard className="h-[560px]" />
      </div>
    );
  }

  return (
    <>
      <PageLayout
        title="Invoices"
        subtitle={`${new Intl.DateTimeFormat("en-US", { month: "long" }).format(now)} · payment state across your invoices`}
        actions={(
          <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Invoice export isn't available yet"
            className="rounded-[10px] border border-[#e6dccb] bg-white px-5 py-3 text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#0f1530] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New invoice
          </button>
          </div>
        )}
      >
        <div className="space-y-6">
          <InvoiceKpiCards
            invoices={allInvoices}
            invoicesComplete={isCompletePage(invoicesQuery.data)}
            collected={collected}
            now={now}
          />

          <section className="overflow-hidden rounded-[14px] border border-[#e6dccb] bg-white">
            <div className="flex flex-col gap-4 border-b border-neutral-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {invoiceFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFilter(option.value);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      filter === option.value
                        ? "bg-brand-accent text-white"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="flex min-w-0 items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 lg:w-[320px]">
                <Search className="h-4 w-4 text-neutral-400" />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search invoices, customers..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
                />
              </label>
            </div>

            {invoicesQuery.isError ? (
          <div className="px-5 py-10">
            <ErrorState
              title="Invoices could not be loaded"
              onRetry={() => void invoicesQuery.refetch()}
              isRetrying={invoicesQuery.isFetching}
            />
          </div>
        ) : visibleInvoices.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyState
                  icon={FileText}
                  title="No invoices match this view"
                  subtitle="Try a different filter or create a new invoice to start tracking payments."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-[#e6dccb] bg-[#fbf6ef] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">
                    <tr>
                      <th className="px-5 py-4">Invoice</th>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Details</th>
                      <th className="px-5 py-4">Amount</th>
                      <th className="px-5 py-4">State</th>
                      <th className="px-5 py-4 text-right"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {visibleInvoices.map((invoice) => (
                      <tr key={invoice.id} className="invoice-row-in transition hover:bg-[#fbf6ef]">
                        <td className="px-5 py-4 font-semibold text-[#0f1530]">{invoice.invoiceNumber}</td>
                        <td className="px-5 py-4 text-[#0f1530]">
                          {invoice.customer.firstName} {invoice.customer.lastName}
                        </td>
                        <td className="px-5 py-4 text-[#5e6684]">
                          {formatDate(invoice.createdAt)} · {invoice.title ?? "General invoice"}
                        </td>
                        <td className="px-5 py-4 text-[#0f1530]">
                          <CurrencyDisplay value={invoice.total} showCents />
                        </td>
                        <td className="px-5 py-4">
                          <InvoiceStatePill state={getInvoiceRowState(invoice, now)} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="inline-flex rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-brand-accent transition hover:bg-brand-accent-light"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-4 text-sm text-neutral-500">
              <p>
                Showing {visibleInvoices.length === 0 ? 0 : (page - 1) * 25 + 1}-
                {Math.min(page * 25, filteredInvoices.length)} of {filteredInvoices.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-full border border-neutral-200 px-4 py-2 font-semibold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 text-neutral-400">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  className="rounded-full border border-neutral-200 px-4 py-2 font-semibold text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      </PageLayout>

      <Sheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm(defaultCreateState);
          setCreateError(null);
        }}
        title="New Invoice"
        description="Create a blank draft invoice or start from an approved estimate."
      >
        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Customer</label>
            <select
              value={createForm.customerId}
              onChange={(event) =>
                setCreateForm({
                  customerId: event.target.value,
                  jobId: "",
                  estimateId: "",
                  title: ""
                })
              }
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
            >
              <option value="">Select customer</option>
              {(customersQuery.data?.data ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName ?? `${customer.firstName} ${customer.lastName}`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Related Job (optional)</label>
              <select
                value={createForm.jobId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    jobId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
                disabled={!createForm.customerId}
              >
                <option value="">No related job</option>
                {(customerJobsQuery.data?.data ?? []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.jobNumber} — {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Approved Estimate (optional)</label>
              <select
                value={createForm.estimateId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    estimateId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
                disabled={!createForm.customerId}
              >
                <option value="">Blank invoice</option>
                {(customerEstimatesQuery.data?.data ?? []).map((estimate) => (
                  <option key={estimate.id} value={estimate.id}>
                    {estimate.estimateNumber} — {estimate.title ?? "Estimate"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Title</label>
            <input
              value={createForm.title}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
              placeholder="Quarterly maintenance invoice"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
            />
          </div>

          {createError ? (
            <p className="rounded-2xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
              {createError}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setCreateForm(defaultCreateState);
                setCreateError(null);
              }}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createInvoice.isPending}
              onClick={() => {
                if (!createForm.customerId) {
                  setCreateError("Select a customer before creating an invoice.");
                  return;
                }

                setCreateError(null);

                void createInvoice
                  .mutateAsync({
                    customerId: createForm.customerId,
                    ...(createForm.jobId ? { jobId: createForm.jobId } : {}),
                    ...(createForm.title ? { title: createForm.title.trim() } : {}),
                    ...(createForm.estimateId ? { fromEstimateId: createForm.estimateId } : {})
                  })
                  .then((response) => {
                    setCreateOpen(false);
                    setCreateForm(defaultCreateState);
                    router.push(`/invoices/${response.invoice.id}`);
                  })
                  .catch((error: unknown) => {
                    setCreateError(
                      error instanceof Error ? error.message : "Invoice could not be created."
                    );
                  });
              }}
              className="rounded-full bg-brand-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createInvoice.isPending ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
