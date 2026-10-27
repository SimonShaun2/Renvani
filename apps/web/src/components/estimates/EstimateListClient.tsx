"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useEstimates } from "@/src/hooks/estimates.hooks";
import { cn, formatDate } from "@/src/lib/utils";

import {
  formatStatusLabel,
  getEstimateStatusTone,
  groupEstimateList,
  matchesEstimateFilter,
  type EstimateFilter
} from "./estimates.utils";

const filterOptions: Array<{ value: EstimateFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "revised", label: "Revised" },
  { value: "converted", label: "Converted" }
];

const LIST_LIMIT = 200;

export function EstimateListClient() {
  const [filter, setFilter] = useState<EstimateFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const estimatesQuery = useEstimates({
    page: 1,
    limit: LIST_LIMIT,
    sortBy: "createdAt",
    sortOrder: "desc"
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  const groupedRows = useMemo(() => {
    const grouped = groupEstimateList(estimatesQuery.data?.data ?? []);
    const normalizedSearch = search.trim().toLowerCase();

    return grouped.filter((row) => {
      if (!matchesEstimateFilter(row.status, filter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const customerName = `${row.customer.firstName} ${row.customer.lastName}`.trim().toLowerCase();
      return (
        row.estimateNumber.toLowerCase().includes(normalizedSearch) ||
        (row.title ?? "").toLowerCase().includes(normalizedSearch) ||
        customerName.includes(normalizedSearch)
      );
    });
  }, [estimatesQuery.data?.data, filter, search]);

  const pageCount = Math.max(1, Math.ceil(groupedRows.length / 25));
  const visibleRows = groupedRows.slice((page - 1) * 25, page * 25);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  if (estimatesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[116px]" />
        <SkeletonCard className="h-[560px]" />
      </div>
    );
  }

  return (
    <PageLayout
      title="Estimates"
      subtitle="Build single quotes or Good / Better / Best options and keep approvals moving."
      actions={(
        <Link
          href="/estimates/new"
          className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary"
        >
          <Plus className="h-4 w-4" />
          New Estimate
        </Link>
      )}
    >
      {(estimatesQuery.data?.total ?? 0) > LIST_LIMIT ? (
        <p className="mb-3 text-sm text-neutral-500" role="status">
          Showing the {LIST_LIMIT} most recent estimates. Use search to find older quotes.
        </p>
      ) : null}
      <section className="surface-card overflow-hidden" data-estimates-reveal>
        <div className="flex flex-col gap-4 border-b border-neutral-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {filterOptions.map((option) => (
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
              placeholder="Search estimates, customers..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
            />
          </label>
        </div>

        {visibleRows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={FileText}
              title="No estimates match this view"
              subtitle="Try a different filter or create a new estimate to get a quote moving."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                <tr>
                  <th className="px-5 py-4">Estimate #</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Sent</th>
                  <th className="px-5 py-4">Expires</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleRows.map((estimate) => (
                  <tr key={estimate.id} className="transition hover:bg-brand-accent-light/35">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-accent">{estimate.estimateNumber}</span>
                        {estimate.tierCount > 1 ? (
                          <StatBadge label={`${estimate.tierCount} tiers`} tone="purple" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {estimate.customer.firstName} {estimate.customer.lastName}
                    </td>
                    <td className="px-5 py-4 text-neutral-700">{estimate.title ?? "Untitled estimate"}</td>
                    <td className="px-5 py-4 font-semibold text-neutral-900">
                      <CurrencyDisplay value={estimate.total} showCents />
                    </td>
                    <td className="px-5 py-4">
                      <StatBadge
                        label={formatStatusLabel(estimate.status)}
                        tone={getEstimateStatusTone(estimate.status)}
                      />
                    </td>
                    <td className="px-5 py-4 text-neutral-500">
                      {estimate.sentAt ? formatDate(estimate.sentAt) : "—"}
                    </td>
                    <td className="px-5 py-4 text-neutral-500">
                      {estimate.expiresAt ? formatDate(estimate.expiresAt) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/estimates/${estimate.estimateId}`}
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
            Showing {visibleRows.length === 0 ? 0 : (page - 1) * 25 + 1}-{Math.min(page * 25, groupedRows.length)} of{" "}
            {groupedRows.length}
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
    </PageLayout>
  );
}
