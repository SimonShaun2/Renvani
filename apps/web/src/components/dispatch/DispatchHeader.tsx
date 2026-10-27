"use client";

import "./dispatch-motion.css";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { cn } from "@/src/lib/utils";

export interface DispatchUnassignedJob {
  id: string;
  label: string;
}

interface DispatchHeaderProps {
  summaryText: string;
  streamLive: boolean;
  unassignedJob: DispatchUnassignedJob | null;
  autoFitPending: boolean;
  canAddVisit: boolean;
  onAutoAssign: (jobId: string) => void;
  onAddVisit: () => void;
}

/** Figma "Operator / 03 Dispatch board" (10:478): title row (10:544–10:548) and unassigned banner (10:553). */
export function DispatchHeader({
  summaryText,
  streamLive,
  unassignedJob,
  autoFitPending,
  canAddVisit,
  onAutoAssign,
  onAddVisit
}: DispatchHeaderProps) {
  return (
    <div className="space-y-4">
      <header data-dispatch-reveal className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] font-semibold tracking-[-0.64px] text-[#0f1530]">Dispatch</h1>
            <span
              data-testid="dispatch-live-status"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                streamLive ? "bg-[#e3f1e6] text-[#256b3a]" : "bg-neutral-100 text-neutral-500"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", streamLive ? "bg-[#256b3a]" : "bg-neutral-400")} />
              {streamLive ? "Live" : "Refreshing every 30s"}
            </span>
          </div>
          <p className="text-sm text-[#5e6684]">{summaryText}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!unassignedJob || autoFitPending}
            onClick={() => unassignedJob && onAutoAssign(unassignedJob.id)}
            className="h-11 rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm font-semibold text-[#0f1530] transition hover:border-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Auto-assign (proposal)
          </button>
          <button
            type="button"
            disabled={!canAddVisit}
            onClick={onAddVisit}
            className="h-11 rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white transition hover:bg-[#18204a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add visit
          </button>
        </div>
      </header>

      {unassignedJob ? (
        <section
          data-dispatch-reveal
          aria-label="Unassigned job"
          className="flex flex-col gap-3 rounded-[14px] bg-[#fff4d6] px-[18px] py-[14px] md:flex-row md:items-center"
        >
          <span className="inline-flex shrink-0 items-center gap-[6px] rounded-full px-[10px] py-1 text-xs font-semibold text-[#7a5600]">
            <img src="/dispatch/status-unassigned-dot.svg" alt="" width={6} height={6} />
            Unassigned
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0f1530]">{unassignedJob.label}</p>
          <p className="text-[13px] text-[#2a3360]">Scheduling Agent can propose a crew and time. Nothing changes until you accept.</p>
          <button
            type="button"
            disabled={autoFitPending}
            onClick={() => onAutoAssign(unassignedJob.id)}
            className="h-9 shrink-0 rounded-[10px] bg-[#f6b400] px-[14px] text-[13px] font-semibold text-[#0f1530] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoFitPending ? "Finding fit..." : "Review proposal"}
          </button>
        </section>
      ) : null}
    </div>
  );
}

export function DispatchLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section role="alert" className="surface-card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-warning" />
      <p className="text-base font-semibold text-neutral-900">The dispatch board couldn&apos;t load</p>
      <p className="text-sm text-neutral-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2 text-sm font-semibold text-[#0f1530] transition hover:border-neutral-300"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </section>
  );
}
