"use client";

import { useQuery } from "@tanstack/react-query";

import type { DirectDemandSummary } from "@fsm/types";

import { api } from "@/src/lib/api";

export interface DirectDemandDateRange {
  startDate: string;
  endDate: string;
}

/** GET /api/v1/reporting/direct-demand (owner/admin/dispatcher). Both dates YYYY-MM-DD, required. */
export function useDirectDemandSummary(range: DirectDemandDateRange, enabled: boolean) {
  const queryString = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate }).toString();
  return useQuery({
    queryKey: ["reporting", "direct-demand", range.startDate, range.endDate],
    enabled: enabled && Boolean(range.startDate) && Boolean(range.endDate),
    queryFn: () => api.get<DirectDemandSummary>(`/api/v1/reporting/direct-demand?${queryString}`)
  });
}
