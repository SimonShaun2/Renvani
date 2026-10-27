import { addMinutes, differenceInMinutes, format, parseISO, subHours } from "date-fns";
import type { DispatchGap, DispatchTechnicianDay, JobDetail } from "@fsm/types";

export const DISPATCH_DAY_START_HOUR = 8;
export const DISPATCH_DAY_END_HOUR = 18;
export const DISPATCH_TOTAL_MINUTES = (DISPATCH_DAY_END_HOUR - DISPATCH_DAY_START_HOUR) * 60;
export const DEFAULT_JOB_DURATION_MINUTES = 120;

export interface DispatchDropSlot {
  technicianId: string;
  technicianName: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface DispatchDragJobData {
  type: "dispatch-job";
  jobId: string;
  label: string;
  subtitle: string;
  preferredTechnicianId: string | null;
}

export interface DispatchDropTargetData {
  type: "dispatch-slot";
  slot: DispatchDropSlot;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

function clampMinutes(value: number): number {
  return Math.max(0, Math.min(DISPATCH_TOTAL_MINUTES, value));
}

function minutesFromWindowStart(value: string | Date): number {
  const date = toDate(value);
  return clampMinutes(date.getHours() * 60 + date.getMinutes() - DISPATCH_DAY_START_HOUR * 60);
}

export function getTimelineStyle(start: string | Date, end: string | Date) {
  const startMinutes = minutesFromWindowStart(start);
  const endMinutes = minutesFromWindowStart(end);
  const widthMinutes = Math.max(30, endMinutes - startMinutes);

  return {
    left: `${(startMinutes / DISPATCH_TOTAL_MINUTES) * 100}%`,
    width: `${(widthMinutes / DISPATCH_TOTAL_MINUTES) * 100}%`
  };
}

/** Figma 10:561–10:570 hour labels: "8" … "12", "1" … "5" (no a/p suffix). */
export function formatTimelineHour(hour: number): string {
  return String(hour > 12 ? hour - 12 : hour);
}

export function formatDispatchDateLabel(value: string): string {
  return format(parseISO(value), "EEE, MMM d");
}

export function formatDispatchTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "TBD";
  }

  return format(toDate(value), "h:mm a");
}

export function formatDispatchRange(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  if (!start || !end) {
    return "Unscheduled";
  }

  return `${formatDispatchTime(start)} - ${formatDispatchTime(end)}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getStatusTone(status: string) {
  switch (status) {
    case "scheduled":
      return "bg-brand-accent text-white";
    case "dispatched":
    case "in_progress":
      return "bg-success text-white";
    case "completed":
    case "paid":
    case "closed":
      return "bg-brand-primary text-white";
    case "on_hold":
      return "bg-warning text-neutral-900";
    case "cancelled":
      return "bg-error text-white";
    default:
      return "bg-neutral-300 text-neutral-700";
  }
}

export function getPriorityTone(priority: string) {
  switch (priority) {
    case "urgent":
      return "red";
    case "high":
      return "orange";
    case "low":
      return "neutral";
    default:
      return "blue";
  }
}

export function getUrgencyTone(score: number) {
  if (score >= 85) {
    return "red";
  }

  if (score >= 65) {
    return "orange";
  }

  return "purple";
}

export function matchesSearch(search: string, ...values: Array<string | null | undefined>) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(normalizedSearch));
}

export function isNewItem(createdAt: string, windowHours = 2) {
  return toDate(createdAt) >= subHours(new Date(), windowHours);
}

export function toDateTimeInputValue(value: string | Date) {
  return format(toDate(value), "yyyy-MM-dd'T'HH:mm");
}

export function fromDateTimeInputValue(value: string) {
  return new Date(value).toISOString();
}

export function getJobDurationMinutes(job: Pick<JobDetail, "scheduledDurationMinutes" | "scheduledStart" | "scheduledEnd"> | null | undefined) {
  if (!job) {
    return DEFAULT_JOB_DURATION_MINUTES;
  }

  if (job.scheduledDurationMinutes && job.scheduledDurationMinutes > 0) {
    return job.scheduledDurationMinutes;
  }

  if (job.scheduledStart && job.scheduledEnd) {
    return Math.max(30, differenceInMinutes(toDate(job.scheduledEnd), toDate(job.scheduledStart)));
  }

  return DEFAULT_JOB_DURATION_MINUTES;
}

export function buildDispatchSlotFromGap(
  technicianId: string,
  technicianName: string,
  gap: DispatchGap,
  durationMinutes = gap.durationMinutes
): DispatchDropSlot {
  const scheduledStart = gap.start;
  const scheduledEnd = addMinutes(toDate(gap.start), durationMinutes).toISOString();

  return {
    technicianId,
    technicianName,
    scheduledStart,
    scheduledEnd
  };
}

export function findAutoFitSlot(
  technicians: DispatchTechnicianDay[],
  preferredTechnicianId: string | null,
  durationMinutes: number
): DispatchDropSlot | null {
  const preferredTechnician = preferredTechnicianId
    ? technicians.find((technician) => technician.id === preferredTechnicianId)
    : null;

  const candidates = preferredTechnician ? [preferredTechnician, ...technicians.filter((technician) => technician.id !== preferredTechnicianId)] : technicians;

  for (const technician of candidates) {
    const matchingGap = technician.gaps.find((gap) => gap.durationMinutes >= durationMinutes);

    if (matchingGap) {
      return buildDispatchSlotFromGap(technician.id, technician.name, matchingGap, durationMinutes);
    }
  }

  return null;
}
