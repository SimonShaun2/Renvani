import { AppError, ErrorCode, type JobStatus } from "@fsm/types";

type JobTransitionTarget = JobStatus | "rescheduled";

export const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobTransitionTarget[]> = {
  lead: ["estimate_requested", "scheduled", "cancelled"],
  estimate_requested: ["estimate_sent", "scheduled", "cancelled"],
  estimate_sent: ["estimate_approved", "estimate_requested", "cancelled"],
  estimate_approved: ["scheduled", "cancelled"],
  scheduled: ["dispatched", "in_progress", "on_hold", "rescheduled", "cancelled"],
  dispatched: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "cancelled"],
  on_hold: ["scheduled", "dispatched", "in_progress", "cancelled"],
  completed: ["invoiced", "closed"],
  invoiced: ["paid", "completed"],
  paid: ["closed"],
  cancelled: ["lead"],
  closed: []
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transition(from: JobStatus, to: JobStatus): JobStatus {
  if (!canTransition(from, to)) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Job cannot transition from ${from} to ${to}`,
      {
        currentStatus: from,
        nextStatus: to
      }
    );
  }

  return to;
}

export function getAvailableTransitions(from: JobStatus): JobStatus[] {
  return ALLOWED_TRANSITIONS[from].filter(
    (status): status is JobStatus => status !== "rescheduled"
  );
}
