"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CarFront, Sparkles } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useRecommendations } from "@/src/hooks/ai-revenue.hooks";
import {
  useCompany,
  useJob,
  useJobProducts,
  useJobTasks,
  useJobTimeEntries,
  useStartTimer,
  useStopTimer
} from "@/src/hooks/jobs.hooks";
import { useBreakpoint } from "@/src/hooks/useBreakpoint";
import { showToast } from "@/src/stores/toast.store";
import { cn } from "@/src/lib/utils";
import { AttachmentsPanel } from "@/src/components/jobs/AttachmentsPanel";
import { JobProductsPanel } from "@/src/components/jobs/JobProductsPanel";
import { TaskChecklist } from "@/src/components/jobs/TaskChecklist";
import {
  buildTimeSummary,
  formatDurationMinutes,
  formatElapsedSeconds,
  getAssetBadge,
  getCompanyTaxRate
} from "@/src/components/jobs/jobs.utils";

import { CrewChecklist } from "./CrewChecklist";
import { getCrewStatusLabel, getCrewStatusTone } from "./crew-job.utils";
import { JobActionBar } from "./JobActionBar";
import { MobileJobNoteComposer } from "./MobileJobNoteComposer";
import { TabletJobDetail } from "./tablet/TabletJobDetail";

type MobileJobTab = "details" | "tasks" | "products" | "files";

const tabOptions: Array<{ key: MobileJobTab; label: string }> = [
  { key: "details", label: "Details" },
  { key: "tasks", label: "Tasks" },
  { key: "products", label: "Products" },
  { key: "files", label: "Files" }
];

function getTabFromSearchParam(value: string | null): MobileJobTab {
  if (value === "tasks" || value === "products" || value === "files") {
    return value;
  }

  return "details";
}

function MobileTimeCard({
  jobId,
  technicianId
}: {
  jobId: string;
  technicianId: string | null;
}) {
  const timeEntriesQuery = useJobTimeEntries(jobId);
  const startTimer = useStartTimer(jobId);
  const stopTimer = useStopTimer(jobId);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const entries = timeEntriesQuery.data?.timeEntries ?? [];
  const activeEntry = entries.find((entry) => entry.endedAt === null) ?? null;
  const summary = useMemo(() => buildTimeSummary(entries, elapsedSeconds), [elapsedSeconds, entries]);

  useEffect(() => {
    if (!activeEntry) {
      setElapsedSeconds(0);
      return undefined;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000));
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [activeEntry]);

  async function handleStart() {
    try {
      await startTimer.mutateAsync(technicianId ? { technicianId, entryType: "on_site" } : { entryType: "on_site" });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Timer could not start",
        description: error instanceof Error ? error.message : "Try again."
      });
    }
  }

  async function handleStop() {
    try {
      await stopTimer.mutateAsync(technicianId ? { technicianId } : undefined);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Timer could not stop",
        description: error instanceof Error ? error.message : "Try again."
      });
    }
  }

  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950">Time Tracking</p>
          <p className="mt-1 text-xs text-neutral-500">
            Billable {formatDurationMinutes(summary.billableMinutes)} · Travel {formatDurationMinutes(summary.travelMinutes)}
          </p>
        </div>
        {activeEntry ? (
          <span className="rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">On Site</span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">Ready</span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-neutral-50 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Live Timer</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            {activeEntry ? formatElapsedSeconds(elapsedSeconds) : "00:00:00"}
          </p>
        </div>
        <button
          type="button"
          disabled={startTimer.isPending || stopTimer.isPending}
          onClick={() => {
            void (activeEntry ? handleStop() : handleStart());
          }}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60",
            activeEntry ? "bg-error" : "bg-success"
          )}
        >
          {activeEntry ? (stopTimer.isPending ? "Stopping..." : "Stop") : startTimer.isPending ? "Starting..." : "Start"}
        </button>
      </div>
    </section>
  );
}

