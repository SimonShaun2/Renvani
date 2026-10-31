import { ApiError } from "@/src/lib/api";

import type { ScheduleChangeRecord, ScheduleExceptionKind } from "./schedule-changes.types";

/** Same gates as the API: scheduling-agent routes allow owner/admin/dispatcher. */
const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);
const CANCEL_OVERRIDE_ROLES = new Set(["owner", "admin"]);
export const CANCELLATION_WINDOW_HOURS = 24;

/** Job statuses the API lets you reschedule or cancel, and raise exceptions on. */
const CHANGEABLE_STATUSES = new Set(["lead", "estimate_requested", "estimate_sent", "estimate_approved", "scheduled", "dispatched", "on_hold"]);
const EXCEPTION_STATUSES = new Set(["scheduled", "dispatched", "in_progress", "on_hold"]);

export const canManageSchedule = (role: string | null | undefined) => Boolean(role && MANAGER_ROLES.has(role));
export const canChangeStatus = (status: string) => CHANGEABLE_STATUSES.has(status);
export const canFlagStatus = (status: string) => EXCEPTION_STATUSES.has(status);

export function isWithinCancellationWindow(scheduledStart: string | null, now: Date = new Date()) {
  if (!scheduledStart) return false;
  return new Date(scheduledStart).getTime() - now.getTime() < CANCELLATION_WINDOW_HOURS * 3_600_000;
}

/** Dispatchers can't cancel a visit inside the window; owner/admin can. Returns the reason or null. */
export function cancelBlockedReason(role: string | null | undefined, scheduledStart: string | null, now: Date = new Date()): string | null {
  if (!isWithinCancellationWindow(scheduledStart, now)) return null;
  if (role && CANCEL_OVERRIDE_ROLES.has(role)) return null;
  return `This visit starts within ${CANCELLATION_WINDOW_HOURS} hours. Only an owner or admin can cancel it now.`;
}

export const EXCEPTION_LABELS: Record<ScheduleExceptionKind, string> = {
  late_staff: "Tech running late",
  customer_conflict: "Customer can't make it",
  access_issue: "Can't get access (gate, lockbox, pets)",
  weather: "Weather",
  parts_delay: "Waiting on parts or equipment",
  other: "Something else"
};

export type ScheduleErrorKind = "conflict" | "stale" | "idempotency" | "window" | "forbidden" | "validation" | "other";
export interface ScheduleErrorView {
  kind: ScheduleErrorKind;
  message: string;
  /** Data on screen may be out of date; offer a reload. */
  reload: boolean;
  conflictJobId?: string;
}

export function describeScheduleError(error: unknown): ScheduleErrorView {
  if (!(error instanceof ApiError)) return { kind: "other", message: "Something went wrong. Try again.", reload: false };
  const reason = error.payload.fields?.reason;
  if (reason === "schedule_conflict") {
    const conflictJobId = error.payload.fields?.conflictJobId;
    return {
      kind: "conflict",
      message: "That technician already has a visit at that time. Pick another time or technician.",
      reload: true,
      ...(conflictJobId ? { conflictJobId } : {})
    };
  }
  if (reason === "stale_version") {
    return { kind: "stale", message: "Someone else changed this visit since you opened it. Reload to see the latest before trying again.", reload: true };
  }
  if (reason === "idempotency_conflict") {
    return { kind: "idempotency", message: "This change was already submitted with different details. Reload and start again.", reload: true };
  }
  if (reason === "cancellation_window") {
    return { kind: "window", message: error.message, reload: false };
  }
  if (error.status === 409) return { kind: "conflict", message: error.message, reload: true };
  if (error.status === 403) return { kind: "forbidden", message: "You don't have permission to change this visit.", reload: false };
  if (error.status === 400) return { kind: "validation", message: error.message, reload: false };
  return { kind: "other", message: error.message || "Something went wrong. Try again.", reload: false };
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `sched-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ISO -> value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function describeChange(change: ScheduleChangeRecord): string {
  if (change.action === "reschedule") return "Rescheduled";
  if (change.action === "cancel") return "Cancelled";
  const label = change.exception ? EXCEPTION_LABELS[change.exception.kind] : "Problem";
  return `Flagged for a person: ${label}${change.exception?.delayMinutes ? ` (${change.exception.delayMinutes} min)` : ""}`;
}
