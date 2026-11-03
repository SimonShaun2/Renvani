"use client";

import Link from "next/link";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, Clock3, GripVertical, Sparkles, WandSparkles } from "lucide-react";
import type { DispatchNextBestJob, DispatchView } from "@fsm/types";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { LoadErrorState } from "@/src/components/ui/LoadErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { TimeAgo } from "@/src/components/ui/TimeAgo";
import type { UnscheduledJobListItem } from "@/src/hooks/dashboard.hooks";
import type { ApprovedEstimateQueueItem, BookingRequestListItem } from "@/src/hooks/dispatch.hooks";
import { cn } from "@/src/lib/utils";
import type { DispatchTab } from "@/src/stores/dispatch.store";

import type { DispatchDragJobData } from "./dispatch.utils";
import { getPriorityTone, getUrgencyTone, isNewItem } from "./dispatch.utils";

interface DispatchQueuePanelProps {
  activeTab: DispatchTab;
  selectedJobId: string | null;
  selectedBookingRequestId: string | null;
  dispatchView: DispatchView | undefined;
  isLoading: boolean;
  bookingRequests: BookingRequestListItem[];
  bookingRequestsLoading: boolean;
  unscheduledJobs: UnscheduledJobListItem[];
  unscheduledLoading: boolean;
  approvedEstimates: ApprovedEstimateQueueItem[];
  approvedEstimatesLoading: boolean;
  search: string;
  onSelectTab: (tab: DispatchTab) => void;
  onSelectJob: (jobId: string) => void;
  onSelectBookingRequest: (bookingRequestId: string) => void;
  onAutoFitJob: (jobId: string, preferredTechnicianId: string | null) => Promise<void>;
  onConvertEstimate: (estimateId: string) => Promise<void>;
  autoFittingJobId: string | null;
  convertingEstimateId: string | null;
  /** Set when the matching query failed; shows an error with Retry instead of the empty state. */
  smartQueueError?: QueueLoadError | null;
  bookingRequestsError?: QueueLoadError | null;
  unscheduledError?: QueueLoadError | null;
  approvedEstimatesError?: QueueLoadError | null;
}

export interface QueueLoadError {
  onRetry: () => void;
  isRetrying: boolean;
}

function QueueError({ title, error }: { title: string; error: QueueLoadError }) {
  return <LoadErrorState compact title={title} onRetry={error.onRetry} isRetrying={error.isRetrying} />;
}

const bookingSourceFilters = [
  { id: "all", label: "All Sources" },
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "direct", label: "Direct" }
] as const;

interface QueueTabButtonProps {
  isActive: boolean;
  label: string;
  count: number;
  onClick: () => void;
}

interface DraggableJobCardProps {
  id: string;
  label: string;
  subtitle: string;
  meta: string;
  tone: "blue" | "orange" | "purple";
  isSelected: boolean;
  preferredTechnicianId: string | null;
  onClick: () => void;
}

function QueueTabButton({ isActive, label, count, onClick }: QueueTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
        isActive ? "bg-brand-accent text-white shadow-sm" : "bg-neutral-100 text-neutral-500 hover:text-neutral-800"
      )}
    >
      <span>{label}</span>
      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", isActive ? "bg-white/20" : "bg-white text-neutral-500")}>{count}</span>
    </button>
  );
}

function DraggableJobCard({ id, label, subtitle, meta, tone, isSelected, preferredTechnicianId, onClick }: DraggableJobCardProps) {
  const dragData: DispatchDragJobData = {
    type: "dispatch-job",
    jobId: id,
    label,
    subtitle,
    preferredTechnicianId
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `dispatch-job:${id}`,
    data: dragData
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
            }
          : undefined
      }
      className={cn(
        "w-full rounded-[24px] border bg-white px-4 py-4 text-left shadow-sm transition",
        isDragging && "opacity-60 shadow-[0_24px_70px_rgba(37,122,250,0.18)]",
        isSelected ? "border-brand-accent shadow-[0_20px_48px_rgba(37,122,250,0.18)]" : "border-neutral-200 hover:border-brand-accent/30",
        tone === "purple" && "before:bg-ai",
        tone === "orange" && "before:bg-warning",
        tone === "blue" && "before:bg-brand-accent",
        "relative before:absolute before:left-4 before:top-4 before:h-3 before:w-3 before:rounded-full"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3 pl-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">{meta}</p>
          <p className="mt-2 text-base font-semibold text-neutral-900">{label}</p>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-neutral-300" />
      </div>
    </div>
  );
}