export function MobileJobDetail({ jobId }: { jobId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isTablet } = useBreakpoint();
  const [isPending, startTransition] = useTransition();
  const activeTab = getTabFromSearchParam(searchParams.get("tab"));

  const jobQuery = useJob(jobId);
  const tasksQuery = useJobTasks(jobId);
  const productsQuery = useJobProducts(jobId);
  const companyQuery = useCompany();
  const job = jobQuery.data?.job;
  const tasks = tasksQuery.data?.tasks ?? [];
  const products = productsQuery.data?.products ?? [];

  const recommendationFilters = useMemo(
    () =>
      job
        ? {
            ...(job.customerId ? { customerId: job.customerId } : {}),
            ...(job.assetId ? { assetId: job.assetId } : {}),
            status: "pending" as const,
            sortBy: "urgencyScore" as const,
            sortOrder: "desc" as const,
            page: 1,
            limit: 3
          }
        : null,
    [job]
  );
  const recommendationsQuery = useRecommendations(
    recommendationFilters ?? {
      customerId: "00000000-0000-0000-0000-000000000000",
      status: "pending",
      page: 1,
      limit: 1
    }
  );
  const suggestion = recommendationFilters ? recommendationsQuery.data?.data?.[0] ?? null : null;

  if (jobQuery.isLoading || tasksQuery.isLoading || productsQuery.isLoading || companyQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <SkeletonCard className="h-[120px]" />
        <SkeletonCard className="h-[220px]" />
        <SkeletonCard className="h-[320px]" />
      </div>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          icon={CarFront}
          title="Job not found"
          subtitle="This job may have been removed or may not belong to the current technician."
          compact
        />
      </div>
    );
  }

  const taxRate = getCompanyTaxRate(companyQuery.data?.company.settings);

  if (isTablet) {
    return <TabletJobDetail job={job} tasks={tasks} products={products} taxRate={taxRate} suggestion={suggestion} />;
  }

  const assetBadge = getAssetBadge(job.asset);

  function handleTabChange(nextTab: MobileJobTab) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === "details") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[#fbf6ef] px-4 py-4 pb-32">
      <div className="mx-auto w-full max-w-[390px] space-y-4">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/mobile/jobs" className="inline-flex min-h-11 items-center text-sm text-[#5e6684]">
              ‹ Today
            </Link>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", getCrewStatusTone(job.status))}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {getCrewStatusLabel(job.status)}
            </span>
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[#0f1530]">{job.title}</h1>
          <p className="text-sm text-[#5e6684]">
            {[job.jobNumber, `${job.customer.firstName} ${job.customer.lastName}`.trim(), job.property?.addressLine1 ?? "Address pending"].join(" · ")}
          </p>
        </header>

        <nav className="sticky top-3 z-10 -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2 rounded-[24px] bg-white p-1 shadow-sm ring-1 ring-neutral-200">
            {tabOptions.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center rounded-[18px] px-4 text-sm font-semibold transition",
                  activeTab === tab.key ? "bg-brand-accent text-white" : "text-neutral-500",
                  isPending && activeTab !== tab.key && "opacity-80"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="space-y-4">
          <div className={cn(activeTab === "details" ? "block" : "hidden")}>
            <div className="space-y-4">
              <section className="rounded-[14px] bg-[#0f1530] px-5 py-5 text-white">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#f6b400]">Work order</p>
                <p className="mt-3 text-[17px] font-semibold leading-snug">
                  {job.description ?? "No work order description yet."}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/85">
                  {job.asset ? (
                    <li>• {[job.asset.name, job.asset.model, assetBadge.installYear].filter(Boolean).join(" · ")}</li>
                  ) : null}
                  {job.property ? (
                    <li>• {job.property.addressLine1}, {job.property.city}, {job.property.state}</li>
                  ) : null}
                </ul>
              </section>

              <CrewChecklist jobId={job.id} tasks={tasks} label="Checklist" emptyText="No checklist items on this job." />

              <section className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">Notes · visible to office</p>
                {job.techNotes ? <p className="mt-3 text-[15px] text-[#0f1530]">{job.techNotes}</p> : null}
                <MobileJobNoteComposer jobId={job.id} />
                <button
                  type="button"
                  onClick={() => handleTabChange("files")}
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[#2d4bd8]"
                >
                  + Add photo or note
                </button>
              </section>

              <MobileTimeCard jobId={job.id} technicianId={job.technicianId} />

              {suggestion ? (
                <section className="rounded-[28px] border border-ai/10 bg-ai-light/70 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-1 h-4 w-4 shrink-0 text-ai" />
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">AI Suggestion</p>
                      <p className="mt-1 text-sm text-neutral-700">{suggestion.headline}</p>
                      <p className="mt-2 text-xs leading-5 text-neutral-500">{suggestion.body}</p>
                      <Link href={`/mobile/jobs/${job.id}/complete`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent">
                        Create Estimate →
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <div className={cn(activeTab === "tasks" ? "block" : "hidden")}>
            <TaskChecklist jobId={job.id} tasks={tasks} />
          </div>

          <div className={cn(activeTab === "products" ? "block" : "hidden")}>
            <JobProductsPanel jobId={job.id} products={products} taxRate={taxRate} suggestion={suggestion} />
          </div>

          <div className={cn(activeTab === "files" ? "block" : "hidden")}>
            <AttachmentsPanel jobId={job.id} />
          </div>
        </div>
      </div>

      <JobActionBar jobId={job.id} status={job.status} onAddParts={() => handleTabChange("products")} />
    </div>
  );
}
