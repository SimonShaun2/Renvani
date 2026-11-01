import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ExecuteResponse,
  ExecuteSeriesChangeInput,
  PreviewResponse,
  SeriesChange,
  SeriesDetailResponse
} from "@/src/components/recurring-series/recurring-series.types";
import { api } from "@/src/lib/api";

export const recurringSeriesKeys = {
  detail: (seriesId: string) => ["scheduling-agent", "recurring-series", seriesId] as const
};

const base = (seriesId: string) => `/api/v1/scheduling-agent/recurring-series/${seriesId}`;

export function useRecurringSeries(seriesId: string, enabled = true) {
  return useQuery({
    queryKey: recurringSeriesKeys.detail(seriesId),
    queryFn: () => api.get<SeriesDetailResponse>(base(seriesId)),
    enabled
  });
}

/** Dry run: returns the exact diff and the previewHash that apply must send. Changes nothing. */
export function usePreviewSeriesChange(seriesId: string) {
  return useMutation({
    mutationFn: (change: SeriesChange) => api.post<PreviewResponse>(`${base(seriesId)}/changes/preview`, { change })
  });
}

export function useApplySeriesChange(seriesId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExecuteSeriesChangeInput) => api.post<ExecuteResponse>(`${base(seriesId)}/changes`, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recurringSeriesKeys.detail(seriesId) });
    }
  });
}
