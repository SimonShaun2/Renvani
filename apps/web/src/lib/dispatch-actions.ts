import type { DispatchTechnicianDay, JobDetail } from "@fsm/types";

export interface AssignAndScheduleInput {
  jobId: string;
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

interface PostClient {
  post: <TResponse>(path: string, body: unknown) => Promise<TResponse>;
}

export const ASSIGNED_NOT_SCHEDULED_MESSAGE =
  "The technician was assigned, but the job couldn't be scheduled. It's still on their list without a time. Drop it on a time slot to try again.";

/** Thrown when assign succeeded but schedule failed. There is no unassign route on dev, so this can't be rolled back. */
export class AssignedNotScheduledError extends Error {
  readonly jobId: string;
  readonly technicianId: string;
  override readonly cause: unknown;

  constructor(jobId: string, technicianId: string, cause: unknown) {
    super(ASSIGNED_NOT_SCHEDULED_MESSAGE);
    this.name = "AssignedNotScheduledError";
    this.jobId = jobId;
    this.technicianId = technicianId;
    this.cause = cause;
  }
}

/**
 * Places a job on the board with the dedicated dev routes:
 * POST /api/v1/jobs/:id/assign, then POST /api/v1/jobs/:id/schedule.
 * Schedule is not attempted if assign fails. If schedule fails after a successful assign, an
 * AssignedNotScheduledError explains the half-applied state (no unassign route exists to roll back).
 */
export async function assignAndScheduleJob(
  client: PostClient,
  { jobId, technicianId, scheduledStart, scheduledEnd }: AssignAndScheduleInput
): Promise<{ job: JobDetail }> {
  const id = encodeURIComponent(jobId);
  await client.post<{ job: JobDetail }>(`/api/v1/jobs/${id}/assign`, { technicianId });
  try {
    return await client.post<{ job: JobDetail }>(`/api/v1/jobs/${id}/schedule`, { scheduledStart, scheduledEnd });
  } catch (error) {
    throw new AssignedNotScheduledError(jobId, technicianId, error);
  }
}

export interface DispatchSummary {
  technicians: number;
  jobs: number;
  unassigned: number;
}

export function summarizeDispatch(
  technicians: Pick<DispatchTechnicianDay, "jobs">[],
  unscheduledCount: number
): DispatchSummary {
  return {
    technicians: technicians.length,
    jobs: technicians.reduce((total, technician) => total + technician.jobs.length, 0),
    unassigned: unscheduledCount
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function formatDispatchSummary(dateLabel: string, summary: DispatchSummary): string {
  return [
    dateLabel,
    plural(summary.technicians, "technician"),
    plural(summary.jobs, "job"),
    `${summary.unassigned} unassigned`
  ].join(" · ");
}
