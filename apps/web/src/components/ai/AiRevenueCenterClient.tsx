"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { CalendarClock, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AiRecommendationDetail, AiRecommendationType } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
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
  purple: "bg-ai-light text-ai",
  orange: "bg-warning-light text-warning",
  red: "bg-error-light text-error",
  blue: "bg-brand-accent-light text-brand-accent",
  gold: "bg-[#fff1d8] text-[#d48d0f]"
};

const REVENUE_PROPOSAL_RECOMMENDATION_TYPES = new Set<AiRecommendationType>([
  "reactivation",
  "unsold_estimate",
  "unpaid_invoice",
  "maintenance_plan_offer"
]);

export function isRevenueProposalRecommendationType(type: AiRecommendationType): boolean {
  return REVENUE_PROPOSAL_RECOMMENDATION_TYPES.has(type);
}

function getRecommendationActionLabel(type: AiRecommendationType): string {
  switch (type) {
    case "reactivation":
      return "Schedule Now";
    case "unsold_estimate":
      return "Send Follow Up";
    case "unpaid_invoice":
      return "Send Payment Link";
    case "aging_asset":
      return "Create Estimate";
    case "maintenance_plan_offer":
      return "Offer Plan";
    case "upsell_opportunity":
      return "Approve Upsell";
    case "maintenance_due":
      return "Book Service";
    case "seasonal_campaign":
      return "Send Campaign";
    default:
      return "Take Action";
  }
}

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
  if ((score ?? 0) >= 85) {
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
  const actionLabel = isRevenueProposalRecommendationType(recommendation.type)
    ? "Create proposal"
    : getRecommendationActionLabel(recommendation.type);

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm transition hover:shadow-[0_24px_70px_rgba(16,33,99,0.08)]">
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
              {recommendation.urgencyScore ?? 0}
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
              <CurrencyDisplay value={recommendation.estimatedRevenue} className="font-semibold text-neutral-900" />
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
              "inline-flex min-w-[164px] items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
              recommendation.type === "maintenance_plan_offer" ? "bg-ai hover:bg-brand-primary" : "bg-brand-accent hover:bg-brand-primary",
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

  const recommendations = recommendationsQuery.data?.data ?? [];

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
          actionTaken: getRecommendationActionLabel(recommendation.type)
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

  const categoryCards = summaryQuery.data ? buildCategoryCards(summaryQuery.data) : [];

  return (
    <div className="space-y-6">
      <motion.div {...cardMotion} transition={{ duration: 0.32 }}>
        <PageLayout
          title="AI Revenue Center"
          subtitle="Your revenue opportunities updated continuously."
          actions={
            <button
              type="button"
              className="rounded-2xl border border-ai/20 bg-ai-light px-4 py-2 text-sm font-semibold text-ai transition hover:bg-white"
            >
              Run AI Scan
            </button>
          }
        >
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] bg-brand-primary text-white shadow-[0_28px_90px_rgba(16,33,99,0.24)]">
              <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">Total Revenue Opportunity</p>
                  <CurrencyDisplay value={summaryQuery.data?.totalOpportunityValue} className="mt-3 block text-5xl font-semibold tracking-tight text-white" />
                </div>
                <div className="text-sm text-white/70">
                  {summaryQuery.data ? (
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      <span>Last scanned: {format(parseISO(summaryQuery.data.generatedAt), "MMM d, h:mm a")}</span>
                    </div>
                  ) : (
                    <span>Last scanned: waiting for summary</span>
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
                      "rounded-[28px] border bg-white px-5 py-5 text-left shadow-sm transition",
                      selectedType === card.id ? "border-brand-accent shadow-[0_18px_40px_rgba(37,122,250,0.18)]" : "border-neutral-200 hover:border-brand-accent/30"
                    )}
                  >
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", categoryToneClasses[card.tone])}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-neutral-500">{card.label}</p>
                    <CurrencyDisplay value={card.value} className="mt-1 block text-3xl font-semibold tracking-tight text-neutral-900" />
                    <p className="mt-2 text-sm text-neutral-500">{card.count} active opportunities</p>
                  </button>
                ))}
              </div>
            )}

            <section className="surface-card p-5">
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
                        selectedType === filter.id ? "bg-brand-accent text-white" : "bg-neutral-100 text-neutral-500 hover:text-neutral-800"
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
                    className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 outline-none"
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
                <EmptyState
                  icon={Sparkles}
                  title="No recommendations in this view"
                  subtitle="Try a different filter or come back after the next AI revenue scan."
                />
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
        </PageLayout>
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
