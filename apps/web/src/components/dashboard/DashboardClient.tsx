"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth, subDays } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  FileText,
  Info,
  LineChart,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import {
  isRevenueProposalRecommendationType,
  type AiRecommendationDetail,
  type AiRecommendationType,
  type DispatchTechnicianDay,
  type RevenueSummary
} from "@fsm/types";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { TimeAgo } from "@/src/components/ui/TimeAgo";
import {
  useDashboardAgreements,
  useDashboardCustomers,
  useDashboardEstimates,
  useDashboardInvoices,
  useDashboardJobs,
  useDispatchSnapshot,
  useRecentActivity,
  useRevenueSummary,
  useUnscheduledJobs,
  type DashboardAgreementListItem,
  type DashboardCustomerListItem,
  type DashboardEstimateListItem,
  type DashboardInvoiceListItem,
  type DashboardJobListItem,
  type UnscheduledJobListItem
} from "@/src/hooks/dashboard.hooks";
import { useActionRecommendation, useRecommendations } from "@/src/hooks/ai-revenue.hooks";
import { useProposeRecommendation } from "@/src/hooks/revenue-proposals.hooks";
import { cn } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";

interface SectionCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface RevenueOpportunityCardConfig {
  label: string;
  href: string;
  tone: "purple" | "orange" | "red" | "blue";
  value: string;
  count: number;
}

interface AlertItem {
  id: string;
  tone: "red" | "orange";
  message: string;
}

interface ActivityItem {
  id: string;
  summary: string;
  tone: "blue" | "green" | "orange";
  occurredAt: string;
}

interface PipelineMetric {
  id: string;
  label: string;
  count: number;
  value: string;
}

interface GoalProgressData {
  currentValue: string;
  goalValue: string;
  percent: number;
  daysLeft: number;
}

const chartColors = {
  completed: "#102163",
  inProgress: "#257afa",
  scheduled: "#c5ccd8",
  unscheduled: "#ef414c"
};

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 }
};

const opportunityTones: Record<RevenueOpportunityCardConfig["tone"], string> = {
  purple: "bg-ai-light text-ai",
  orange: "bg-warning-light text-warning",
  red: "bg-error-light text-error",
  blue: "bg-brand-accent-light text-brand-accent"
};

const actionLinkClass =
  "inline-flex items-center gap-2 text-sm font-semibold text-brand-accent transition hover:text-brand-primary";

