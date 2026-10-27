"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { CalendarRange } from "lucide-react";
import type { DispatchGap, DispatchJobCard, DispatchTechnicianDay } from "@fsm/types";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import type { CreateQuickJobInput } from "@/src/hooks/dispatch.hooks";
import { cn } from "@/src/lib/utils";

import { DispatchInlineJobForm } from "./DispatchInlineJobForm";
import type { DispatchDropSlot, DispatchDropTargetData } from "./dispatch.utils";
import {
  DISPATCH_DAY_END_HOUR,
  DISPATCH_DAY_START_HOUR,
  formatDispatchRange,
  formatTimelineHour,
  getTimelineStyle,
  buildDispatchSlotFromGap
} from "./dispatch.utils";

const timelineWidthClass = "min-w-[1000px]";
const laneGridClass = "grid grid-cols-[180px_minmax(0,1fr)]";

/** Proposed placement from auto-fit, drawn as the dashed "Suggested" block (Figma 10:590). */
export interface DispatchTimelineSuggestion {
  technicianId: string;
  label: string;
  scheduledStart: string;
  scheduledEnd: string;
}

/** Figma 10:575/10:587/10:599 block tones: blue scheduled, green on site, red needs attention. */
export function getTimelineBlockTone(status: string) {
  switch (status) {
    case "dispatched":
    case "in_progress":
    case "completed":
    case "paid":
    case "closed":
      return "bg-[#e4f1e8] text-[#2f7d4f]";
    case "on_hold":
    case "cancelled":
      return "bg-[#fbe3dc] text-[#b42318]";
    default:
      return "bg-[#e5eafb] text-[#2b4acb]";
  }
}

/** "2.5 h" style duration (Figma 10:574). */
export function formatBlockHours(start: string | Date, end: string | Date): string {
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

interface DispatchTimelineProps {
  technicians: DispatchTechnicianDay[];
  isLoading: boolean;
  selectedJobId: string | null;
  animatedJobId: string | null;
  quickCreateSlot: DispatchDropSlot | null;
  createQuickJobPending: boolean;
  createQuickJobError: string | null;
  activeDragJobId: string | null;
  overlay?: ReactNode;
  suggestion?: DispatchTimelineSuggestion | null;
  onSelectJob: (jobId: string) => void;
  onOpenQuickCreate: (slot: DispatchDropSlot) => void;
  onCloseQuickCreate: () => void;
  onCreateQuickJob: (input: CreateQuickJobInput) => Promise<void>;
}

/** Figma 10:559: mono uppercase header, "Crew" column + hour labels 8 … 5. */
function TimelineHeader() {
  const hours = Array.from(
    { length: DISPATCH_DAY_END_HOUR - DISPATCH_DAY_START_HOUR },
    (_, index) => DISPATCH_DAY_START_HOUR + index
  );

  return (
    <div
      className={cn(
        laneGridClass,
        timelineWidthClass,
        "bg-[#fbf6ef] px-5 py-[10px] font-mono text-[10px] font-medium uppercase tracking-[0.8px] text-[#5e6684]"
      )}
    >
      <p>Crew</p>
      <div className="grid grid-cols-10">
        {hours.map((hour) => (
          <p key={hour}>{formatTimelineHour(hour)}</p>
        ))}
      </div>
    </div>
  );
}

function TimelineGap({
  gap,
  technician,
  isDragging,
  onOpenQuickCreate
}: {
  gap: DispatchGap;
  technician: DispatchTechnicianDay;
  isDragging: boolean;
  onOpenQuickCreate: (slot: DispatchDropSlot) => void;
}) {
  const slot = buildDispatchSlotFromGap(technician.id, technician.name, gap);
  const dropData: DispatchDropTargetData = {
    type: "dispatch-slot",
    slot
  };
  const { setNodeRef, isOver } = useDroppable({
    id: `dispatch-slot:${technician.id}:${gap.start}`,
    data: dropData
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`Add visit for ${technician.name} at ${formatDispatchRange(gap.start, gap.end)}`}
      onClick={() => onOpenQuickCreate(slot)}
      style={getTimelineStyle(gap.start, gap.end)}
      className={cn(
        "absolute top-3 z-0 flex h-[72px] items-center justify-center rounded-[10px] border border-dashed text-[11px] font-semibold text-[#7a5600] transition",
        isDragging || isOver
          ? "border-[#f6b400] bg-[#fff4d6]/70 opacity-100"
          : "border-transparent opacity-0 hover:border-[#e6dccb] hover:opacity-100 focus-visible:opacity-100"
      )}
    >
      {isDragging ? "Drop here" : "Add visit"}
    </button>
  );
}

function TimelineJobBlock({
  job,
  isSelected,
  isAnimated,
  onSelectJob
}: {
  job: DispatchJobCard;
  isSelected: boolean;
  isAnimated: boolean;
  onSelectJob: (jobId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectJob(job.id)}
      title={formatDispatchRange(job.scheduledStart, job.scheduledEnd)}
      style={getTimelineStyle(job.scheduledStart, job.scheduledEnd)}
      className={cn(
        "absolute top-3 z-10 flex h-[72px] flex-col items-start gap-[2px] overflow-hidden rounded-[10px] px-3 py-[10px] text-left transition",
        getTimelineBlockTone(job.status),
        isSelected && "ring-2 ring-[#0f1530] ring-offset-1 ring-offset-white",
        isAnimated && "dispatch-block-settle"
      )}
    >
      <p className="w-full truncate text-xs font-semibold">
        {[job.title, job.customer.lastName].filter(Boolean).join(" · ")}
      </p>
      <p className="text-[11px]">{formatBlockHours(job.scheduledStart, job.scheduledEnd)}</p>
    </button>
  );
}

function SuggestedBlock({ suggestion }: { suggestion: DispatchTimelineSuggestion }) {
  return (
    <div
      data-testid="dispatch-suggested-block"
      style={getTimelineStyle(suggestion.scheduledStart, suggestion.scheduledEnd)}
      className="absolute top-3 z-20 flex h-[72px] flex-col items-start gap-[2px] overflow-hidden rounded-[10px] border-2 border-dashed border-[#f6b400] bg-[#fff4d6] px-3 py-[10px] text-[#7a5600]"
    >
      <p className="w-full truncate text-xs font-semibold">Suggested · {suggestion.label}</p>
      <p className="text-[11px]">{formatBlockHours(suggestion.scheduledStart, suggestion.scheduledEnd)}</p>
    </div>
  );
}

function TechnicianRow({
  technician,
  selectedJobId,
  animatedJobId,
  quickCreateSlot,
  createQuickJobPending,
  createQuickJobError,
  activeDragJobId,
  suggestion,
  onSelectJob,
  onOpenQuickCreate,
  onCloseQuickCreate,
  onCreateQuickJob
}: {
  technician: DispatchTechnicianDay;
  selectedJobId: string | null;
  animatedJobId: string | null;
  quickCreateSlot: DispatchDropSlot | null;
  createQuickJobPending: boolean;
  createQuickJobError: string | null;
  activeDragJobId: string | null;
  suggestion: DispatchTimelineSuggestion | null;
  onSelectJob: (jobId: string) => void;
  onOpenQuickCreate: (slot: DispatchDropSlot) => void;
  onCloseQuickCreate: () => void;
  onCreateQuickJob: (input: CreateQuickJobInput) => Promise<void>;
}) {
  const rowHasQuickCreate = Boolean(
    quickCreateSlot?.technicianId === technician.id &&
      quickCreateSlot.scheduledStart &&
      quickCreateSlot.scheduledEnd
  );

  return (
    <div
      data-testid="dispatch-lane"
      className={cn(laneGridClass, timelineWidthClass, "relative h-[96px] border-t border-[#e6dccb] px-5")}
    >
      <p className="self-center truncate pr-3 text-sm font-semibold text-[#0f1530]">{technician.name}</p>

      <div className="relative">
        {technician.hoursAvailable <= 0 && technician.jobs.length === 0 ? (
          <div className="absolute inset-x-0 top-3 z-10 flex h-[72px] items-center justify-center rounded-[10px] bg-neutral-100 text-xs font-semibold uppercase tracking-[0.8px] text-neutral-500">
            Out
          </div>
        ) : null}

        {technician.gaps.map((gap) => (
          <TimelineGap
            key={`${technician.id}-${gap.start}`}
            gap={gap}
            technician={technician}
            isDragging={Boolean(activeDragJobId)}
            onOpenQuickCreate={onOpenQuickCreate}
          />
        ))}

        {technician.jobs.map((job) => (
          <TimelineJobBlock
            key={job.id}
            job={job}
            isSelected={selectedJobId === job.id}
            isAnimated={animatedJobId === job.id}
            onSelectJob={onSelectJob}
          />
        ))}

        {suggestion ? <SuggestedBlock suggestion={suggestion} /> : null}

        {rowHasQuickCreate && quickCreateSlot ? (
          <DispatchInlineJobForm
            slot={quickCreateSlot}
            isSubmitting={createQuickJobPending}
            errorMessage={createQuickJobError}
            onCancel={onCloseQuickCreate}
            onSubmit={onCreateQuickJob}
          />
        ) : null}
      </div>
    </div>
  );
}

function TimelineLoading() {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#e6dccb] bg-white">
      <TimelineHeader />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className={cn(laneGridClass, timelineWidthClass, "h-[96px] items-center border-t border-[#e6dccb] px-5")}>
          <SkeletonCard className="h-4 w-28" />
          <SkeletonCard className="h-[72px]" />
        </div>
      ))}
    </section>
  );
}

