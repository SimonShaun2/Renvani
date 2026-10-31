"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, Sparkles } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useRecommendations } from "@/src/hooks/ai-revenue.hooks";
import { useAuthStore } from "@/src/stores/auth.store";
import {
  useCompany,
  useJob,
  useJobProducts,
  useJobTasks,
  useUpdateJob
} from "@/src/hooks/jobs.hooks";

import { AttachmentsPanel } from "./AttachmentsPanel";
import { JobActivityTimeline } from "./JobActivityTimeline";
import { JobAISuggestion } from "./JobAISuggestion";
import { JobContextCards } from "./JobContextCards";
import { CreateInvoiceAction } from "./create-invoice/CreateInvoiceAction";
import { JobHeader } from "./JobHeader";
import { JobProductsPanel } from "./JobProductsPanel";
import { OTWPanel } from "./OTWPanel";
import { TaskChecklist } from "./TaskChecklist";
import { TimeTrackingPanel } from "./TimeTrackingPanel";
import { getCompanyTaxRate, getTaskProgress } from "./jobs.utils";
import { JobScheduleChangesPanel, type ScheduleChangeMode } from "./schedule-changes/JobScheduleChangesPanel";
import { canManageSchedule } from "./schedule-changes/schedule-changes.utils";

interface JobDetailClientProps {
  jobId: string;
}

export function JobDetailClient({ jobId }: JobDetailClientProps) {
  const jobQuery = useJob(jobId);
  const tasksQuery = useJobTasks(jobId);
  const productsQuery = useJobProducts(jobId);
  const companyQuery = useCompany();
  const updateJob = useUpdateJob(jobId);
  const [notesValue, setNotesValue] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [otwComposerOpen, setOtwComposerOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleChangeMode>(null);
  const canChangeSchedule = canManageSchedule(useAuthStore((state) => state.user?.role ?? null));

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
  const recommendations = recommendationFilters ? recommendationsQuery.data?.data ?? [] : [];
  const topSuggestion = recommendations[0] ?? null;
  const upsellSuggestion =
    recommendations.find((recommendation) =>
      ["aging_asset", "upsell_opportunity", "maintenance_plan_offer"].includes(recommendation.type)
    ) ?? topSuggestion;
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!job) {
      return;
    }

    setNotesValue(job.techNotes ?? "");
  }, [job]);

  const progress = getTaskProgress(tasks);
  const taxRate = getCompanyTaxRate(companyQuery.data?.company.settings);

  async function handleNotesBlur() {
    if (!job) {
      return;
    }

    const nextValue = notesValue.trim();
    const currentValue = (job.techNotes ?? "").trim();

    if (nextValue === currentValue) {
      return;
    }

    setNoteError(null);
    setNoteState("saving");

    try {
      await updateJob.mutateAsync({
        techNotes: nextValue
      });
      setNoteState("saved");
      window.setTimeout(() => setNoteState("idle"), 1800);
    } catch (error) {
      setNoteState("idle");
      setNoteError(error instanceof Error ? error.message : "Notes could not be saved.");
    }
  }

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[180px]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)]">
          <div className="space-y-6">
            <SkeletonCard className="h-[148px]" />
            <SkeletonCard className="h-[520px]" />
            <SkeletonCard className="h-[180px]" />
          </div>
          <div className="space-y-6">
            <SkeletonCard className="h-[480px]" />
            <SkeletonCard className="h-[420px]" />
            <SkeletonCard className="h-[420px]" />
          </div>
        </div>
        <SkeletonCard className="h-[320px]" />
      </div>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title="Job not found"
        subtitle="This job may have been deleted or you may not have access to it in the current company."
        action={
          <a href="/jobs" className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
            Back to jobs
          </a>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <JobHeader
        job={job}
        pendingRequiredTasks={progress.pendingRequired.length}
        onOpenOTW={() => setOtwComposerOpen(true)}
        invoiceAction={<CreateInvoiceAction job={job} products={products} taxRate={taxRate > 0 ? taxRate : null} />}
        onReschedule={canChangeSchedule ? () => setScheduleMode("reschedule") : undefined}
        onCancelVisit={canChangeSchedule ? () => setScheduleMode("cancel") : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)]">
        <div className="space-y-6">
          <JobContextCards job={job} />

          <section className="surface-card px-6 py-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-accent" />
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Job Notes</h2>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Issue / Description</p>
                <p className="mt-3 text-sm leading-6 text-neutral-700">{job.description ?? "No issue summary has been added yet."}</p>
              </div>

              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Internal Notes</p>
                <textarea
                  value={notesValue}
                  onChange={(event) => {
                    setNotesValue(event.target.value);
                    setNoteState("idle");
                  }}
                  onBlur={() => {
                    void handleNotesBlur();
                  }}
                  placeholder="Capture technician notes, parts needed, and dispatch context."
                  className="mt-3 min-h-32 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-700 outline-none transition focus:border-brand-accent"
                />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-neutral-400">Auto-saves on blur</span>
                  <span className={noteState === "saving" ? "text-brand-accent" : "text-success"}>
                    {noteState === "saving" ? "Saving..." : noteState === "saved" ? "Saved" : ""}
                  </span>
                </div>
                {noteError ? <p className="mt-2 text-sm text-error">{noteError}</p> : null}
              </div>
            </div>
          </section>

          <TaskChecklist jobId={job.id} tasks={tasks} />
          <JobAISuggestion
            recommendation={dismissedSuggestionIds.includes(topSuggestion?.id ?? "") ? null : topSuggestion}
            dismissed={dismissedSuggestionIds.includes(topSuggestion?.id ?? "")}
            onDismiss={() => {
              if (!topSuggestion) {
                return;
              }

              setDismissedSuggestionIds((current) => [...current, topSuggestion.id]);
            }}
          />
        </div>

        <div className="space-y-6 xl:border-l xl:border-neutral-200 xl:pl-6">
          <JobScheduleChangesPanel jobId={job.id} mode={scheduleMode} onModeChange={setScheduleMode} />
          <JobProductsPanel
            jobId={job.id}
            products={products}
            taxRate={taxRate}
            suggestion={upsellSuggestion}
          />
          <TimeTrackingPanel jobId={job.id} job={job} />
          <OTWPanel
            jobId={job.id}
            job={job}
            openComposer={otwComposerOpen}
            onComposerOpenChange={setOtwComposerOpen}
          />
          <AttachmentsPanel jobId={job.id} />
        </div>
      </div>

      {(tasksQuery.isError || productsQuery.isError || companyQuery.isError) ? (
        <section className="rounded-[28px] border border-warning/20 bg-warning-light px-5 py-4 text-sm text-neutral-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              Some secondary job panels could not be loaded. The main job detail is still available, but tasks,
              products, company tax settings, or AI suggestions may be incomplete right now.
            </p>
          </div>
        </section>
      ) : null}

      <JobActivityTimeline jobId={job.id} />
    </div>
  );
}
