import type { JobListQueryInput } from "@/src/hooks/jobs.hooks";

export const JOB_STATUS_OPTIONS = [
  "lead",
  "estimate_requested",
  "estimate_sent",
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
  "closed"
] as const;

export interface JobListFilters {
  status: string;
  from: string;
  to: string;
  search: string;
  page: number;
}

/** Converts a yyyy-mm-dd date input to an ISO timestamp at the start or end of that local day. */
export function dateInputToIso(value: string, edge: "start" | "end"): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const date =
    edge === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function buildJobListQuery(filters: JobListFilters, limit = 25): JobListQueryInput {
  const scheduledAfter = dateInputToIso(filters.from, "start");
  const scheduledBefore = dateInputToIso(filters.to, "end");
  const search = filters.search.trim();
  return {
    ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
    ...(scheduledAfter ? { scheduledAfter } : {}),
    ...(scheduledBefore ? { scheduledBefore } : {}),
    ...(search ? { search } : {}),
    sortBy: "scheduledStart",
    sortOrder: "asc",
    page: Math.max(1, filters.page),
    limit
  };
}
