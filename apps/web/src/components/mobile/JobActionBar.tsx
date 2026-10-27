"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CarFront, CheckCircle2, CreditCard, Play } from "lucide-react";
import type { JobStatus } from "@fsm/types";

import { useTransitionJob } from "@/src/hooks/jobs.hooks";
import { showToast } from "@/src/stores/toast.store";

import { ReportIssuePanel } from "./ReportIssuePanel";

const ISSUE_STATUSES: JobStatus[] = ["scheduled", "dispatched", "in_progress", "on_hold"];

interface JobActionBarProps {
  jobId: string;
  status: JobStatus;
}

export function JobActionBar({ jobId, status }: JobActionBarProps) {
  const router = useRouter();
  const transitionJob = useTransitionJob(jobId);
  const [issueOpen, setIssueOpen] = useState(false);
  const canReportIssue = ISSUE_STATUSES.includes(status);

  async function handleStartJob() {
    try {
      await transitionJob.mutateAsync({ status: "in_progress" });
      showToast({
        tone: "success",
        title: "Job started",
        description: "Time tracking and technician progress are now live."
      });
      router.refresh();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not start job",
        description: error instanceof Error ? error.message : "Try again in a moment."
      });
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-20 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-18px_60px_rgba(16,33,99,0.14)] backdrop-blur md:bottom-0 md:left-[280px] md:px-6">
      {issueOpen ? <ReportIssuePanel jobId={jobId} onClose={() => setIssueOpen(false)} /> : null}
      <div className="mx-auto flex w-full max-w-[390px] gap-3 md:max-w-none">
        {status === "scheduled" || status === "dispatched" ? (
          <>
            <Link
              href={`/mobile/otw/${jobId}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
            >
              <CarFront className="h-4 w-4" />
              OTW
            </Link>
            <button
              type="button"
              disabled={transitionJob.isPending}
              onClick={() => {
                void handleStartJob();
              }}
              className="inline-flex min-h-11 flex-[1.2] items-center justify-center gap-2 rounded-2xl bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              {transitionJob.isPending ? "Starting..." : "Start Job"}
            </button>
          </>
        ) : null}

        {status === "in_progress" ? (
          <Link
            href={`/mobile/jobs/${jobId}/complete`}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-4 text-sm font-semibold text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            Complete Job
          </Link>
        ) : null}

        {canReportIssue && !issueOpen ? (
          <button
            type="button"
            aria-label="Report issue"
            onClick={() => setIssueOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700"
          >
            <AlertTriangle className="h-4 w-4" />
            Issue
          </button>
        ) : null}

        {(status === "completed" || status === "invoiced" || status === "paid") ? (
          <Link
            href="/invoices"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 text-sm font-semibold text-white"
          >
            <CreditCard className="h-4 w-4" />
            Create Invoice
          </Link>
        ) : null}
      </div>
    </div>
  );
}
