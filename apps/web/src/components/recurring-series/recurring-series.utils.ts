import { ApiError } from "@/src/lib/api";

import type { OccurrenceState, SeriesAction } from "./recurring-series.types";

/** Same roles as the API (scheduling-agent routes: owner/admin/dispatcher). */
const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);
export const canManageSeries = (role: string | null | undefined) => Boolean(role && MANAGER_ROLES.has(role));

/** Mirrors requireStatus() in the service. A cancelled (ended) series allows nothing. */
const ALLOWED_BY_STATUS: Record<string, SeriesAction[]> = {
  active: ["pause", "end", "skip_occurrence", "reschedule_occurrence", "reschedule_future"],
  paused: ["resume", "end", "skip_occurrence", "reschedule_occurrence", "reschedule_future"]
};
export const allowedSeriesActions = (status: string): SeriesAction[] => ALLOWED_BY_STATUS[status] ?? [];

/** Visits the API will skip/move: upcoming, scheduled and not yet linked to a job. */
export const isOpenOccurrence = (o: OccurrenceState, now: Date = new Date()) => o.status === "scheduled" && new Date(o.scheduledAtUtc) > now;
export const isChangeableOccurrence = (o: OccurrenceState, now: Date = new Date()) => isOpenOccurrence(o, now) && !o.jobId;

export const ACTION_LABELS: Record<SeriesAction, string> = {
  pause: "Pause plan",
  resume: "Resume plan",
  end: "End plan",
  skip_occurrence: "Skip one visit",
  reschedule_occurrence: "Move one visit",
  reschedule_future: "Move all future visits to a new time"
};

export const SERIES_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Ended"
};
export const seriesStatusLabel = (s: string) => SERIES_STATUS_LABELS[s] ?? s.replace(/_/gu, " ");

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Every month",
  bi_monthly: "Every 2 months",
  quarterly: "Every 3 months",
  bi_annual: "Twice a year",
  annual: "Once a year"
};
export const frequencyLabel = (f: string) => FREQUENCY_LABELS[f] ?? f.replace(/_/gu, " ");

export type SeriesErrorKind =
  | "stale"
  | "preview_stale"
  | "idempotency"
  | "occurrence_conflict"
  | "linked_job"
  | "series_ended"
  | "external_scheduler"
  | "not_open"
  | "validation"
  | "forbidden"
  | "other";

export interface SeriesErrorView {
  kind: SeriesErrorKind;
  message: string;
  reload: boolean;
  jobId?: string;
}

export function describeSeriesError(error: unknown): SeriesErrorView {
  if (!(error instanceof ApiError)) return { kind: "other", message: "Something went wrong. Try again.", reload: false };
  const fields = error.payload.fields ?? {};
  switch (fields.reason) {
    case "stale_version":
      return { kind: "stale", message: "Someone else changed this plan since you opened it. Reload, then preview again.", reload: true };
    case "preview_stale":
      return { kind: "preview_stale", message: "The plan changed since you previewed it. Reload and preview again before applying.", reload: true };
    case "idempotency_conflict":
      return { kind: "idempotency", message: "This change was already submitted with different details. Reload and start again.", reload: true };
    case "occurrence_conflict":
      return { kind: "occurrence_conflict", message: "Another visit in this plan is already on that date. Pick a different day.", reload: true };
    case "linked_job":
      return {
        kind: "linked_job",
        message: "This visit already has a job, so it wasn't changed here. It's been flagged for a person — change it from the job instead.",
        reload: true,
        ...(fields.jobId ? { jobId: fields.jobId } : {})
      };
    case "series_ended":
      return { kind: "series_ended", message: "This plan has ended. Ended plans can't be changed.", reload: true };
    case "external_scheduler":
      return { kind: "external_scheduler", message: "This plan is scheduled by another system, so it can't be changed here.", reload: false };
    case "occurrence_not_open":
      return { kind: "not_open", message: "Only upcoming scheduled visits can be changed.", reload: true };
    default:
      break;
  }
  if (fields.localDate === "in_past") return { kind: "validation", message: "Pick a date after today.", reload: false };
  if (fields.localTime === "unchanged") return { kind: "validation", message: "That's already the plan's visit time.", reload: false };
  if (error.status === 403) return { kind: "forbidden", message: "You don't have permission to change this plan.", reload: false };
  if (error.status === 409) return { kind: "other", message: error.message, reload: true };
  if (error.status === 400) return { kind: "validation", message: error.message, reload: false };
  return { kind: "other", message: error.message || "Something went wrong. Try again.", reload: false };
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `series-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** "2030-01-15" -> "Tue, Jan 15, 2030" without timezone drift. */
export function formatLocalDate(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  if (!y || !m || !d) return localDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Wall-clock time of a UTC instant in the series' time zone. */
export function formatTimeInZone(utcIso: string, timeZone: string): string {
  try {
    return new Date(utcIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return new Date(utcIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

export function formatLocalTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const OCCURRENCE_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  skipped: "Skipped",
  cancelled: "Cancelled",
  completed: "Completed"
};
export const occurrenceStatusLabel = (s: string) => OCCURRENCE_STATUS_LABELS[s] ?? s.replace(/_/gu, " ");
