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
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useCustomers, useCustomerJobs } from "@/src/hooks/customers.hooks";
import { useEstimates } from "@/src/hooks/estimates.hooks";
import {
  useCreateInvoice,
  useInvoices,
  type InvoiceListRecord
} from "@/src/hooks/invoices.hooks";
import { cn, formatDate } from "@/src/lib/utils";
import {
  formatStatusLabel,
  getInvoiceStatusTone,
  parseMoneyValue
} from "@/src/components/estimates/estimates.utils";

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

function buildInvoiceSummary(records: InvoiceListRecord[]) {
  const outstanding = records.filter((invoice) =>
    ["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status)
  );
  const overdue = records.filter((invoice) => invoice.status === "overdue");
  const paidThisMonth = records.filter((invoice) => {
    if (invoice.status !== "paid" || !invoice.paidAt) {
      return false;
    }

    const paidAt = new Date(invoice.paidAt);
    const now = new Date();
    return paidAt.getMonth() === now.getMonth() && paidAt.getFullYear() === now.getFullYear();
  });
  const drafts = records.filter((invoice) => invoice.status === "draft");

  return [
    {
      label: "Outstanding",
      tone: "orange" as const,
      total: outstanding.reduce((sum, invoice) => sum + parseMoneyValue(invoice.balanceDue), 0),
      count: outstanding.length
    },
    {
      label: "Overdue",
      tone: "red" as const,
      total: overdue.reduce((sum, invoice) => sum + parseMoneyValue(invoice.balanceDue), 0),
      count: overdue.length
    },
    {
      label: "Paid This Month",
      tone: "green" as const,
      total: paidThisMonth.reduce((sum, invoice) => sum + parseMoneyValue(invoice.amountPaid), 0),
      count: paidThisMonth.length
    },
    {
      label: "Draft",
      tone: "gray" as const,
      total: drafts.reduce((sum, invoice) => sum + parseMoneyValue(invoice.total), 0),
      count: drafts.length
    }
  ];
}

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

function InvoiceSummaryCards({ records }: { records: InvoiceListRecord[] }) {
  const summary = buildInvoiceSummary(records);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summary.map((card) => (
        <div key={card.label} className="surface-card px-5 py-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "h-10 w-10 rounded-2xl",
                card.tone === "orange" && "bg-warning-light",
                card.tone === "red" && "bg-error-light",
                card.tone === "green" && "bg-success-light",
                card.tone === "gray" && "bg-neutral-100"
              )}
            />
            <div>
              <p className="text-sm font-medium text-neutral-500">{card.label}</p>
              <CurrencyDisplay value={card.total} className="mt-1 block text-3xl font-semibold tracking-tight text-neutral-900" showCents />
            </div>
          </div>
          <p className="mt-3 text-sm text-neutral-500">
            {card.count} {card.count === 1 ? "invoice" : "invoices"}
          </p>
        </div>
      ))}
    </div>
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
    limit: 200,
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
        subtitle="Track payment state, resend payment links, and keep collections moving."
        actions={(
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        )}
      >
        <div className="space-y-6">
          <InvoiceSummaryCards records={allInvoices} />

          <section className="surface-card overflow-hidden">
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
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                    <tr>
                      <th className="px-5 py-4">Invoice #</th>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Job</th>
                      <th className="px-5 py-4">Total</th>
                      <th className="px-5 py-4">Amount Due</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Due Date</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {visibleInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className={cn(
                          "transition hover:bg-brand-accent-light/40",
                          invoice.status === "overdue" && "bg-error-light/35"
                        )}
                      >
                        <td className="px-5 py-4 font-semibold text-brand-accent">{invoice.invoiceNumber}</td>
                        <td className="px-5 py-4 text-neutral-700">
                          {invoice.customer.firstName} {invoice.customer.lastName}
                        </td>
                        <td className="px-5 py-4 text-neutral-500">{invoice.title ?? "General invoice"}</td>
                        <td className="px-5 py-4 text-neutral-700">
                          <CurrencyDisplay value={invoice.total} showCents />
                        </td>
                        <td className="px-5 py-4 font-semibold text-neutral-900">
                          <CurrencyDisplay value={invoice.balanceDue} showCents />
                        </td>
                        <td className="px-5 py-4">
                          <StatBadge
                            label={formatStatusLabel(invoice.status)}
                            tone={getInvoiceStatusTone(invoice.status)}
                          />
                        </td>
                        <td className="px-5 py-4 text-neutral-500">
                          {invoice.dueAt ? formatDate(invoice.dueAt) : "—"}
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