function NextBestJobsSection({
  jobs,
  isLoading,
  selectedJobId,
  autoFittingJobId,
  onSelectJob,
  onAutoFitJob
}: {
  jobs: DispatchNextBestJob[];
  isLoading: boolean;
  selectedJobId: string | null;
  autoFittingJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onAutoFitJob: (jobId: string, preferredTechnicianId: string | null) => Promise<void>;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index} className="h-[132px]" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No smart queue items"
        subtitle="Fresh AI-prioritized jobs will appear here as they become schedule-ready."
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div key={job.jobId} className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatBadge label="Smart" tone="purple" />
                <StatBadge label={`${job.urgencyScore}`} tone={getUrgencyTone(job.urgencyScore)} />
              </div>
              <button
                type="button"
                onClick={() => onSelectJob(job.jobId)}
                className={cn(
                  "mt-3 text-left text-base font-semibold transition hover:text-brand-accent",
                  selectedJobId === job.jobId ? "text-brand-accent" : "text-neutral-900"
                )}
              >
                {job.customer}
              </button>
              <p className="mt-1 text-sm text-neutral-500">{job.reasoningText}</p>
              {job.estimatedValue ? (
                <p className="mt-3 text-sm font-medium text-neutral-700">
                  Est. value <CurrencyDisplay value={job.estimatedValue} className="font-semibold text-neutral-900" />
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <DraggableJobCard
              id={job.jobId}
              label={job.customer}
              subtitle={job.reasoningText}
              meta={job.jobNumber}
              tone="purple"
              isSelected={selectedJobId === job.jobId}
              preferredTechnicianId={job.suggestedTechId}
              onClick={() => onSelectJob(job.jobId)}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              void onAutoFitJob(job.jobId, job.suggestedTechId);
            }}
            disabled={autoFittingJobId === job.jobId}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-ai-light px-3 py-2 text-sm font-semibold text-ai transition hover:bg-ai hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            <WandSparkles className="h-4 w-4" />
            {autoFittingJobId === job.jobId ? "Auto-fitting..." : "Auto-Fit"}
          </button>
        </div>
      ))}
    </div>
  );
}

function UnscheduledSection({
  jobs,
  isLoading,
  selectedJobId,
  onSelectJob
}: {
  jobs: UnscheduledJobListItem[];
  isLoading: boolean;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} className="h-[124px]" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No unscheduled jobs"
        subtitle="Everything that needs attention is already placed or converted into the smart queue."
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div key={job.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <StatBadge label={job.priority} tone={getPriorityTone(job.priority)} />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">{job.jobNumber}</p>
          </div>
          <DraggableJobCard
            id={job.id}
            label={job.title}
            subtitle={`${job.customer.firstName} ${job.customer.lastName}`.trim()}
            meta={job.status}
            tone="orange"
            isSelected={selectedJobId === job.id}
            preferredTechnicianId={null}
            onClick={() => onSelectJob(job.id)}
          />
          <TimeAgo value={job.createdAt} className="pl-1 text-xs font-medium text-neutral-400" />
        </div>
      ))}
    </div>
  );
}

