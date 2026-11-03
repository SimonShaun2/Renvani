"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { CalendarClock, RefreshCw, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isRevenueProposalRecommendationType,
  type AiRecommendationDetail,
  type AiRecommendationType
} from "@fsm/types";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import {
  useActionRecommendation,
  useDismissRecommendation,
  useRecommendations,
  useSnoozeRecommendation
} from "@/src/hooks/ai-revenue.hooks";
import { useRevenueSummary } from "@/src/hooks/dashboard.hooks";
import { useProposeRecommendation } from "@/src/hooks/revenue-proposals.hooks";
import { cn } from "@/src/lib/utils";
import { revenueActionButtonLabel, revenueDataState } from "./revenue-center-state";

type RevenueFilter = "all" | "reactivation" | "unsold_estimate" | "unpaid_invoice" | "aging_asset" | "maintenance_plan_offer";
type SortOption = "urgencyScore" | "estimatedRevenue" | "createdAt";

interface CategoryCard {
  id: RevenueFilter;
  label: string;
  count: number;
  value: string;
  tone: "purple" | "orange" | "red" | "blue" | "gold";
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 }
};

const categoryToneClasses: Record<CategoryCard["tone"], string> = {
  purple: "bg-[#e9ecf8] text-[#2a3360]",
  orange: "bg-[#fff4d6] text-[#7a5600]",
  red: "bg-[#fbe3dc] text-[#b42318]",
  blue: "bg-[#e6eef8] text-[#2a3360]",
  gold: "bg-[#fff4d6] text-[#7a5600]"
};

function getTypeLabel(type: AiRecommendationType): string {
  switch (type) {
    case "reactivation":
      return "Dormant Customer";
    case "aging_asset":
      return "Aging Asset";
    case "maintenance_due":
      return "Maintenance Due";
    case "unsold_estimate":
      return "Unsold Estimate";
    case "unpaid_invoice":
      return "Unpaid Invoice";
    case "upsell_opportunity":
      return "Upsell Opportunity";
    case "seasonal_campaign":
      return "Seasonal Campaign";
    case "maintenance_plan_offer":
      return "Missing Agreement";
    default:
      return "AI Opportunity";
  }
}

function getUrgencyTone(score: number | null): "red" | "orange" | "gray" {
  if ((score ?? 0) >= 80) {
    return "red";
  }

  if ((score ?? 0) >= 60) {
    return "orange";
  }

  return "gray";
}

function getUrgencyLabel(score: number | null): string {
  if (score === null) return "Unrated";
  if (score >= 85) {
    return "Urgent";
  }

  if ((score ?? 0) >= 60) {
    return "High";
  }

  return "Low";
}

function getTomorrowDateValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toSnoozeIso(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

function buildCategoryCards(summary: NonNullable<ReturnType<typeof useRevenueSummary>["data"]>): CategoryCard[] {
  return [
    {
      id: "reactivation",
      label: "Dormant Customers",
      count: summary.dormantCustomers.count,
      value: summary.dormantCustomers.estimatedRevenue,
      tone: "purple"
    },
    {
      id: "unsold_estimate",
      label: "Unsold Estimates",
      count: summary.unsoldEstimates.count,
      value: summary.unsoldEstimates.totalValue,
      tone: "gold"
    },
    {
      id: "unpaid_invoice",
      label: "Unpaid Invoices",
      count: summary.unpaidInvoices.count,
      value: summary.unpaidInvoices.totalValue,
      tone: "red"
    },
    {
      id: "aging_asset",
      label: "Aging Assets",
      count: summary.agingAssets.count,
      value: summary.agingAssets.estimatedRevenue,
      tone: "orange"
    },
    {
      id: "maintenance_plan_offer",
      label: "Missing Agreements",
      count: summary.maintenancePlanOpportunities.count,
      value: summary.maintenancePlanOpportunities.estimatedRevenue,
      tone: "blue"
    }
  ];
}

function RecommendationRow({
  recommendation,
  expandedId,
  onToggleWhy,
  onAction,
  onDismiss,
  onSnooze,
  isActioning
}: {
  recommendation: AiRecommendationDetail;
  expandedId: string | null;
  onToggleWhy: (id: string) => void;
  onAction: (recommendation: AiRecommendationDetail) => Promise<void>;
  onDismiss: (recommendation: AiRecommendationDetail) => void;
  onSnooze: (recommendation: AiRecommendationDetail) => void;
  isActioning: boolean;
}) {
  const customerName = recommendation.customer
    ? `${recommendation.customer.firstName} ${recommendation.customer.lastName}`.trim()
    : null;
  const urgencyTone = getUrgencyTone(recommendation.urgencyScore);
  const actionLabel = revenueActionButtonLabel(isRevenueProposalRecommendationType(recommendation.type));

  return (
    <div className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-5 transition hover:border-[#f6b400]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold",
                urgencyTone === "red" && "bg-error-light text-error",
                urgencyTone === "orange" && "bg-warning-light text-warning",
                urgencyTone === "gray" && "bg-neutral-100 text-neutral-500"
              )}
            >
              {recommendation.urgencyScore ?? "—"}
            </div>
            <StatBadge label={getTypeLabel(recommendation.type)} tone="gray" />
            <StatBadge
              label={getUrgencyLabel(recommendation.urgencyScore)}
              tone={urgencyTone === "red" ? "red" : urgencyTone === "orange" ? "orange" : "neutral"}
            />
          </div>

          <h3 className="mt-4 text-lg font-semibold tracking-tight text-neutral-900">{recommendation.headline}</h3>
          <p className="mt-2 text-sm leading-7 text-neutral-500">{recommendation.body}</p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
            {customerName && recommendation.customer ? (
              <Link href={`/customers/${recommendation.customer.id}`} className="font-medium text-brand-accent hover:text-brand-primary">
                {customerName}
              </Link>
            ) : null}
            {recommendation.estimate ? <span>{recommendation.estimate.estimateNumber}</span> : null}
            {recommendation.invoice ? <span>{recommendation.invoice.invoiceNumber}</span> : null}
            {recommendation.asset ? <span>{recommendation.asset.name}</span> : null}
            <span>
              Est. value:{" "}
              <CurrencyDisplay value={recommendation.estimatedRevenue} fallback="—" className="font-semibold text-[#0f1530]" />
            </span>
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col gap-3 xl:items-end">
          <button
            type="button"
            onClick={() => {
              void onAction(recommendation);
            }}
            disabled={isActioning}
            className={cn(
              "inline-flex min-w-[164px] items-center justify-center rounded-[10px] px-4 py-3 text-sm font-semibold transition",
              isRevenueProposalRecommendationType(recommendation.type) ? "bg-[#f6b400] text-[#0f1530] hover:bg-[#e0a400]" : "border border-[#0f1530] bg-white text-[#0f1530] hover:bg-[#f3eadc]",
              isActioning && "cursor-not-allowed opacity-70"
            )}
          >
            {isActioning ? "Working..." : actionLabel}
          </button>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
            <button type="button" onClick={() => onDismiss(recommendation)} className="hover:text-neutral-700">
              Dismiss
            </button>
            <button type="button" onClick={() => onSnooze(recommendation)} className="hover:text-neutral-700">
              Snooze
            </button>
            <button
              type="button"
              onClick={() => onToggleWhy(recommendation.id)}
              className="font-medium text-neutral-500 hover:text-neutral-800"
            >
              Why this?
            </button>
          </div>
        </div>
      </div>

      {expandedId === recommendation.id ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm leading-7 text-neutral-600">
          <p>{recommendation.body}</p>
          {recommendation.suggestedMessage ? (
            <div className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-500">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Suggested message</p>
              <p className="mt-2">{recommendation.suggestedMessage}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Overlay({
  title,
  subtitle,
  onClose,
  children
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/35 px-4">
      <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-[0_30px_90px_rgba(16,33,99,0.24)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function AiRevenueCenterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const summaryQuery = useRevenueSummary();
  const customerIdFilter = searchParams.get("customerId");
  const [selectedType, setSelectedType] = useState<RevenueFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgencyScore");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<AiRecommendationDetail | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [snoozeTarget, setSnoozeTarget] = useState<AiRecommendationDetail | null>(null);
  const [snoozeDate, setSnoozeDate] = useState(getTomorrowDateValue());
  const [snoozeError, setSnoozeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const actionMutation = useActionRecommendation();
  const proposeMutation = useProposeRecommendation();
  const dismissMutation = useDismissRecommendation();
  const snoozeMutation = useSnoozeRecommendation();

  useEffect(() => {
    const value = searchParams.get("type");
    const allowed: RevenueFilter[] = [
      "all",
      "reactivation",
      "unsold_estimate",
      "unpaid_invoice",
      "aging_asset",
      "maintenance_plan_offer"
    ];

    if (value && allowed.includes(value as RevenueFilter)) {
      setSelectedType(value as RevenueFilter);
      setPage(1);
      return;
    }

    setSelectedType("all");
  }, [searchParams]);

  const recommendationsQuery = useRecommendations({
    status: "pending",
    limit: 25,
    page,
    sortBy,
    sortOrder: "desc",
    ...(customerIdFilter ? { customerId: customerIdFilter } : {}),
    ...(selectedType !== "all" ? { type: selectedType } : {})
  });

  const recommendations = recommendationsQuery.isError ? [] : recommendationsQuery.data?.data ?? [];

  // This refreshes stored results; a new background scan requires a separate authorized job.
  async function handleRefreshView() {
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      const [summary, list] = await Promise.all([summaryQuery.refetch(), recommendationsQuery.refetch()]);
      if (summary.isError || list.isError || !summary.data || !list.data) {
        setRefreshNotice({ type: "error", message: "Revenue data could not be refreshed. The previous view may be out of date." });
      } else {
        setRefreshNotice({ type: "success", message: "Saved opportunity results refreshed. Automated opportunity checks run separately." });
      }
    } catch {
      setRefreshNotice({ type: "error", message: "Revenue data could not be refreshed. Try again." });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAction(recommendation: AiRecommendationDetail) {
    setActionError(null);
    try {
      if (isRevenueProposalRecommendationType(recommendation.type)) {
        await proposeMutation.mutateAsync(recommendation.id);
        router.push("/command-center/approvals");
        return;
      }

      await actionMutation.mutateAsync({
        id: recommendation.id,
        input: {
          actionTaken: "marked_handled_in_revenue_center"
        }
      });
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "The recommendation could not be updated.");
    }
  }

  async function handleDismiss() {
    if (!dismissTarget) {
      return;
    }

    await dismissMutation.mutateAsync({
      id: dismissTarget.id,
      ...(dismissReason.trim().length > 0 ? { reason: dismissReason.trim() } : {})
    });
    setDismissTarget(null);
    setDismissReason("");
  }

  async function handleSnooze() {
    if (!snoozeTarget) {
      return;
    }

    if (snoozeDate <= format(new Date(), "yyyy-MM-dd")) {
      setSnoozeError("Choose a future date.");
      return;
    }

    await snoozeMutation.mutateAsync({
      id: snoozeTarget.id,
      snoozedUntil: toSnoozeIso(snoozeDate)
    });
    setSnoozeTarget(null);
    setSnoozeDate(getTomorrowDateValue());
    setSnoozeError(null);
  }

  const summaryState = revenueDataState(summaryQuery);
  const categoryCards = summaryState === "ready" && summaryQuery.data ? buildCategoryCards(summaryQuery.data) : [];

  return (
    <div className="space-y-6 text-[#0f1530]">
      <motion.div {...cardMotion} transition={{ duration: 0.32 }}>
        <div className="space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#5e6684]">Renvani / Revenue</p>
              <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
                Find the <span className="font-[family-name:var(--font-mkt-serif)] font-normal italic text-[#2a3360]">hidden revenue.</span>
              </h1>
              <p className="mt-2 max-w-[740px] text-sm leading-6 text-[#5e6684]">
                Review opportunities identified from connected customers, estimates, invoices, equipment, and agreements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void handleRefreshView(); }}
              disabled={refreshing}
              aria-label="Refresh saved revenue opportunities"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#0f1530] bg-[#0f1530] px-[18px] text-sm font-semibold text-white transition hover:bg-[#2a3360] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1530] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : "Refresh view"}
            </button>
          </header>
          {refreshNotice ? (
            <p role={refreshNotice.type === "error" ? "alert" : "status"} className={cn("rounded-[10px] border px-4 py-3 text-[13px]", refreshNotice.type === "error" ? "border-[#f1b3a7] bg-[#fbe3dc] text-[#b42318]" : "border-[#e6dccb] bg-[#fff4d6] text-[#7a5600]")}>
              {refreshNotice.message}
            </p>
          ) : null}
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[16px] border border-[#2a3360] bg-[#0f1530] text-white">
              <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#c3c8da]">Identified revenue opportunity</p>
                  {summaryState === "loading" ? <p role="status" className="mt-3 text-xl text-[#c3c8da]">Loading saved figures…</p> :
                   summaryState !== "ready" || !summaryQuery.data ? <p className="mt-3 text-5xl font-semibold">—</p> :
                   <CurrencyDisplay value={summaryQuery.data.totalOpportunityValue} fallback="—" className="mt-3 block text-5xl font-semibold tracking-tight text-white" />}
                  <p className="mt-3 text-xs leading-5 text-[#c3c8da]">Potential identified in recorded opportunities, not booked revenue.</p>
                </div>
                <div className="text-sm text-white/70">
                  {summaryState === "ready" && summaryQuery.data ? (
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      <span>Summary calculated: {format(parseISO(summaryQuery.data.generatedAt), "MMM d, h:mm a")}</span>
                    </div>
                  ) : (
                    <span>Summary unavailable</span>
                  )}
                </div>
              </div>
            </section>

            {summaryQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }, (_, index) => (
                  <SkeletonCard key={index} className="h-[146px]" />
                ))}
              </div>
            ) : summaryQuery.isError ? (
              <div className="rounded-3xl border border-error/15 bg-error-light px-5 py-5 text-sm text-error">
                <p>Revenue categories could not be loaded.</p>
                <button
                  type="button"
                  onClick={() => {
                    void summaryQuery.refetch();
                  }}
                  className="mt-3 rounded-full bg-white px-3 py-1.5 font-semibold shadow-sm"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {categoryCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(card.id);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-[14px] border bg-white px-5 py-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1530]",
                      selectedType === card.id ? "border-[#f6b400] ring-2 ring-[#fff4d6]" : "border-[#e6dccb] hover:border-[#f6b400]"
                    )}
                  >
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", categoryToneClasses[card.tone])}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-[13px] font-semibold text-[#2a3360]">{card.label}</p>
                    <CurrencyDisplay value={card.value} fallback="—" className="mt-1 block text-[30px] font-semibold tracking-tight text-[#0f1530]" />
                    <p className="mt-2 text-xs text-[#5e6684]">{card.count} recorded opportunities</p>
                  </button>
                ))}
              </div>
            )}

            <section className="rounded-[14px] border border-[#e6dccb] bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-neutral-500">Filter:</span>
                  {[
                    { id: "all", label: "All Types" },
                    { id: "reactivation", label: "Dormant" },
                    { id: "unsold_estimate", label: "Estimates" },
                    { id: "unpaid_invoice", label: "Invoices" },
                    { id: "aging_asset", label: "Assets" },
                    { id: "maintenance_plan_offer", label: "Agreements" }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(filter.id as RevenueFilter);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-semibold transition",
                        selectedType === filter.id ? "bg-[#f6b400] text-[#0f1530]" : "bg-[#f3eadc] text-[#2a3360] hover:bg-[#fff4d6]"
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-3 text-sm text-neutral-500">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setSortBy(event.target.value as SortOption);
                      setPage(1);
                    }}
                    className="min-h-11 rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2 text-sm font-semibold text-[#0f1530] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1530]"
                  >
                    <option value="urgencyScore">Urgency Score</option>
                    <option value="estimatedRevenue">Estimated Revenue</option>
                    <option value="createdAt">Date</option>
                  </select>
                </label>
                {customerIdFilter ? (
                  <div className="rounded-full bg-brand-accent-light px-4 py-2 text-sm font-semibold text-brand-accent">
                    Filtered to one customer
                  </div>
                ) : null}
              </div>
            </section>

            <div className="space-y-4">
              {actionError ? (
                <div role="alert" className="rounded-3xl border border-error/15 bg-error-light px-5 py-4 text-sm text-error">
                  {actionError}
                </div>
              ) : null}
              {recommendationsQuery.isLoading ? (
                Array.from({ length: 5 }, (_, index) => <SkeletonCard key={index} className="h-[228px]" />)
              ) : recommendationsQuery.isError ? (
                <div className="rounded-3xl border border-error/15 bg-error-light px-5 py-5 text-sm text-error">
                  <p>Recommendations could not be loaded.</p>
                  <button
                    type="button"
                    onClick={() => {
                      void recommendationsQuery.refetch();
                    }}
                    className="mt-3 rounded-full bg-white px-3 py-1.5 font-semibold shadow-sm"
                  >
                    Retry
                  </button>
                </div>
              ) : recommendations.length === 0 ? (
                selectedType === "all" && !customerIdFilter ? (
                  <section className="rounded-[14px] border border-[#e6dccb] bg-white px-6 py-10 text-center" aria-label="No identified opportunities">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-[12px] bg-[#fff4d6] text-[#7a5600]"><Sparkles aria-hidden="true" className="size-6" /></div>
                    <h2 className="mt-5 text-xl font-semibold text-[#0f1530]">No recommendations awaiting review</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#5e6684]">Renvani has no pending recommendations in this view. Opportunity totals use your recorded customer, estimate, invoice, equipment, and agreement data. A recorded zero does not mean your business has no potential.</p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <Link href="/onboarding/import" className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#f6b400] px-5 text-sm font-semibold text-[#0f1530] hover:bg-[#e0a400]">Import business records</Link>
                      <Link href="/customers" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-5 text-sm font-semibold text-[#0f1530]">View customers</Link>
                    </div>
                  </section>
                ) : (
                  <EmptyState icon={Sparkles} title="No matching opportunities" subtitle="Try another filter or customer." />
                )
              ) : (
                recommendations.map((recommendation) => (
                  <RecommendationRow
                    key={recommendation.id}
                    recommendation={recommendation}
                    expandedId={expandedId}
                    onToggleWhy={(id) => setExpandedId((current) => (current === id ? null : id))}
                    onAction={handleAction}
                    onDismiss={(item) => {
                      setDismissTarget(item);
                      setDismissReason("");
                    }}
                    onSnooze={(item) => {
                      setSnoozeTarget(item);
                      setSnoozeDate(getTomorrowDateValue());
                      setSnoozeError(null);
                    }}
                    isActioning={
                      (actionMutation.isPending && actionMutation.variables?.id === recommendation.id) ||
                      (proposeMutation.isPending && proposeMutation.variables === recommendation.id)
                    }
                  />
                ))
              )}
            </div>

            {recommendationsQuery.data && recommendationsQuery.data.totalPages > 1 ? (
              <section className="surface-card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-500">
                  Page {recommendationsQuery.data.page} of {recommendationsQuery.data.totalPages}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= recommendationsQuery.data.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Next
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </motion.div>

      {dismissTarget ? (
        <Overlay
          title="Dismiss recommendation"
          subtitle="This removes the recommendation from the active queue. You can include an optional reason for the record."
          onClose={() => {
            setDismissTarget(null);
            setDismissReason("");
          }}
        >
          <div className="space-y-4">
            <textarea
              value={dismissReason}
              onChange={(event) => setDismissReason(event.target.value)}
              rows={4}
              placeholder="Optional reason"
              className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none transition focus:border-brand-accent focus:bg-white"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDismissTarget(null);
                  setDismissReason("");
                }}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDismiss();
                }}
                disabled={dismissMutation.isPending}
                className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {dismissMutation.isPending ? "Saving..." : "Dismiss"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {snoozeTarget ? (
        <Overlay
          title="Snooze recommendation"
          subtitle="Choose a future date to push this recommendation into the watchlist until it should resurface."
          onClose={() => {
            setSnoozeTarget(null);
            setSnoozeDate(getTomorrowDateValue());
            setSnoozeError(null);
          }}
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-700">
              Snooze until
              <input
                type="date"
                min={getTomorrowDateValue()}
                value={snoozeDate}
                onChange={(event) => {
                  setSnoozeDate(event.target.value);
                  setSnoozeError(null);
                }}
                className="mt-2 w-full rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none transition focus:border-brand-accent focus:bg-white"
              />
            </label>
            {snoozeError ? <p className="text-sm text-error">{snoozeError}</p> : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSnoozeTarget(null);
                  setSnoozeDate(getTomorrowDateValue());
                  setSnoozeError(null);
                }}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSnooze();
                }}
                disabled={snoozeMutation.isPending}
                className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {snoozeMutation.isPending ? "Saving..." : "Snooze"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
