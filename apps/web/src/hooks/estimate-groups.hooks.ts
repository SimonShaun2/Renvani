"use client";
import { useQuery } from "@tanstack/react-query";
import type { EstimateGroupsQuery, EstimateGroupsResponse } from "@fsm/types";
import { api } from "@/src/lib/api";

export function useEstimateGroups(query: EstimateGroupsQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  return useQuery({
    // Distinct keys prevent a slower, superseded search replacing the current result.
    // Existing estimate mutations invalidate the common ["estimates"] prefix.
    queryKey: ["estimates", "groups", query],
    queryFn: () =>
      api.get<EstimateGroupsResponse>(`/api/v1/estimates/groups?${params}`),
  });
}