function toAmount(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCurrentMonth(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const date = parseISO(value);
  const now = new Date();
  return !isBefore(date, startOfMonth(now)) && !isAfter(date, endOfMonth(now));
}

function getGreeting(firstName: string | undefined): string {
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return firstName ? `${partOfDay}, ${firstName}` : partOfDay;
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

function getRecommendationTypeLabel(type: AiRecommendationType): string {
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

function getUrgencyTone(score: number | null): "red" | "orange" | "green" {
  if ((score ?? 0) >= 85) {
    return "red";
  }

  if ((score ?? 0) >= 60) {
    return "orange";
  }

  return "green";
}

function getUrgencyLabel(score: number | null): string {
  if ((score ?? 0) >= 85) {
    return "Urgent";
  }

  if ((score ?? 0) >= 60) {
    return "Medium";
  }

  return "Low";
}

function buildRevenueOpportunityCards(summary: RevenueSummary): RevenueOpportunityCardConfig[] {
  return [
    {
      label: "Dormant Customers",
      href: "/ai-revenue-center?type=reactivation",
      tone: "purple",
      value: summary.dormantCustomers.estimatedRevenue,
      count: summary.dormantCustomers.count
    },
    {
      label: "Unsold Estimates",
      href: "/ai-revenue-center?type=unsold_estimate",
      tone: "orange",
      value: summary.unsoldEstimates.totalValue,
      count: summary.unsoldEstimates.count
    },
    {
      label: "Unpaid Invoices",
      href: "/ai-revenue-center?type=unpaid_invoice",
      tone: "red",
      value: summary.unpaidInvoices.totalValue,
      count: summary.unpaidInvoices.count
    },
    {
      label: "Missing Agreements",
      href: "/ai-revenue-center?type=maintenance_plan_offer",
      tone: "blue",
      value: summary.maintenancePlanOpportunities.estimatedRevenue,
      count: summary.maintenancePlanOpportunities.count
    }
  ];
}

function buildAlerts(
  unscheduledJobs: UnscheduledJobListItem[],
  invoices: DashboardInvoiceListItem[],
  customers: DashboardCustomerListItem[],
  estimates: DashboardEstimateListItem[]
): AlertItem[] {
  const now = new Date();
  const overdueThreshold = subDays(now, 7);
  const serviceThreshold = subDays(now, 180);
  const expiringSoon = estimates.filter((estimate) => {
    if (!estimate.expiresAt) {
      return false;
    }

    const expiresAt = parseISO(estimate.expiresAt);
    return (
      (estimate.status === "sent" || estimate.status === "viewed" || estimate.status === "revised") &&
      !isBefore(expiresAt, now) &&
      !isAfter(expiresAt, addDays(now, 7))
    );
  });
  const urgentUnscheduled = unscheduledJobs.filter(
    (job) => job.priority === "urgent" || job.priority === "high"
  );
  const overdueInvoices = invoices.filter((invoice) => {
    if (!invoice.dueAt || toAmount(invoice.balanceDue) <= 0) {
      return false;
    }

    return invoice.status === "overdue" || isBefore(parseISO(invoice.dueAt), overdueThreshold);
  });
  const overdueCustomers = customers.filter((customer) => {
    if (!customer.lastServiceDate || customer.doNotContact) {
      return false;
    }

    return isBefore(parseISO(customer.lastServiceDate), serviceThreshold);
  });
  const alerts: AlertItem[] = [];

  if (urgentUnscheduled.length > 0) {
    alerts.push({
      id: "urgent-jobs",
      tone: "red",
      message: `${urgentUnscheduled.length} urgent jobs are not scheduled`
    });
  }

  if (overdueInvoices.length > 0) {
    alerts.push({
      id: "overdue-invoices",
      tone: "orange",
      message: `${overdueInvoices.length} invoices are overdue by 7+ days`
    });
  }

  if (overdueCustomers.length > 0) {
    alerts.push({
      id: "overdue-customers",
      tone: "orange",
      message: `${overdueCustomers.length} customers are overdue for service`
    });
  }

  if (expiringSoon.length > 0) {
    alerts.push({
      id: "expiring-estimates",
      tone: "orange",
      message: `${expiringSoon.length} estimates expire this week`
    });
  }

  return alerts;
}

function buildPipelineMetrics(
  estimates: DashboardEstimateListItem[],
  invoices: DashboardInvoiceListItem[],
  agreements: DashboardAgreementListItem[],
  jobs: DashboardJobListItem[],
  customers: DashboardCustomerListItem[]
): PipelineMetric[] {
  const pendingEstimates = estimates.filter((estimate) =>
    ["draft", "sent", "viewed", "approved", "revised"].includes(estimate.status)
  );
  const unpaidInvoices = invoices.filter((invoice) =>
    ["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status)
  );
  const activeAgreements = agreements.filter((agreement) => agreement.status === "active");
  const completedJobs = jobs.filter((job) =>
    ["completed", "invoiced", "paid", "closed"].includes(job.status) && isCurrentMonth(job.createdAt)
  );
  const paidRevenueThisMonth = invoices
    .filter(
      (invoice) => (invoice.status === "paid" || invoice.status === "partially_paid") && isCurrentMonth(invoice.createdAt)
    )
    .reduce((sum, invoice) => sum + (invoice.status === "paid" ? toAmount(invoice.total) : toAmount(invoice.amountPaid)), 0);
  const newCustomers = customers.filter((customer) => isCurrentMonth(customer.createdAt));

  return [
    {
      id: "estimates",
      label: "Estimates Pending",
      count: pendingEstimates.length,
      value: pendingEstimates.reduce((sum, estimate) => sum + toAmount(estimate.total), 0).toFixed(2)
    },
    {
      id: "invoices",
      label: "Invoices Unpaid",
      count: unpaidInvoices.length,
      value: unpaidInvoices.reduce((sum, invoice) => sum + toAmount(invoice.balanceDue), 0).toFixed(2)
    },
    {
      id: "agreements",
      label: "Active Agreements",
      count: activeAgreements.length,
      value: activeAgreements
        .reduce((sum, agreement) => {
          const price = toAmount(agreement.price);
          return sum + (agreement.billingCycle === "annual" ? price / 12 : price);
        }, 0)
        .toFixed(2)
    },
    {
      id: "jobs",
      label: "Jobs Completed (MTD)",
      count: completedJobs.length,
      value: paidRevenueThisMonth.toFixed(2)
    },
    {
      id: "customers",
      label: "New Customers (MTD)",
      count: newCustomers.length,
      value: newCustomers.reduce((sum, customer) => sum + toAmount(customer.lifetimeValue), 0).toFixed(2)
    }
  ];
}

function buildRecentActivity(jobs: DashboardJobListItem[]): ActivityItem[] {
  return jobs.slice(0, 5).map((job) => {
    const customerName = `${job.customer.firstName} ${job.customer.lastName}`.trim();

    if (["completed", "invoiced", "paid", "closed"].includes(job.status)) {
      return {
        id: job.id,
        summary: `Job completed for ${customerName || "customer"}: ${job.title}`,
        tone: "green",
        occurredAt: job.createdAt
      };
    }

    if (["scheduled", "dispatched", "in_progress"].includes(job.status)) {
      return {
        id: job.id,
        summary: `Job updated for ${customerName || "customer"}: ${job.title}`,
        tone: "blue",
        occurredAt: job.createdAt
      };
    }

    return {
      id: job.id,
      summary: `New job created for ${customerName || "customer"}: ${job.title}`,
      tone: "orange",
      occurredAt: job.createdAt
    };
  });
}

function buildTopOpportunities(summary: RevenueSummary) {
  return [
    {
      label: "Dormant Customers",
      value: summary.dormantCustomers.estimatedRevenue,
      href: "/ai-revenue-center?type=reactivation"
    },
    {
      label: "Unsold Estimates",
      value: summary.unsoldEstimates.totalValue,
      href: "/ai-revenue-center?type=unsold_estimate"
    },
    {
      label: "Unpaid Invoices",
      value: summary.unpaidInvoices.totalValue,
      href: "/ai-revenue-center?type=unpaid_invoice"
    },
    {
      label: "Aging Assets",
      value: summary.agingAssets.estimatedRevenue,
      href: "/ai-revenue-center?type=aging_asset"
    },
    {
      label: "Missing Agreements",
      value: summary.maintenancePlanOpportunities.estimatedRevenue,
      href: "/ai-revenue-center?type=maintenance_plan_offer"
    }
  ].sort((left, right) => toAmount(right.value) - toAmount(left.value));
}

function buildGoalProgress(invoices: DashboardInvoiceListItem[]): GoalProgressData | null {
  const paidInvoices = invoices.filter(
    (invoice) => (invoice.status === "paid" || invoice.status === "partially_paid") && isCurrentMonth(invoice.createdAt)
  );
  const currentValueNumber = paidInvoices.reduce((sum, invoice) => {
    if (invoice.status === "paid") {
      return sum + toAmount(invoice.total);
    }

    return sum + toAmount(invoice.amountPaid);
  }, 0);

  if (currentValueNumber <= 0) {
    return null;
  }

  const goalValueNumber = Math.max(25_000, Math.ceil((currentValueNumber * 1.55) / 5_000) * 5_000);
  const now = new Date();
  const daysLeft = Math.max(0, endOfMonth(now).getDate() - now.getDate());

  return {
    currentValue: currentValueNumber.toFixed(2),
    goalValue: goalValueNumber.toFixed(2),
    percent: Math.min(100, Math.round((currentValueNumber / goalValueNumber) * 100)),
    daysLeft
  };
}

function buildJobsChartData(jobs: DashboardJobListItem[]) {
  const completed = jobs.filter((job) => ["completed", "invoiced", "paid", "closed"].includes(job.status)).length;
  const inProgress = jobs.filter((job) => ["dispatched", "in_progress"].includes(job.status)).length;
  const scheduled = jobs.filter((job) => job.status === "scheduled").length;
  const unscheduled = jobs.filter((job) =>
    ["lead", "estimate_requested", "estimate_sent", "estimate_approved", "on_hold", "cancelled"].includes(job.status)
  ).length;

  return [
    { name: "Completed", value: completed, color: chartColors.completed },
    { name: "In Progress", value: inProgress, color: chartColors.inProgress },
    { name: "Scheduled", value: scheduled, color: chartColors.scheduled },
    { name: "Unscheduled", value: unscheduled, color: chartColors.unscheduled }
  ];
}

function SectionCard({ title, action, children, className }: SectionCardProps) {
  return (
    <section className={cn("surface-card p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h3>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-error/15 bg-error-light px-5 py-5 text-sm text-error">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-1.5 font-semibold text-error shadow-sm"
      >
        Retry
      </button>
    </div>
  );
}

function RevenueOpportunityCards({
  summary,
  isLoading,
  isError,
  onRetry
}: {
  summary: RevenueSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} className="h-[148px]" />
        ))}
      </div>
    );
  }

  if (isError || !summary) {
    return <SectionError message="We couldn't load your revenue summary yet." onRetry={onRetry} />;
  }

  const cards = buildRevenueOpportunityCards(summary);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="surface-card group p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(37,122,250,0.14)]"
        >
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", opportunityTones[card.tone])}>
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-500">{card.label}</p>
          <CurrencyDisplay
            value={card.value}
            className="mt-1 block text-3xl font-semibold tracking-tight text-neutral-900"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              {card.count} {card.count === 1 ? "customer" : "customers"}
            </p>
            <span className={actionLinkClass}>
              View <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ScheduleSnapshot({
  technicians,
  isLoading,
  isError,
  onRetry
}: {
  technicians: DispatchTechnicianDay[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[250px]" />;
  }

  if (isError) {
    return <SectionError message="Today's schedule snapshot isn't available yet." onRetry={onRetry} />;
  }

  if (technicians.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No technicians scheduled"
        subtitle="Once jobs are assigned for today, technician workload and open gaps will show here."
        compact
      />
    );
  }

  return (
    <SectionCard
      title="Today's Schedule Snapshot"
      action={
        <Link href="/dispatch" className={actionLinkClass}>
          Open Dispatch Board <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-4">
        {technicians.slice(0, 3).map((technician) => {
          const hasGaps = technician.gaps.length > 0;
          const badgeLabel =
            technician.jobs.length === 0
              ? "Open day"
              : hasGaps
                ? `${technician.gaps.length} ${technician.gaps.length === 1 ? "gap" : "gaps"}`
                : "On track";
          const badgeTone = technician.jobs.length === 0 || hasGaps ? "orange" : "green";
          const initials = technician.name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <div key={technician.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent-light text-sm font-semibold text-brand-accent">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{technician.name}</p>
                <p className="text-sm text-neutral-500">
                  {technician.jobs.length} {technician.jobs.length === 1 ? "job" : "jobs"}
                </p>
              </div>
              <StatBadge label={badgeLabel} tone={badgeTone} />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function AlertsSection({
  alerts,
  isLoading,
  isError,
  onRetry
}: {
  alerts: AlertItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[250px]" />;
  }

  if (isError) {
    return <SectionError message="Alerts couldn't be calculated from live data." onRetry={onRetry} />;
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="No active alerts"
        subtitle="You're clear right now. New dispatch, invoice, or service risk alerts will appear here."
        compact
      />
    );
  }

  return (
    <SectionCard
      title="Alerts"
      action={
        <Link href="/ai-revenue-center" className={actionLinkClass}>
          View all alerts <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start gap-3 text-sm text-neutral-700">
            <span
              className={cn(
                "mt-1.5 h-2.5 w-2.5 rounded-full",
                alert.tone === "red" ? "bg-error" : "bg-warning"
              )}
            />
            <p className="leading-6">{alert.message}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function QuickPipeline({
  metrics,
  isLoading,
  isError,
  onRetry
}: {
  metrics: PipelineMetric[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[162px]" />;
  }

  if (isError) {
    return <SectionError message="Pipeline metrics aren't available right now." onRetry={onRetry} />;
  }

  return (
    <SectionCard
      title="Quick Pipeline"
      action={
        <Link href="/reporting" className={actionLinkClass}>
          Go to reports <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-2xl bg-neutral-50 px-4 py-4">
            <p className="text-3xl font-semibold tracking-tight text-neutral-900">{metric.count}</p>
            <CurrencyDisplay value={metric.value} className="mt-1 block text-sm font-semibold text-success" />
            <p className="mt-2 text-sm leading-6 text-neutral-500">{metric.label}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function RecentActivitySection({
  items,
  isLoading,
  isError,
  onRetry
}: {
  items: ActivityItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[276px]" />;
  }

  if (isError) {
    return <SectionError message="Recent activity couldn't be loaded." onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={LineChart}
        title="No recent activity"
        subtitle="As new jobs move through the pipeline, a short activity feed will appear here."
        compact
      />
    );
  }

  return (
    <SectionCard
      title="Recent Activity"
      action={
        <Link href="/jobs" className={actionLinkClass}>
          View all activity <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-2xl border-l-4 bg-neutral-50 px-4 py-3",
              item.tone === "green" && "border-success",
              item.tone === "blue" && "border-brand-accent",
              item.tone === "orange" && "border-warning"
            )}
          >
            <p className="text-sm leading-6 text-neutral-700">{item.summary}</p>
            <TimeAgo value={item.occurredAt} className="mt-2 block text-xs font-medium text-neutral-400" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function TopRevenueOpportunities({
  summary,
  isLoading,
  isError,
  onRetry
}: {
  summary: RevenueSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[276px]" />;
  }

  if (isError || !summary) {
    return <SectionError message="Top revenue opportunities couldn't be ranked." onRetry={onRetry} />;
  }

  const opportunities = buildTopOpportunities(summary);

  return (
    <SectionCard
      title="Top Revenue Opportunities"
      action={
        <Link href="/ai-revenue-center" className={actionLinkClass}>
          View all opportunities <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="space-y-4">
        {opportunities.map((opportunity, index) => (
          <Link
            key={opportunity.label}
            href={opportunity.href}
            className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 transition hover:bg-neutral-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                {index + 1}
              </div>
              <p className="text-sm font-medium text-neutral-700">{opportunity.label}</p>
            </div>
            <CurrencyDisplay value={opportunity.value} className="text-sm font-semibold text-success" />
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

function JobsDonutChart({
  jobs,
  isLoading,
  isError,
  onRetry
}: {
  jobs: DashboardJobListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[292px]" />;
  }

  if (isError) {
    return <SectionError message="Job status distribution isn't ready yet." onRetry={onRetry} />;
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title="No jobs yet"
        subtitle="Once jobs begin moving through the system, status distribution will render here."
        compact
      />
    );
  }

  const data = buildJobsChartData(jobs);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <SectionCard
      title="Jobs by Status (This Week)"
      action={
        <Link href="/jobs" className={actionLinkClass}>
          View all jobs <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid items-center gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={68}
                outerRadius={92}
                paddingAngle={3}
                dataKey="value"
                stroke="transparent"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-400">Total</span>
            <span className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">{total}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((entry) => {
            const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;

            return (
              <div key={entry.name} className="rounded-2xl border border-neutral-200 px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <p className="text-sm font-semibold text-neutral-700">{entry.name}</p>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{entry.value}</p>
                <p className="mt-1 text-sm text-neutral-500">{percent}% of total jobs</p>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

function GoalProgress({ data }: { data: GoalProgressData | null }) {
  if (!data) {
    return null;
  }

  return (
    <section className="surface-card px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Your Goal Progress (MTD)</h3>
        <p className="text-sm font-semibold text-brand-accent">{data.percent}%</p>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        <CurrencyDisplay value={data.currentValue} className="font-semibold text-neutral-900" /> /{" "}
        <CurrencyDisplay value={data.goalValue} className="font-semibold text-neutral-900" /> and {data.daysLeft} days
        left
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-brand-accent transition-all duration-500"
          style={{ width: `${data.percent}%` }}
        />
      </div>
    </section>
  );
}

function SuggestedActionsCard({
  recommendation,
  index,
  expandedId,
  onToggleWhy,
  onAction,
  isSubmitting
}: {
  recommendation: AiRecommendationDetail;
  index: number;
  expandedId: string | null;
  onToggleWhy: (id: string) => void;
  onAction: (recommendation: AiRecommendationDetail) => Promise<void>;
  isSubmitting: boolean;
}) {
  const customerName = recommendation.customer
    ? `${recommendation.customer.firstName} ${recommendation.customer.lastName}`.trim()
    : recommendation.headline;
  const actionLabel = isRevenueProposalRecommendationType(recommendation.type)
    ? "Create proposal"
    : getRecommendationActionLabel(recommendation.type);
  const urgencyTone = getUrgencyTone(recommendation.urgencyScore);

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900">{customerName}</p>
            {(recommendation.urgencyScore ?? 0) >= 85 ? <StatBadge label="Urgent" tone="red" /> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatBadge label={getRecommendationTypeLabel(recommendation.type)} tone="gray" />
            <StatBadge
              label={getUrgencyLabel(recommendation.urgencyScore)}
              tone={urgencyTone === "red" ? "red" : urgencyTone === "orange" ? "orange" : "neutral"}
            />
          </div>
          <p className="mt-1 text-sm leading-6 text-neutral-500">{recommendation.body}</p>
          <p className="mt-2 text-sm font-medium text-neutral-700">
            Est. value: <CurrencyDisplay value={recommendation.estimatedRevenue} className="font-semibold text-neutral-900" />
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          void onAction(recommendation);
        }}
        disabled={isSubmitting}
        className={cn(
          "mt-4 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
          recommendation.type === "maintenance_plan_offer" ? "bg-ai hover:bg-brand-primary" : "bg-brand-accent hover:bg-brand-primary",
          isSubmitting && "cursor-not-allowed opacity-70"
        )}
      >
        {isSubmitting ? "Working..." : actionLabel}
      </button>

      <button
        type="button"
        onClick={() => onToggleWhy(recommendation.id)}
        className={cn(
          "mt-3 inline-flex items-center gap-2 text-sm font-medium transition",
          urgencyTone === "red" && "text-error",
          urgencyTone === "orange" && "text-warning",
          urgencyTone === "green" && "text-neutral-500"
        )}
      >
        Why this?
      </button>

      {expandedId === recommendation.id ? (
        <div className="mt-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
          {recommendation.body}
        </div>
      ) : null}
    </div>
  );
}

export function SuggestedActions() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"suggestions" | "watchlist">("suggestions");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingQuery = useRecommendations({
    status: "pending",
    limit: 3,
    page: 1
  });
  const watchlistQuery = useRecommendations({
    status: "snoozed",
    limit: 3,
    page: 1
  });
  const actionMutation = useActionRecommendation();
  const proposeMutation = useProposeRecommendation();

  const activeQuery = activeTab === "suggestions" ? pendingQuery : watchlistQuery;
  const recommendations = activeQuery.data?.data ?? [];

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

  return (
    <section className="surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <h3 className="text-base font-semibold text-neutral-900">AI Suggested Actions</h3>
        </div>
        <Info className="h-4 w-4 text-neutral-400" />
      </div>

      <div className="mt-4 flex items-center gap-3 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={cn(
            "text-sm font-semibold transition",
            activeTab === "suggestions" ? "text-brand-accent" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          Suggestions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("watchlist")}
          className={cn(
            "inline-flex items-center gap-2 text-sm font-semibold transition",
            activeTab === "watchlist" ? "text-brand-accent" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          Watchlist
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {watchlistQuery.data?.total ?? 0}
          </span>
        </button>
      </div>

      {actionError ? (
        <div role="alert" className="mt-4 rounded-2xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
          {actionError}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {activeQuery.isLoading ? (
          Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index} className="h-[192px]" />)
        ) : activeQuery.isError ? (
          <SectionError
            message="Suggested actions couldn't be loaded."
            onRetry={() => {
              void activeQuery.refetch();
            }}
          />
        ) : recommendations.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={activeTab === "suggestions" ? "No active suggestions" : "Nothing in watchlist"}
            subtitle="Fresh AI opportunities will show up here as the revenue engine finds them."
            compact
          />
        ) : (
          recommendations.map((recommendation, index) => (
            <SuggestedActionsCard
              key={recommendation.id}
              recommendation={recommendation}
              index={index}
              expandedId={expandedId}
              onToggleWhy={(id) => setExpandedId((current) => (current === id ? null : id))}
              onAction={handleAction}
              isSubmitting={
                (actionMutation.isPending && actionMutation.variables?.id === recommendation.id) ||
                (proposeMutation.isPending && proposeMutation.variables === recommendation.id)
              }
            />
          ))
        )}
      </div>

      <Link href="/ai-revenue-center" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-accent">
        View all suggestions <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function QuickActions() {
  const actions = [
    { label: "Create Job", href: "/jobs", icon: BriefcaseBusiness },
    { label: "New Estimate", href: "/estimates", icon: FileText },
    { label: "New Invoice", href: "/invoices", icon: CreditCard },
    { label: "Add Customer", href: "/customers", icon: Users },
    { label: "New Agreement", href: "/service-agreements", icon: ShieldCheck },
    { label: "Send Message", href: "/customers", icon: MessageSquareText }
  ];

  return (
    <section className="surface-card p-5">
      <h3 className="text-sm font-semibold text-neutral-900">Quick Actions</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 transition hover:border-brand-accent/30 hover:bg-white hover:shadow-sm"
            >
              <Icon className="h-4 w-4 text-brand-accent" />
              <p className="mt-4 text-sm font-semibold text-neutral-800">{action.label}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardClient() {
  const user = useAuthStore((state) => state.user);
  const today = format(new Date(), "yyyy-MM-dd");
  const revenueSummaryQuery = useRevenueSummary();
  const dispatchSnapshotQuery = useDispatchSnapshot(today);
  const recentActivityQuery = useRecentActivity();
  const jobsQuery = useDashboardJobs();
  const customersQuery = useDashboardCustomers();
  const estimatesQuery = useDashboardEstimates();
  const invoicesQuery = useDashboardInvoices();
  const agreementsQuery = useDashboardAgreements();
  const unscheduledJobsQuery = useUnscheduledJobs();

  const technicians = dispatchSnapshotQuery.data?.technicians ?? [];
  const activityItems = buildRecentActivity(recentActivityQuery.data?.data ?? []);
  const alerts = buildAlerts(
    unscheduledJobsQuery.data?.jobs ?? [],
    invoicesQuery.data?.data ?? [],
    customersQuery.data?.data ?? [],
    estimatesQuery.data?.data ?? []
  );
  const pipelineMetrics = buildPipelineMetrics(
    estimatesQuery.data?.data ?? [],
    invoicesQuery.data?.data ?? [],
    agreementsQuery.data?.data ?? [],
    jobsQuery.data?.data ?? [],
    customersQuery.data?.data ?? []
  );
  const goalProgress = buildGoalProgress(invoicesQuery.data?.data ?? []);

  return (
    <div className="space-y-6">
      <motion.div {...cardMotion} transition={{ duration: 0.3 }}>
        <PageLayout title={getGreeting(user?.firstName)} subtitle="Here's what's happening in your business today.">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_392px]">
            <div className="space-y-6">
              <RevenueOpportunityCards
                summary={revenueSummaryQuery.data}
                isLoading={revenueSummaryQuery.isLoading}
                isError={revenueSummaryQuery.isError}
                onRetry={() => {
                  void revenueSummaryQuery.refetch();
                }}
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <ScheduleSnapshot
                  technicians={technicians}
                  isLoading={dispatchSnapshotQuery.isLoading}
                  isError={dispatchSnapshotQuery.isError}
                  onRetry={() => {
                    void dispatchSnapshotQuery.refetch();
                  }}
                />
                <AlertsSection
                  alerts={alerts}
                  isLoading={
                    unscheduledJobsQuery.isLoading ||
                    invoicesQuery.isLoading ||
                    customersQuery.isLoading ||
                    estimatesQuery.isLoading
                  }
                  isError={
                    unscheduledJobsQuery.isError ||
                    invoicesQuery.isError ||
                    customersQuery.isError ||
                    estimatesQuery.isError
                  }
                  onRetry={() => {
                    void Promise.all([
                      unscheduledJobsQuery.refetch(),
                      invoicesQuery.refetch(),
                      customersQuery.refetch(),
                      estimatesQuery.refetch()
                    ]);
                  }}
                />
              </div>

              <QuickPipeline
                metrics={pipelineMetrics}
                isLoading={
                  estimatesQuery.isLoading ||
                  invoicesQuery.isLoading ||
                  agreementsQuery.isLoading ||
                  jobsQuery.isLoading ||
                  customersQuery.isLoading
                }
                isError={
                  estimatesQuery.isError ||
                  invoicesQuery.isError ||
                  agreementsQuery.isError ||
                  jobsQuery.isError ||
                  customersQuery.isError
                }
                onRetry={() => {
                  void Promise.all([
                    estimatesQuery.refetch(),
                    invoicesQuery.refetch(),
                    agreementsQuery.refetch(),
                    jobsQuery.refetch(),
                    customersQuery.refetch()
                  ]);
                }}
              />

              <div className="grid gap-6 lg:grid-cols-2">
                <RecentActivitySection
                  items={activityItems}
                  isLoading={recentActivityQuery.isLoading}
                  isError={recentActivityQuery.isError}
                  onRetry={() => {
                    void recentActivityQuery.refetch();
                  }}
                />
                <TopRevenueOpportunities
                  summary={revenueSummaryQuery.data}
                  isLoading={revenueSummaryQuery.isLoading}
                  isError={revenueSummaryQuery.isError}
                  onRetry={() => {
                    void revenueSummaryQuery.refetch();
                  }}
                />
              </div>

              <JobsDonutChart
                jobs={jobsQuery.data?.data ?? []}
                isLoading={jobsQuery.isLoading}
                isError={jobsQuery.isError}
                onRetry={() => {
                  void jobsQuery.refetch();
                }}
              />
            </div>

            <div className="space-y-6">
              <SuggestedActions />
              <QuickActions />
              <GoalProgress data={goalProgress} />
            </div>
          </div>
        </PageLayout>
      </motion.div>
    </div>
  );
}
