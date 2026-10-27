"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { addDays, addHours, format, parseISO, subDays } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import type { AutoFitSuggestion, JobDetail } from "@fsm/types";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useAutoFit, useDispatchJob, useDispatchView, useScheduleJob } from "@/src/hooks/dispatch.hooks";
import {
  useApprovedEstimatesQueue,
  useBookingRequest,
  useBookingRequests,
  useCompleteDispatchJob,
  useConfirmBooking,
  useConvertEstimateToJob,
  useCreateQuickJob,
  useDeclineBooking,
  useUnscheduledDispatchJobs
} from "@/src/hooks/dispatch.hooks";
import { ApiError } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import {
  useDispatchStore,
  type DispatchTab,
  type DispatchViewMode
} from "@/src/stores/dispatch.store";

import { DispatchDetailPanel } from "./DispatchDetailPanel";
import { DispatchQueuePanel } from "./DispatchQueuePanel";
import { DispatchTimeline } from "./DispatchTimeline";
import { DispatchHeader, DispatchLoadError } from "./DispatchHeader";
import { formatDispatchSummary, summarizeDispatch } from "@/src/lib/dispatch-actions";
import type { DispatchDragJobData, DispatchDropSlot, DispatchDropTargetData } from "./dispatch.utils";
import {
  formatDispatchDateLabel,
  formatFrameDuration,
  formatFrameRange,
  formatFrameTime,
  matchesSearch
} from "./dispatch.utils";

type AutoFitOverlayState = {
  jobId: string;
  suggestions: AutoFitSuggestion[];
  currentIndex: number;
  message: string | null;
  isLoading: boolean;
};

function jobLabel(title: string, customer: { firstName: string; lastName: string }): string {
  return [title, `${customer.firstName} ${customer.lastName}`.trim()].filter(Boolean).join(" · ");
}

function findCustomerLastName(
  jobId: string,
  unscheduled: Array<{ id: string; customer: { lastName: string } }>,
  technicians: Array<{ jobs: Array<{ id: string; customer: { lastName: string } }> }>
): string | null {
  const job = unscheduled.find((item) => item.id === jobId)
    ?? technicians.flatMap((technician) => technician.jobs).find((item) => item.id === jobId);
  return job?.customer.lastName.trim() || null;
}