export function DispatchTimeline({
  technicians,
  isLoading,
  selectedJobId,
  animatedJobId,
  quickCreateSlot,
  createQuickJobPending,
  createQuickJobError,
  activeDragJobId,
  overlay,
  suggestion = null,
  onSelectJob,
  onOpenQuickCreate,
  onCloseQuickCreate,
  onCreateQuickJob
}: DispatchTimelineProps) {
  if (isLoading) {
    return <TimelineLoading />;
  }

  if (technicians.length === 0) {
    return (
      <section className="surface-card p-8">
        <EmptyState
          icon={CalendarRange}
          title="No technicians match these filters"
          subtitle="Try widening the date or technician filters. Once jobs and techs line up, the dispatch canvas will populate here."
        />
      </section>
    );
  }

  return (
    <section
      data-dispatch-reveal
      className="relative overflow-x-auto rounded-[14px] border border-[#e6dccb] bg-white"
    >
      {overlay}
      <div>
        <TimelineHeader />
        {technicians.map((technician) => (
          <TechnicianRow
            key={technician.id}
            technician={technician}
            selectedJobId={selectedJobId}
            animatedJobId={animatedJobId}
            quickCreateSlot={quickCreateSlot}
            createQuickJobPending={createQuickJobPending}
            createQuickJobError={createQuickJobError}
            activeDragJobId={activeDragJobId}
            suggestion={suggestion?.technicianId === technician.id ? suggestion : null}
            onSelectJob={onSelectJob}
            onOpenQuickCreate={onOpenQuickCreate}
            onCloseQuickCreate={onCloseQuickCreate}
            onCreateQuickJob={onCreateQuickJob}
          />
        ))}
      </div>
    </section>
  );
}