function BookingRequestsSection({
  requests,
  isLoading,
  selectedBookingRequestId,
  onSelectBookingRequest
}: {
  requests: BookingRequestListItem[];
  isLoading: boolean;
  selectedBookingRequestId: string | null;
  onSelectBookingRequest: (bookingRequestId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index} className="h-[132px]" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No pending booking requests"
        subtitle="Incoming online booking requests will auto-refresh here every 30 seconds."
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <button
          key={request.id}
          type="button"
          onClick={() => onSelectBookingRequest(request.id)}
          className={cn(
            "w-full rounded-[24px] border bg-white px-4 py-4 text-left shadow-sm transition",
            selectedBookingRequestId === request.id
              ? "border-brand-accent shadow-[0_20px_48px_rgba(37,122,250,0.18)]"
              : "border-neutral-200 hover:border-brand-accent/30"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {request.firstName} {request.lastName}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {request.serviceCategory ?? "General"} {request.serviceType ? `• ${request.serviceType}` : ""}
              </p>
            </div>
            {isNewItem(request.createdAt) ? <StatBadge label="NEW" tone="red" /> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500">
            <span className="rounded-full bg-neutral-100 px-2 py-1">{request.source}</span>
            {request.preferredDate ? <span className="rounded-full bg-neutral-100 px-2 py-1">{request.preferredDate}</span> : null}
            {request.preferredWindow ? <span className="rounded-full bg-neutral-100 px-2 py-1">{request.preferredWindow}</span> : null}
          </div>
          <TimeAgo value={request.createdAt} className="mt-3 block text-xs font-medium text-neutral-400" />
        </button>
      ))}
    </div>
  );
}

