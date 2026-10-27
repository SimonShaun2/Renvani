"use client";

import type {
  MobileJob,
  MobileJobResponse,
  MobileOnTheWayBody,
  MobileReportIssueBody,
  MobileReportIssueResponse,
  MobileTodayResponse
} from "@fsm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/src/lib/api";

/**
 * FS-180 — technician mobile API (FS-169, PR #218). Until #218 is on the API,
 * these routes answer Fastify's "Route … not found" 404; callers use
 * {@link isMobileRouteMissing} to fall back to the existing job routes.
 */
export const mobileKeys = {
  today: ["mobile", "today"] as const,
  job: (jobId: string) => ["mobile", "job", jobId] as const
};

export function isMobileRouteMissing(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (error.status === 501 || error.payload.error === "NOT_IMPLEMENTED") {
    return true;
  }
  return error.status === 404 && /^Route /.test(error.message);
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

function noRetryWhenMissing(failureCount: number, error: unknown) {
  return !isMobileRouteMissing(error) && failureCount < 2;
}

export function useMobileToday() {
  return useQuery({
    queryKey: mobileKeys.today,
    queryFn: () => api.get<MobileTodayResponse>("/api/v1/mobile/today"),
    retry: noRetryWhenMissing
  });
}

export function useMobileJob(jobId: string | null) {
  return useQuery({
    queryKey: mobileKeys.job(jobId ?? "pending"),
    queryFn: () => api.get<MobileJobResponse>(`/api/v1/mobile/jobs/${jobId}`),
    enabled: Boolean(jobId),
    retry: noRetryWhenMissing
  });
}

async function refreshMobile(queryClient: ReturnType<typeof useQueryClient>, jobId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: mobileKeys.today }),
    queryClient.invalidateQueries({ queryKey: mobileKeys.job(jobId) }),
    queryClient.invalidateQueries({ queryKey: ["jobs"] })
  ]);
}

/** Records on-the-way status + time only; the customer SMS stays on POST /jobs/:id/on-the-way. */
export function useMarkOnTheWay(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MobileOnTheWayBody) =>
      api.post<{ job: MobileJob }>(`/api/v1/mobile/jobs/${jobId}/on-the-way`, input),
    onSettled: () => refreshMobile(queryClient, jobId)
  });
}

export function useReportJobIssue(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MobileReportIssueBody) =>
      api.post<MobileReportIssueResponse>(`/api/v1/mobile/jobs/${jobId}/issues`, input),
    onSettled: () => refreshMobile(queryClient, jobId)
  });
}

/** Today's jobs in the API's route order, enriched with list records (customer, address). */
export function orderByToday<T extends { id: string }>(todayJobs: Pick<MobileJob, "id">[], listJobs: T[]) {
  const byId = new Map(listJobs.map((job) => [job.id, job]));
  const jobs: T[] = [];
  let unmatched = 0;
  for (const { id } of todayJobs) {
    const match = byId.get(id);
    if (match) {
      jobs.push(match);
    } else {
      unmatched += 1;
    }
  }
  return { jobs, unmatched };
}
