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

/**
 * Places a job on the board with the dedicated dev routes:
 * POST /api/v1/jobs/:id/assign, then POST /api/v1/jobs/:id/schedule.
 * Schedule is not attempted if assign fails, so a rejected technician never leaves a half-placed job.
 */
export async function assignAndScheduleJob(
  client: PostClient,
  { jobId, technicianId, scheduledStart, scheduledEnd }: AssignAndScheduleInput
): Promise<{ job: JobDetail }> {
  const id = encodeURIComponent(jobId);
  await client.post<{ job: JobDetail }>(`/api/v1/jobs/${id}/assign`, { technicianId });
  return client.post<{ job: JobDetail }>(`/api/v1/jobs/${id}/schedule`, { scheduledStart, scheduledEnd });
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