function ApprovedEstimateSection({
  estimates,
  isLoading,
  convertingEstimateId,
  onConvertEstimate
}: {
  estimates: ApprovedEstimateQueueItem[];
  isLoading: boolean;
  convertingEstimateId: string | null;
  onConvertEstimate: (estimateId: string) => Promise<void>;
}) {
  if (isLoading) {
    return <SkeletonCard className="h-[164px]" />;
  }

  if (estimates.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Approved estimates</p>
          <h3 className="mt-2 text-base font-semibold text-neutral-900">Ready to convert</h3>
        </div>
        <Sparkles className="h-4 w-4 text-ai" />
      </div>
      <div className="mt-4 space-y-3">
        {estimates.map((estimate) => (
          <div key={estimate.id} className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{estimate.title ?? estimate.estimateNumber}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {estimate.customer.firstName} {estimate.customer.lastName}
                </p>
              </div>
              <CurrencyDisplay value={estimate.total} className="text-sm font-semibold text-neutral-900" />
            </div>
            <button
              type="button"
              onClick={() => {
                void onConvertEstimate(estimate.id);
              }}
              disabled={convertingEstimateId === estimate.id}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {convertingEstimateId === estimate.id ? "Converting..." : "Convert to job"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DispatchQueuePanel({
  activeTab,
  selectedJobId,
  selectedBookingRequestId,
  dispatchView,
  isLoading,
  bookingRequests,
  bookingRequestsLoading,
  unscheduledJobs,
  unscheduledLoading,
  approvedEstimates,
  approvedEstimatesLoading,
  search,
  onSelectTab,
  onSelectJob,
  onSelectBookingRequest,
  onAutoFitJob,
  onConvertEstimate,
  autoFittingJobId,
  convertingEstimateId,
  smartQueueError = null,
  bookingRequestsError = null,
  unscheduledError = null,
  approvedEstimatesError = null
}: DispatchQueuePanelProps) {
  const [bookingSourceFilter, setBookingSourceFilter] = useState<(typeof bookingSourceFilters)[number]["id"]>("all");
  const normalizedSearch = search.trim().toLowerCase();
  const nextBestJobs = (dispatchView?.nextBestJobs ?? []).filter((job) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      job.customer.toLowerCase().includes(normalizedSearch) ||
      job.jobNumber.toLowerCase().includes(normalizedSearch) ||
      job.reasoningText.toLowerCase().includes(normalizedSearch)
    );
  });
  const filteredUnscheduledJobs = unscheduledJobs.filter((job) => {
    if (!normalizedSearch) {
      return true;
    }

    const customerName = `${job.customer.firstName} ${job.customer.lastName}`.trim().toLowerCase();
    return (
      job.title.toLowerCase().includes(normalizedSearch) ||
      job.jobNumber.toLowerCase().includes(normalizedSearch) ||
      customerName.includes(normalizedSearch)
    );
  });
  const filteredBookingRequests = bookingRequests.filter((request) => {
    if (bookingSourceFilter !== "all" && request.source !== bookingSourceFilter) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const name = `${request.firstName} ${request.lastName}`.trim().toLowerCase();
    return (
      name.includes(normalizedSearch) ||
      request.phone.toLowerCase().includes(normalizedSearch) ||
      request.zip.toLowerCase().includes(normalizedSearch) ||
      (request.serviceCategory?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (request.serviceType?.toLowerCase().includes(normalizedSearch) ?? false)
    );
  });

  return (
    <aside className="space-y-4">
      <section className="surface-card px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <QueueTabButton
            isActive={activeTab === "schedule"}
            label="Next Best"
            count={dispatchView?.nextBestJobs.length ?? 0}
            onClick={() => onSelectTab("schedule")}
          />
          <QueueTabButton
            isActive={activeTab === "bookings"}
            label="Bookings"
            count={bookingRequests.length}
            onClick={() => onSelectTab("bookings")}
          />
          <QueueTabButton
            isActive={activeTab === "unscheduled"}
            label="Unscheduled"
            count={unscheduledJobs.length}
            onClick={() => onSelectTab("unscheduled")}
          />
        </div>

        <div className="mt-4 space-y-4">
          {activeTab === "schedule" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Smart queue</p>
                  <h2 className="mt-2 text-lg font-semibold text-neutral-900">AI-prioritized jobs</h2>
                </div>
                <Sparkles className="h-4 w-4 text-ai" />
              </div>
              {smartQueueError ? (
                <QueueError title="Smart queue could not be loaded" error={smartQueueError} />
              ) : (
                <NextBestJobsSection
                  jobs={nextBestJobs}
                  isLoading={isLoading}
                  selectedJobId={selectedJobId}
                  autoFittingJobId={autoFittingJobId}
                  onSelectJob={onSelectJob}
                  onAutoFitJob={onAutoFitJob}
                />
              )}
            </>
          ) : null}

          {activeTab === "bookings" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Live queue</p>
                  <h2 className="mt-2 text-lg font-semibold text-neutral-900">Pending booking requests</h2>
                </div>
                <Clock3 className="h-4 w-4 text-neutral-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                {bookingSourceFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setBookingSourceFilter(filter.id)}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition",
                      bookingSourceFilter === filter.id
                        ? "bg-brand-primary text-white"
                        : "bg-neutral-100 text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {bookingRequestsError ? (
                <QueueError title="Booking requests could not be loaded" error={bookingRequestsError} />
              ) : (
                <BookingRequestsSection
                  requests={filteredBookingRequests}
                  isLoading={bookingRequestsLoading}
                  selectedBookingRequestId={selectedBookingRequestId}
                  onSelectBookingRequest={onSelectBookingRequest}
                />
              )}
            </>
          ) : null}

          {activeTab === "unscheduled" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Queue</p>
                  <h2 className="mt-2 text-lg font-semibold text-neutral-900">Unscheduled jobs</h2>
                </div>
                <CalendarClock className="h-4 w-4 text-neutral-400" />
              </div>
              {unscheduledError ? (
                <QueueError title="Unscheduled jobs could not be loaded" error={unscheduledError} />
              ) : (
                <UnscheduledSection
                  jobs={filteredUnscheduledJobs}
                  isLoading={unscheduledLoading}
                  selectedJobId={selectedJobId}
                  onSelectJob={onSelectJob}
                />
              )}
            </>
          ) : null}
        </div>
      </section>

      {approvedEstimatesError ? (
        <QueueError title="Approved estimates could not be loaded" error={approvedEstimatesError} />
      ) : (
        <ApprovedEstimateSection
          estimates={approvedEstimates}
          isLoading={approvedEstimatesLoading}
          convertingEstimateId={convertingEstimateId}
          onConvertEstimate={onConvertEstimate}
        />
      )}

      <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Tip</p>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Drag any queue card onto an amber gap to schedule it. Booking requests refresh every 30 seconds, and approved estimates can
          convert directly into jobs here.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500">
          <span className="rounded-full bg-warning-light px-2 py-1 text-warning">Drop zone</span>
          <span className="rounded-full bg-success-light px-2 py-1 text-success">Scheduled</span>
          <span className="rounded-full bg-brand-accent-light px-2 py-1 text-brand-accent">Needs scheduling</span>
        </div>
        <div className="mt-4">
          <Link href="/ai-revenue-center" className="text-sm font-semibold text-brand-accent transition hover:text-brand-primary">
            Open AI Revenue Center
          </Link>
        </div>
      </section>
    </aside>
  );
}
