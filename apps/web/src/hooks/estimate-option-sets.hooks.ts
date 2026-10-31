"use client";

import type { EstimateOptionInput, EstimateOptionSetResponse } from "@fsm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";

export const estimateOptionSetKeys = {
  detail: (tierGroupId: string) => ["estimate-option-sets", tierGroupId] as const
};

const base = (tierGroupId: string) => `/api/v1/estimates/option-sets/${encodeURIComponent(tierGroupId)}`;

export function useEstimateOptionSet(tierGroupId: string, enabled = true) {
  return useQuery({
    queryKey: estimateOptionSetKeys.detail(tierGroupId),
    queryFn: () => api.get<EstimateOptionSetResponse>(base(tierGroupId)),
    enabled: enabled && Boolean(tierGroupId)
  });
}

interface Versioned {
  expectedVersion: number;
  idempotencyKey: string;
}

/** Shared: every mutation returns the full set; store it and refresh the estimate lists. */
function useSetMutation<TInput>(tierGroupId: string, fn: (input: TInput) => Promise<EstimateOptionSetResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(estimateOptionSetKeys.detail(tierGroupId), { optionSet: data.optionSet });
      void queryClient.invalidateQueries({ queryKey: ["estimates"] });
    }
  });
}

export function useUpdateOptionSet(tierGroupId: string) {
  return useSetMutation(tierGroupId, (input: Versioned & { recommendedEstimateId?: string | null | undefined }) =>
    api.patch<EstimateOptionSetResponse>(base(tierGroupId), input)
  );
}

export function useAddEstimateOption(tierGroupId: string) {
  return useSetMutation(tierGroupId, (input: Versioned & { option: EstimateOptionInput }) =>
    api.post<EstimateOptionSetResponse>(`${base(tierGroupId)}/options`, input)
  );
}

export function useRemoveEstimateOption(tierGroupId: string) {
  return useSetMutation(tierGroupId, ({ estimateId, expectedVersion, idempotencyKey }: Versioned & { estimateId: string }) => {
    const query = new URLSearchParams({ expectedVersion: String(expectedVersion), idempotencyKey });
    return api.delete<EstimateOptionSetResponse>(`${base(tierGroupId)}/options/${encodeURIComponent(estimateId)}?${query.toString()}`);
  });
}

export function useSendOptionSet(tierGroupId: string) {
  return useSetMutation(tierGroupId, (input: Versioned) => api.post<EstimateOptionSetResponse>(`${base(tierGroupId)}/send`, input));
}
