"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarFront, CheckCircle2, CreditCard, Play } from "lucide-react";
import type { JobStatus } from "@fsm/types";

import { useTransitionJob } from "@/src/hooks/jobs.hooks";
import { showToast } from "@/src/stores/toast.store";

interface JobActionBarProps {
  jobId: string;
  status: JobStatus;
  onAddParts?: () => void;
}

export function JobActionBar({ jobId, status, onAddParts }: JobActionBarProps) {
  const router = useRouter();
  const transitionJob = useTransitionJob(jobId);

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
      <div className="mx-auto flex w-full max-w-[390px] gap-3 md:max-w-none">
        {status === "scheduled" || status === "dispatched" ? (
          <>
            <Link
              href={`/mobile/otw/${jobId}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
            >
              <CarFront className="h-4 w-4" />
              On the way
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
              {transitionJob.isPending ? "Starting..." : "Start job"}
            </button>
          </>
        ) : null}

        {status === "in_progress" ? (
          <>
            {onAddParts ? (
              <button
                type="button"
                onClick={onAddParts}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-[12px] border border-[#e6dccb] bg-white px-4 text-[15px] font-semibold text-[#0f1530]"
              >
                Add parts
              </button>
            ) : null}
            <Link
              href={`/mobile/jobs/${jobId}/complete`}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#f6b400] px-4 text-[15px] font-semibold text-[#0f1530]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete job
            </Link>
          </>
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
