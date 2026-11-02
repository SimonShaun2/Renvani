"use client";

import type {
  CallRecordListResponse,
  CallTrackingNumberCreate,
  CallTrackingNumberListResponse,
  CallTrackingNumberResponse,
  CallTrackingSettingsResponse,
  CallTrackingSettingsUpdate
} from "@fsm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";

/** FS-200 web hooks for the #347 call-tracking API (owner/admin only). */
const BASE = "/api/v1/growth/call-tracking";
export const CALL_LIMIT = 50;

const keys = {
  settings: ["call-tracking", "settings"] as const,
  numbers: ["call-tracking", "numbers"] as const,
  calls: ["call-tracking", "calls"] as const
};

export const useCallTrackingSettings = (enabled: boolean) =>
  useQuery({ queryKey: keys.settings, enabled, queryFn: () => api.get<CallTrackingSettingsResponse>(`${BASE}/settings`) });

export const useCallTrackingNumbers = (enabled: boolean) =>
  useQuery({ queryKey: keys.numbers, enabled, queryFn: () => api.get<CallTrackingNumberListResponse>(`${BASE}/numbers`) });

export const useCallRecords = (enabled: boolean) =>
  useQuery({ queryKey: keys.calls, enabled, queryFn: () => api.get<CallRecordListResponse>(`${BASE}/calls?limit=${CALL_LIMIT}`) });

export function useUpdateCallTrackingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallTrackingSettingsUpdate) => api.put<CallTrackingSettingsResponse>(`${BASE}/settings`, body),
    onSuccess: (data) => qc.setQueryData(keys.settings, data)
  });
}

export function useCreateTrackingNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CallTrackingNumberCreate) => api.post<CallTrackingNumberResponse>(`${BASE}/numbers`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.numbers })
  });
}
