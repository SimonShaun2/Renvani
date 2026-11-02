import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CancelVisitInput,
  JobScheduleDetailResponse,
  RescheduleInput,
  ScheduleChangeResponse,
  ScheduleExceptionInput
} from "@/src/components/jobs/schedule-changes/schedule-changes.types";
import { api } from "@/src/lib/api";

export const jobScheduleKeys = {
  detail: (jobId: string) => ["scheduling-agent", "job-schedule", jobId] as const
};

const base = (jobId: string) => `/api/v1/scheduling-agent/jobs/${jobId}`;

export function useJobSchedule(jobId: string, enabled = true) {
  return useQuery({
    queryKey: jobScheduleKeys.detail(jobId),
    queryFn: () => api.get<JobScheduleDetailResponse>(`${base(jobId)}/schedule`),
    enabled
  });
}

function useScheduleWrite<TInput>(jobId: string, path: "reschedule" | "cancel" | "exceptions") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => api.post<ScheduleChangeResponse>(`${base(jobId)}/${path}`, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jobScheduleKeys.detail(jobId) }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] })
      ]);
    }
  });
}

export const useRescheduleJob = (jobId: string) => useScheduleWrite<RescheduleInput>(jobId, "reschedule");
export const useCancelJobVisit = (jobId: string) => useScheduleWrite<CancelVisitInput>(jobId, "cancel");
export const useFlagScheduleException = (jobId: string) => useScheduleWrite<ScheduleExceptionInput>(jobId, "exceptions");
