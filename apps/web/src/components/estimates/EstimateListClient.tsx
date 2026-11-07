"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useEstimateGroups } from "@/src/hooks/estimate-groups.hooks";
import { cn, formatDate } from "@/src/lib/utils";


import {
  formatStatusLabel,
  getEstimateStatusTone,
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

const PAGE_SIZE = 25;

export function EstimateListClient() {
  const [filter, setFilter] = useState<EstimateFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const estimatesQuery = useEstimateGroups({
    page,
    limit: PAGE_SIZE,
    ...(filter !== "all" ? { status: filter } : {}),
    ...(search.trim() ? { search: search.trim() } : {})
  });

  useEffect(() => {
    if (searchDraft.trim() === search) return;
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft, search]);

  const result = estimatesQuery.isError ? undefined : estimatesQuery.data;
  const visibleRows = result?.data ?? [];
  const pageCount = Math.max(1, result?.totalPages ?? 1);
  const loading = estimatesQuery.isLoading;
  const unavailable = estimatesQuery.isError || (!loading && !result);

  useEffect(() => {
    if (result && !estimatesQuery.isFetching && page > pageCount) setPage(pageCount);
  }, [result, estimatesQuery.isFetching, page, pageCount]);

  return (
    <PageLayout
      variant="operator"
      title="Estimates"
      subtitle="Build single quotes or Good / Better / Best options and keep approvals moving."
      actions={(
        <Link
          href="/estimates/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#f6b400] px-5 py-3 text-sm font-semibold text-[#0f1530] transition hover:bg-[#e0a400]"
        >
          <Plus className="h-4 w-4" />
          New Estimate
        </Link>
      )}
    >
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
                    ? "bg-[#f6b400] text-[#0f1530]"
                    : "bg-[#f3eadc] text-[#2a3360] hover:bg-[#fff4d6]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="flex min-w-0 items-center gap-3 rounded-[10px] border border-[#e6dccb] bg-white px-4 py-3 lg:w-[320px]">
            <Search className="h-4 w-4 text-neutral-400" />
            <input
              aria-label="Search estimates and customers"
              maxLength={200}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search estimates, customers..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
            />
          </label>
        </div>

        {loading ? (
          <div className="px-5 py-10" role="status" aria-label="Loading estimates">
            <SkeletonCard className="h-[240px]" />
          </div>
        ) : unavailable ? (
          <div className="px-5 py-10">
            <ErrorState
              title="Estimates could not be loaded"
              onRetry={() => void estimatesQuery.refetch()}
              isRetrying={estimatesQuery.isFetching}
            />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState variant="operator"
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
                  <tr key={estimate.id} className="transition hover:bg-[#fff4d6]/45">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2a3360]">{estimate.estimateNumber}</span>
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
                        className="inline-flex rounded-[10px] bg-[#f3eadc] px-4 py-2 text-sm font-semibold text-[#2a3360] transition hover:bg-[#fff4d6]"
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

        {result ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-5 py-4 text-sm text-neutral-500">
            <p role="status">
              Showing {visibleRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{visibleRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + visibleRows.length} of {result.total} quotes
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page === 1 || estimatesQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="min-h-11 rounded-[10px] border border-[#e6dccb] px-4 py-2 font-semibold text-[#2a3360] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <span className="px-2">Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount || estimatesQuery.isFetching}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="min-h-11 rounded-[10px] border border-[#e6dccb] px-4 py-2 font-semibold text-[#2a3360] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}

      </section>
    </PageLayout>
  );
}
