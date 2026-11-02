"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, Clock3, FileText, MapPinned, UserRoundPlus, X } from "lucide-react";
import type { JobDetail } from "@fsm/types";

import { useCreateReviewRequest, useTransitionJob } from "@/src/hooks/jobs.hooks";
import { ApiError } from "@/src/lib/api";

import { formatStatusLabel } from "./jobs.utils";

interface JobStatusTransitionsProps {
  job: JobDetail;
  pendingRequiredTasks: number;
  onOpenOTW: () => void;
  /** FS-24: when set, scheduled-visit Reschedule/Cancel open the schedule-change forms (window policy + versioning). */
  onReschedule?: (() => void) | undefined;
  onCancelVisit?: (() => void) | undefined;
}

export function JobStatusTransitions({ job, pendingRequiredTasks, onOpenOTW, onReschedule, onCancelVisit }: JobStatusTransitionsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const transitionJob = useTransitionJob(job.id);
  const createReviewRequest = useCreateReviewRequest(job.id);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [overrideRequiredTasks, setOverrideRequiredTasks] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMobileRoute = pathname.startsWith("/mobile");

  const actions = useMemo(() => {
    switch (job.status) {
      case "lead":
        return [
          { key: "assign", label: "Assign Tech", tone: "secondary" as const, onClick: () => router.push(`/dispatch?jobId=${job.id}`), icon: UserRoundPlus },
          { key: "schedule", label: "Schedule", tone: "primary" as const, onClick: () => router.push(`/dispatch?jobId=${job.id}`), icon: Clock3 },
          { key: "cancel", label: "Cancel", tone: "ghost" as const, onClick: () => void handleStatusChange("cancelled"), icon: X }
        ];
      case "scheduled":
        return [
          { key: "reschedule", label: "Reschedule", tone: "secondary" as const, onClick: onReschedule ?? (() => router.push(`/dispatch?jobId=${job.id}`)), icon: Clock3 },
          { key: "otw", label: "On The Way", tone: "secondary" as const, onClick: onOpenOTW, icon: MapPinned },
          { key: "start", label: "Start Job", tone: "primary" as const, onClick: () => void handleStatusChange("in_progress"), icon: CheckCircle2 },
          { key: "cancel", label: "Cancel", tone: "ghost" as const, onClick: onCancelVisit ?? (() => void handleStatusChange("cancelled")), icon: X }
        ];
      case "in_progress":
        return [
          { key: "complete", label: "Complete Job", tone: "secondary" as const, onClick: () => setCompleteDialogOpen(true), icon: CheckCircle2 },
          { key: "invoice", label: "Create Invoice", tone: "primary" as const, onClick: () => router.push(`/invoices?jobId=${job.id}`), icon: FileText },
          { key: "reschedule", label: "Reschedule", tone: "ghost" as const, onClick: () => router.push(`/dispatch?jobId=${job.id}`), icon: Clock3 }
        ];
      case "completed":
        return [
          { key: "invoice", label: "Create Invoice", tone: "primary" as const, onClick: () => router.push(`/invoices?jobId=${job.id}`), icon: FileText },
          { key: "review", label: "Request Review", tone: "secondary" as const, onClick: () => void handleRequestReview(), icon: CheckCircle2 }
        ];
      case "invoiced":
        return [
          { key: "view-invoice", label: "View Invoice", tone: "primary" as const, onClick: () => router.push(`/invoices?jobId=${job.id}`), icon: FileText }
        ];
      default:
        return job.availableTransitions.map((status) => ({
          key: status,
          label: formatStatusLabel(status),
          tone: "secondary" as const,
          onClick: () => void handleStatusChange(status),
          icon: CheckCircle2
        }));
    }
  }, [job.availableTransitions, job.id, job.status, onCancelVisit, onOpenOTW, onReschedule, router]);

  async function handleStatusChange(status: typeof job.status) {
    setErrorMessage(null);

    try {
      await transitionJob.mutateAsync({ status });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Status could not be updated.");
    }
  }

  async function handleRequestReview() {
    setErrorMessage(null);

    try {
      await createReviewRequest.mutateAsync({ channel: "sms" });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Review request could not be sent.");
    }
  }

  async function handleComplete() {
    setErrorMessage(null);

    try {
      await transitionJob.mutateAsync({ status: "completed" });
      setCompleteDialogOpen(false);
      setOverrideRequiredTasks(false);

      if (isMobileRoute) {
        router.push(`/mobile/signature?jobId=${job.id}`);
        return;
      }

      router.push(`/invoices?jobId=${job.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Job could not be completed.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={transitionJob.isPending || createReviewRequest.isPending}
              className={
                action.tone === "primary"
                  ? "inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                  : action.tone === "secondary"
                    ? "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
                    : "inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70"
              }
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </button>
          );
        })}
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-3xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">{errorMessage}</p>
      ) : null}

      <AnimatePresence>
        {completeDialogOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/35 px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCompleteDialogOpen(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-lg rounded-[32px] bg-white px-6 py-6 shadow-[0_30px_90px_rgba(16,33,99,0.24)]"
            >
              <h3 className="text-xl font-semibold tracking-tight text-neutral-900">Complete this job?</h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Completing the job will lock the checklist and move the desktop flow straight into invoice creation.
              </p>

              {pendingRequiredTasks > 0 ? (
                <div className="mt-5 rounded-[24px] border border-warning/25 bg-warning-light px-4 py-4 text-sm text-neutral-700">
                  <p className="font-semibold text-neutral-900">Are all required tasks complete?</p>
                  <p className="mt-2">
                    {pendingRequiredTasks} required {pendingRequiredTasks === 1 ? "task is" : "tasks are"} still open.
                  </p>
                  <label className="mt-4 inline-flex items-center gap-2 font-medium text-neutral-700">
                    <input
                      type="checkbox"
                      checked={overrideRequiredTasks}
                      onChange={(event) => setOverrideRequiredTasks(event.target.checked)}
                    />
                    Complete anyway
                  </label>
                </div>
              ) : null}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCompleteDialogOpen(false);
                    setOverrideRequiredTasks(false);
                  }}
                  className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={transitionJob.isPending || (pendingRequiredTasks > 0 && !overrideRequiredTasks)}
                  onClick={() => {
                    void handleComplete();
                  }}
                  className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {transitionJob.isPending ? "Completing..." : "Complete Job"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
