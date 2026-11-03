"use client";

import type {
  GrowthCheckFindingDetailResponse,
  GrowthCheckFindingReviewBody,
  GrowthCheckFindingReviewResponse,
  GrowthCheckScanFindingsResponse,
  GrowthCheckScanHistoryResponse
} from "@fsm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";

/** FS-56 web hooks for the #346 findings-review API (owner/admin; owner_* actions owner-only server-side). */
const BASE = "/api/v1/growth-check";
export const SCAN_LIMIT = 50;

export const useGrowthCheckScans = (enabled: boolean) =>
  useQuery({
    queryKey: ["growth-check", "scans"],
    enabled,
    queryFn: () => api.get<GrowthCheckScanHistoryResponse>(`${BASE}/scans?limit=${SCAN_LIMIT}`)
  });

export const useScanFindings = (scanId: string | null) =>
  useQuery({
    queryKey: ["growth-check", "findings", scanId],
    enabled: scanId !== null,
    queryFn: () => api.get<GrowthCheckScanFindingsResponse>(`${BASE}/scans/${encodeURIComponent(scanId!)}/findings`)
  });

export const useFindingDetail = (findingId: string | null) =>
  useQuery({
    queryKey: ["growth-check", "finding", findingId],
    enabled: findingId !== null,
    queryFn: () => api.get<GrowthCheckFindingDetailResponse>(`${BASE}/findings/${encodeURIComponent(findingId!)}`)
  });

export function useReviewFinding(findingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GrowthCheckFindingReviewBody) =>
      api.post<GrowthCheckFindingReviewResponse>(`${BASE}/findings/${encodeURIComponent(findingId)}/reviews`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-check"] })
  });
}

export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `gc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