function findJobLabel(
  jobId: string,
  unscheduled: Array<{ id: string; title: string; customer: { firstName: string; lastName: string } }>,
  technicians: Array<{ jobs: Array<{ id: string; title: string; customer: { firstName: string; lastName: string } }> }>
): string | null {
  const queued = unscheduled.find((job) => job.id === jobId);
  if (queued) return jobLabel(queued.title, queued.customer);
  for (const technician of technicians) {
    const scheduled = technician.jobs.find((job) => job.id === jobId);
    if (scheduled) return jobLabel(scheduled.title, scheduled.customer);
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Try that again.";
}

function WeekStub({ onReset }: { onReset: () => void }) {
  return (
    <section className="surface-card p-8">
      <EmptyState
        icon={Sparkles}
        title="Week view is staged next"
        subtitle="Ticket 016 delivers the full day board first. Switch back to day mode to drag jobs, confirm bookings, and quick-create directly on the timeline."
        action={
          <button
            type="button"
            onClick={onReset}
            className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary"
          >
            Return to day view
          </button>
        }
      />
    </section>
  );
}

export function DispatchBoardClient() {
  const selectedDate = useDispatchStore((state) => state.selectedDate);
  const selectedJobId = useDispatchStore((state) => state.selectedJobId);
  const selectedBookingRequestId = useDispatchStore((state) => state.selectedBookingRequestId);
  const activeTab = useDispatchStore((state) => state.activeTab);
  const viewMode = useDispatchStore((state) => state.viewMode);
  const setSelectedDate = useDispatchStore((state) => state.setSelectedDate);
  const setSelectedJob = useDispatchStore((state) => state.setSelectedJob);
  const setSelectedBookingRequest = useDispatchStore((state) => state.setSelectedBookingRequest);
  const setActiveTab = useDispatchStore((state) => state.setActiveTab);
  const setViewMode = useDispatchStore((state) => state.setViewMode);
  const closeDetail = useDispatchStore((state) => state.closeDetail);
  const streamLive = useDispatchStore((state) => state.streamLive);

  const [isNavigating, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeDragJob, setActiveDragJob] = useState<DispatchDragJobData | null>(null);
  const [quickCreateSlot, setQuickCreateSlot] = useState<DispatchDropSlot | null>(null);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [createQuickJobError, setCreateQuickJobError] = useState<string | null>(null);
  const [autoFittingJobId, setAutoFittingJobId] = useState<string | null>(null);
  const [animatedJobId, setAnimatedJobId] = useState<string | null>(null);
  const [autoFitOverlay, setAutoFitOverlay] = useState<AutoFitOverlayState | null>(null);
  const [convertingEstimateId, setConvertingEstimateId] = useState<string | null>(null);
  const [completingJobId, setCompletingJobId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const dispatchQuery = useDispatchView(selectedDate);
  const selectedJobQuery = useDispatchJob(selectedJobId);
  const bookingRequestsQuery = useBookingRequests();
  const selectedBookingRequestQuery = useBookingRequest(selectedBookingRequestId);
  const unscheduledJobsQuery = useUnscheduledDispatchJobs();
  const approvedEstimatesQuery = useApprovedEstimatesQueue();

  const autoFitMutation = useAutoFit();
  const scheduleJobMutation = useScheduleJob();
  const completeJobMutation = useCompleteDispatchJob();
  const createQuickJobMutation = useCreateQuickJob();
  const convertEstimateMutation = useConvertEstimateToJob();
  const confirmBookingMutation = useConfirmBooking();
  const declineBookingMutation = useDeclineBooking();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (autoFitOverlay) {
        setAutoFitOverlay(null);
        return;
      }

      if (quickCreateSlot) {
        setQuickCreateSlot(null);
        setCreateQuickJobError(null);
        return;
      }

      closeDetail();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [autoFitOverlay, closeDetail, quickCreateSlot]);

  useEffect(() => {
    if (!animatedJobId) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAnimatedJobId(null);
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [animatedJobId]);

  const technicians = dispatchQuery.data?.technicians ?? [];
  const technicianOptions = technicians.map((technician) => ({
    id: technician.id,
    name: technician.name
  }));
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();

    for (const technician of technicians) {
      for (const job of technician.jobs) {
        statuses.add(job.status);
      }
    }

    return Array.from(statuses).sort();
  }, [technicians]);

  const filteredTechnicians = useMemo(() => {
    return technicians
      .filter((technician) => technicianFilter === "all" || technician.id === technicianFilter)
      .map((technician) => {
        const technicianMatchesSearch = matchesSearch(
          deferredSearch,
          technician.name,
          technician.serviceZipCodes.join(" ")
        );
        const filteredJobs = technician.jobs.filter((job) => {
          const statusMatches = statusFilter === "all" || job.status === statusFilter;
          const searchMatches =
            !deferredSearch ||
            technicianMatchesSearch ||
            matchesSearch(
              deferredSearch,
              job.jobNumber,
              job.title,
              `${job.customer.firstName} ${job.customer.lastName}`.trim(),
              job.property?.addressLine1,
              job.property?.city
            );

          return statusMatches && searchMatches;
        });

        return technicianMatchesSearch || !deferredSearch || filteredJobs.length > 0
          ? {
              ...technician,
              jobs: filteredJobs
            }
          : null;
      })
      .filter((technician): technician is NonNullable<typeof technician> => technician !== null);
  }, [deferredSearch, statusFilter, technicianFilter, technicians]);

  const unscheduledJobs = unscheduledJobsQuery.data?.jobs ?? [];
  const firstUnscheduled = unscheduledJobs[0] ?? null;
  const summaryText = formatDispatchSummary(
    formatDispatchDateLabel(selectedDate),
    summarizeDispatch(technicians, unscheduledJobs.length)
  );

  function openAddVisit() {
    const technician = technicians[0];
    if (!technician) return;
    const start = parseISO(`${selectedDate}T09:00:00`);
    setQuickCreateSlot({
      technicianId: technician.id,
      technicianName: technician.name,
      scheduledStart: start.toISOString(),
      scheduledEnd: addHours(start, 2).toISOString()
    });
    setCreateQuickJobError(null);
    setMode("day");
  }

  async function scheduleIntoSlot(jobId: string, slot: DispatchDropSlot) {
    try {
      setBoardMessage(null);
      await scheduleJobMutation.mutateAsync({
        jobId,
        technicianId: slot.technicianId,
        scheduledStart: slot.scheduledStart,
        scheduledEnd: slot.scheduledEnd
      });
      setSelectedJob(jobId);
      setActiveTab("schedule");
      setAnimatedJobId(jobId);
    } catch (error) {
      setBoardMessage(getErrorMessage(error));
    }
  }

  async function handleAutoFit(jobId: string, preferredTechnicianId: string | null, job: JobDetail | null) {
    void preferredTechnicianId;
    void job;

    setAutoFitOverlay({
      jobId,
      suggestions: [],
      currentIndex: 0,
      message: null,
      isLoading: true
    });

    setAutoFittingJobId(jobId);

    try {
      const response = await autoFitMutation.mutateAsync({
        jobId,
        date: selectedDate
      });

      setAutoFitOverlay((current) =>
        current?.jobId === jobId
          ? {
              jobId,
              suggestions: response.suggestions,
              currentIndex: 0,
              message: response.message,
              isLoading: false
            }
          : current
      );
      setBoardMessage(response.suggestions.length === 0 ? response.message : null);
      if (response.suggestions.length > 0) {
        setSelectedJob(jobId);
      }
    } catch (error) {
      setAutoFitOverlay((current) => (current?.jobId === jobId ? null : current));
      setBoardMessage(getErrorMessage(error));
    } finally {
      setAutoFittingJobId(null);
    }
  }

  async function handleAcceptAutoFitSuggestion(suggestion: AutoFitSuggestion) {
    if (!autoFitOverlay) {
      return;
    }

    try {
      await scheduleIntoSlot(autoFitOverlay.jobId, {
        technicianId: suggestion.technicianId,
        technicianName: suggestion.technicianName,
        scheduledStart: suggestion.scheduledStart,
        scheduledEnd: suggestion.scheduledEnd
      });
      setAutoFitOverlay(null);
    } catch {
      // scheduleIntoSlot handles the board-level error message
    }
  }

  async function handleCreateQuickJob(input: Parameters<typeof createQuickJobMutation.mutateAsync>[0]) {
    try {
      setCreateQuickJobError(null);
      const result = await createQuickJobMutation.mutateAsync(input);
      setSelectedJob(result.job.id);
      setQuickCreateSlot(null);
    } catch (error) {
      setCreateQuickJobError(getErrorMessage(error));
    }
  }

  async function handleConvertEstimate(estimateId: string) {
    try {
      setConvertingEstimateId(estimateId);
      const result = await convertEstimateMutation.mutateAsync({ estimateId });
      setSelectedJob(result.job.id);
      setBoardMessage(null);
    } catch (error) {
      setBoardMessage(getErrorMessage(error));
    } finally {
      setConvertingEstimateId(null);
    }
  }

  async function handleCompleteJob(jobId: string) {
    try {
      setCompletingJobId(jobId);
      await completeJobMutation.mutateAsync({ jobId });
      setBoardMessage(null);
    } catch (error) {
      setBoardMessage(getErrorMessage(error));
    } finally {
      setCompletingJobId(null);
    }
  }

  async function handleConfirmBooking(
    id: string,
    input: Parameters<typeof confirmBookingMutation.mutateAsync>[0]["input"]
  ) {
    try {
      const result = await confirmBookingMutation.mutateAsync({ id, input });

      if (result.bookingRequest.jobId) {
        setSelectedJob(result.bookingRequest.jobId);
      } else {
        closeDetail();
      }
    } catch (error) {
      setBoardMessage(getErrorMessage(error));
    }
  }

  async function handleDeclineBooking(id: string, reason?: string) {
    try {
      await declineBookingMutation.mutateAsync(reason ? { id, reason } : { id });
      closeDetail();
    } catch (error) {
      setBoardMessage(getErrorMessage(error));
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current as DispatchDragJobData | undefined;
    if (activeData?.type === "dispatch-job") {
      setActiveDragJob(activeData);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as DispatchDragJobData | undefined;
    const overData = event.over?.data.current as DispatchDropTargetData | undefined;

    setActiveDragJob(null);

    if (activeData?.type !== "dispatch-job" || overData?.type !== "dispatch-slot") {
      return;
    }

    void scheduleIntoSlot(activeData.jobId, overData.slot);
  }

  function shiftDate(direction: "prev" | "next") {
    startTransition(() => {
      const nextDate = direction === "next" ? addDays(parseISO(selectedDate), 1) : subDays(parseISO(selectedDate), 1);
      setSelectedDate(format(nextDate, "yyyy-MM-dd"));
    });
  }

  function setMode(mode: DispatchViewMode) {
    startTransition(() => {
      setViewMode(mode);
    });
  }

  function selectTab(tab: DispatchTab) {
    setActiveTab(tab);
    setBoardMessage(null);
    if (tab !== "bookings") {
      setSelectedBookingRequest(null);
    }
  }

  // Figma 10:478 shows the agent proposal inline (banner 10:553 + dashed block 10:590), not as a modal.
  const topSuggestion = autoFitOverlay && !autoFitOverlay.isLoading ? autoFitOverlay.suggestions[0] ?? null : null;
  const proposalCustomerLastName = autoFitOverlay
    ? findCustomerLastName(autoFitOverlay.jobId, unscheduledJobs, technicians)
    : null;
  const proposalJobLabel = autoFitOverlay ? findJobLabel(autoFitOverlay.jobId, unscheduledJobs, technicians) : null;
  const bannerJob = autoFitOverlay && proposalJobLabel
    ? {
        id: autoFitOverlay.jobId,
        label: proposalJobLabel,
        statusLabel: unscheduledJobs.some((job) => job.id === autoFitOverlay.jobId) ? "Unassigned" : "Reschedule"
      }
    : firstUnscheduled
      ? { id: firstUnscheduled.id, label: jobLabel(firstUnscheduled.title, firstUnscheduled.customer) }
      : null;
  const timelineSuggestion = topSuggestion && autoFitOverlay
    ? {
        technicianId: topSuggestion.technicianId,
        label: proposalCustomerLastName ?? "Visit",
        scheduledStart: topSuggestion.scheduledStart,
        scheduledEnd: topSuggestion.scheduledEnd
      }
    : null;

  return (
    <div className="-mx-4 -my-6 space-y-5 px-4 py-6 md:-mx-8 md:-my-8 md:px-8 md:py-8">
      <DispatchHeader
        summaryText={summaryText}
        streamLive={streamLive}
        unassignedJob={bannerJob}
        suggestion={
          topSuggestion && bannerJob?.id === autoFitOverlay?.jobId
            ? {
                technicianName: topSuggestion.technicianName,
                rangeLabel: formatFrameRange(topSuggestion.scheduledStart, topSuggestion.scheduledEnd),
                jobMeta: `${formatFrameDuration(topSuggestion.scheduledStart, topSuggestion.scheduledEnd)} · ${formatFrameTime(topSuggestion.scheduledStart)}`
              }
            : null
        }
        approvePending={scheduleJobMutation.isPending}
        onApprove={() => {
          if (topSuggestion) void handleAcceptAutoFitSuggestion(topSuggestion);
        }}
        autoFitPending={autoFittingJobId !== null}
        canAddVisit={technicians.length > 0}
        onAutoAssign={(jobId) => {
          setMode("day");
          void handleAutoFit(jobId, null, null);
        }}
        onAddVisit={openAddVisit}
      />

      <section className="surface-card px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers, jobs, techs..."
                className="w-full bg-transparent outline-none placeholder:text-neutral-400"
              />
            </label>

            <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 p-1">
              <button
                type="button"
                onClick={() => setMode("day")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  viewMode === "day" ? "bg-brand-accent text-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setMode("week")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  viewMode === "week" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                Week
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              <button
                type="button"
                onClick={() => shiftDate("prev")}
                className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[110px] text-center text-sm font-semibold text-neutral-900">
                {formatDispatchDateLabel(selectedDate)}
              </span>
              <button
                type="button"
                onClick={() => shiftDate("next")}
                className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <select
              value={technicianFilter}
              onChange={(event) => setTechnicianFilter(event.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 outline-none transition focus:border-brand-accent"
            >
              <option value="all">All Techs</option>
              {technicianOptions.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 outline-none transition focus:border-brand-accent"
            >
              <option value="all">Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled
              className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-400"
              title="Job type filtering lands in the next dispatch pass."
            >
              Job Type
            </button>
          </div>
        </div>

        {viewMode === "week" ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
            <StatBadge label="Stub" tone="orange" />
            <span>Week mode is staged for the next dispatch iteration. Day mode is fully interactive now.</span>
          </div>
        ) : null}

        {isNavigating ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-500">
            <Sparkles className="h-4 w-4 text-brand-accent" />
            Updating board...
          </div>
        ) : null}
      </section>

      {boardMessage ? (
        <section className="rounded-[28px] border border-warning/30 bg-warning-light px-4 py-3 text-sm text-neutral-700 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>{boardMessage}</p>
          </div>
        </section>
      ) : null}

      {dispatchQuery.isError ? (
        <DispatchLoadError
          message={getErrorMessage(dispatchQuery.error)}
          onRetry={() => {
            void dispatchQuery.refetch();
          }}
        />
      ) : null}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <DispatchQueuePanel
            activeTab={activeTab}
            selectedJobId={selectedJobId}
            selectedBookingRequestId={selectedBookingRequestId}
            dispatchView={dispatchQuery.data}
            isLoading={dispatchQuery.isLoading}
            bookingRequests={bookingRequestsQuery.data?.data ?? []}
            bookingRequestsLoading={bookingRequestsQuery.isLoading}
            unscheduledJobs={unscheduledJobsQuery.data?.jobs ?? []}
            unscheduledLoading={unscheduledJobsQuery.isLoading}
            approvedEstimates={approvedEstimatesQuery.data?.estimates ?? []}
            approvedEstimatesLoading={approvedEstimatesQuery.isLoading}
            search={deferredSearch}
            onSelectTab={selectTab}
            onSelectJob={(jobId) => {
              setSelectedJob(jobId);
              setBoardMessage(null);
            }}
            onSelectBookingRequest={(bookingRequestId) => {
              setActiveTab("bookings");
              setSelectedBookingRequest(bookingRequestId);
              setBoardMessage(null);
            }}
            onAutoFitJob={async (jobId, preferredTechnicianId) => {
              await handleAutoFit(jobId, preferredTechnicianId, null);
            }}
            onConvertEstimate={handleConvertEstimate}
            autoFittingJobId={autoFittingJobId}
            convertingEstimateId={convertingEstimateId}
          />

          {viewMode === "day" ? (
            <DispatchTimeline
              technicians={filteredTechnicians}
              isLoading={dispatchQuery.isLoading}
              selectedJobId={selectedJobId}
              animatedJobId={animatedJobId}
              quickCreateSlot={quickCreateSlot}
              createQuickJobPending={createQuickJobMutation.isPending}
              createQuickJobError={createQuickJobError}
              activeDragJobId={activeDragJob?.jobId ?? null}
              suggestion={timelineSuggestion}
              onSelectJob={(jobId) => {
                setSelectedJob(jobId);
                setBoardMessage(null);
              }}
              onOpenQuickCreate={(slot) => {
                setQuickCreateSlot(slot);
                setCreateQuickJobError(null);
              }}
              onCloseQuickCreate={() => {
                setQuickCreateSlot(null);
                setCreateQuickJobError(null);
              }}
              onCreateQuickJob={handleCreateQuickJob}
            />
          ) : (
            <WeekStub onReset={() => setMode("day")} />
          )}

          <DispatchDetailPanel
            selectedDate={selectedDate}
            selectedJobId={selectedJobId}
            selectedBookingRequestId={selectedBookingRequestId}
            job={selectedJobQuery.data?.job}
            jobLoading={selectedJobQuery.isLoading}
            bookingRequest={selectedBookingRequestQuery.data?.bookingRequest}
            bookingLoading={selectedBookingRequestQuery.isLoading}
            technicians={technicians}
            autoFitPending={autoFittingJobId === selectedJobId}
            completePending={completingJobId === selectedJobId}
            confirmBookingPending={confirmBookingMutation.isPending}
            declineBookingPending={declineBookingMutation.isPending}
            onClose={closeDetail}
            onAutoFit={async (job) => {
              await handleAutoFit(job.id, job.technicianId, job);
            }}
            onComplete={handleCompleteJob}
            onConfirmBooking={handleConfirmBooking}
            onDeclineBooking={handleDeclineBooking}
          />
        </div>

        <DragOverlay>
          {activeDragJob ? (
            <div className="rounded-[24px] border border-brand-accent/20 bg-white px-4 py-4 shadow-[0_26px_80px_rgba(37,122,250,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Scheduling</p>
              <p className="mt-2 text-base font-semibold text-neutral-900">{activeDragJob.label}</p>
              <p className="mt-1 text-sm text-neutral-500">{activeDragJob.subtitle}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
