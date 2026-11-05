"use client";
import { useQuery } from "@tanstack/react-query";
import type { DispatchWeekQuery, DispatchWeekResponse } from "@fsm/types";
import { api } from "@/src/lib/api";

/** One bounded weekly read. No daily hook, extra EventSources, or background polling. */
export function useDispatchWeek(query: DispatchWeekQuery) {
  const params = new URLSearchParams({ technician: query.technician });
  if (query.date) params.set("date", query.date);
  return useQuery({
    queryKey: ["dispatch", "week", query.date ?? "current", query.technician],
    queryFn: () =>
      api.get<DispatchWeekResponse>(`/api/v1/dispatch/week?${params}`),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
