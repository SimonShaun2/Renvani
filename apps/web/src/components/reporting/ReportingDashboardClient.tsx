"use client";

import { useMemo, useState, startTransition } from "react";
import Papa from "papaparse";
import { CalendarRange, Download, SlidersHorizontal } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { LoadErrorState } from "@/src/components/ui/LoadErrorState";
import {
  describeReportingPeriod,
  useEstimateConversion,
  usePipelineMetrics,
  useReportingActivity,
  useReportingKPIs,
  useRevenueChart,
  useReviewScore,
  useTechUtilization,
  type ReportingKpiMetric,
  type ReportingPeriod,
  type ReportingPreset
} from "@/src/hooks/reporting.hooks";
import { showToast } from "@/src/stores/toast.store";

import { ConversionDonut } from "./ConversionDonut";
import { KPIRow } from "./KPIRow";
import { PipelineMetrics } from "./PipelineMetrics";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { RevenueChart } from "./RevenueChart";
import { ReviewScore } from "./ReviewScore";
import { JobSourceReportingSection } from "./JobSourceReportingSection";
import { TechUtilization } from "./TechUtilization";

const PRESET_OPTIONS: Array<{ value: ReportingPreset; label: string }> = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "custom", label: "Custom Range" }
];

function getDefaultCustomRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10)
  };
}

function buildCsvRows(kpis: ReportingKpiMetric[], periodLabel: string) {
  return kpis.map((metric) => ({
    period: periodLabel,
    metric: metric.label,
    value: metric.id === "revenue" || metric.id === "ticket" ? `$${metric.value}` : metric.value,
    trendDirection: metric.trendDirection,
    trendPercent: `${metric.trendPercent}%`,
    note: metric.helper
  }));
}

function downloadCsv(kpis: ReportingKpiMetric[], periodLabel: string) {
  const csv = Papa.unparse(buildCsvRows(kpis, periodLabel));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeLabel = periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  link.href = url;
  link.download = `servicerev-report-${safeLabel || "export"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ReportingDashboardClient() {
  const [preset, setPreset] = useState<ReportingPreset>("this_month");
  const [customRange, setCustomRange] = useState(getDefaultCustomRange);
  const period = useMemo<ReportingPeriod>(
    () =>
      preset === "custom"
        ? {
            preset,
            startDate: customRange.startDate,
            endDate: customRange.endDate
          }
        : { preset },
    [customRange.endDate, customRange.startDate, preset]
  );
  const periodLabel = describeReportingPeriod(period);

  const kpiQuery = useReportingKPIs(period);
  const revenueQuery = useRevenueChart(period);
  const utilizationQuery = useTechUtilization(period);
  const conversionQuery = useEstimateConversion(period);
  const reviewScoreQuery = useReviewScore(period);
  const activityQuery = useReportingActivity(period);
  const pipelineQuery = usePipelineMetrics(period);

  function handlePresetChange(nextPreset: ReportingPreset) {
    startTransition(() => {
      setPreset(nextPreset);
    });
  }

  function handleCustomRangeChange(field: "startDate" | "endDate", value: string) {
    startTransition(() => {
      setCustomRange((current) => {
        const next = {
          ...current,
          [field]: value
        };

        if (next.startDate > next.endDate) {
          return field === "startDate"
            ? { ...next, endDate: value }
            : { ...next, startDate: value };
        }

        return next;
      });
    });
  }

  function handleExport() {
    if (!kpiQuery.data || kpiQuery.data.length === 0) {
      showToast({
        tone: "error",
        title: "Nothing to export",
        description: "Wait for the reporting metrics to load, then try again."
      });
      return;
    }

    downloadCsv(kpiQuery.data, periodLabel);
    showToast({
      tone: "success",
      title: "CSV exported",
      description: "The reporting KPI snapshot has been downloaded."
    });
  }

  return (
    <PageLayout
      title="Reports"
      subtitle="Business performance at a glance."
      actions={
        <div className="flex flex-col items-end gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <SlidersHorizontal className="h-4 w-4 text-neutral-400" />
            <select
              value={preset}
              onChange={(event) => handlePresetChange(event.target.value as ReportingPreset)}
              className="bg-transparent text-sm font-semibold text-neutral-700 outline-none"
            >
              {PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-brand-accent/30 hover:text-brand-accent"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {preset === "custom" ? (
          <section className="surface-card flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Custom date range</p>
              <p className="mt-1 text-sm text-neutral-500">Adjust the reporting window and every section will refetch for the selected range.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <CalendarRange className="h-4 w-4 text-neutral-400" />
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(event) => handleCustomRangeChange("startDate", event.target.value)}
                  className="bg-transparent font-semibold text-neutral-800 outline-none"
                />
              </label>
              <label className="flex items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <CalendarRange className="h-4 w-4 text-neutral-400" />
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) => handleCustomRangeChange("endDate", event.target.value)}
                  className="bg-transparent font-semibold text-neutral-800 outline-none"
                />
              </label>
            </div>
          </section>
        ) : null}

        {kpiQuery.isError ? (
          <LoadErrorState title="Key metrics could not be loaded" onRetry={() => void kpiQuery.refetch()} isRetrying={kpiQuery.isFetching} />
        ) : (
          <KPIRow metrics={kpiQuery.data ?? []} isLoading={kpiQuery.isLoading} />
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          {revenueQuery.isError ? (
          <LoadErrorState title="Revenue could not be loaded" onRetry={() => void revenueQuery.refetch()} isRetrying={revenueQuery.isFetching} />
        ) : (
          <RevenueChart data={revenueQuery.data ?? []} isLoading={revenueQuery.isLoading} rangeLabel={periodLabel} />
        )}
          {utilizationQuery.isError ? (
          <LoadErrorState title="Technician utilization could not be loaded" onRetry={() => void utilizationQuery.refetch()} isRetrying={utilizationQuery.isFetching} />
        ) : (
          <TechUtilization rows={utilizationQuery.data ?? []} isLoading={utilizationQuery.isLoading} />
        )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
          {pipelineQuery.isError ? (
          <LoadErrorState title="Pipeline could not be loaded" onRetry={() => void pipelineQuery.refetch()} isRetrying={pipelineQuery.isFetching} />
        ) : (
          <PipelineMetrics rows={pipelineQuery.data ?? []} isLoading={pipelineQuery.isLoading} />
        )}
          {conversionQuery.isError ? (
          <LoadErrorState title="Estimate conversion could not be loaded" onRetry={() => void conversionQuery.refetch()} isRetrying={conversionQuery.isFetching} />
        ) : (
          <ConversionDonut summary={conversionQuery.data} isLoading={conversionQuery.isLoading} />
        )}
          {reviewScoreQuery.isError ? (
          <LoadErrorState title="Customer reviews could not be loaded" onRetry={() => void reviewScoreQuery.refetch()} isRetrying={reviewScoreQuery.isFetching} />
        ) : (
          <ReviewScore summary={reviewScoreQuery.data} isLoading={reviewScoreQuery.isLoading} />
        )}
        </div>

        <JobSourceReportingSection />

        <RecentActivityFeed items={activityQuery.data ?? []} isLoading={activityQuery.isLoading} />
      </div>
    </PageLayout>
  );
}
