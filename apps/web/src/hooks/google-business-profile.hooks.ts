"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";

/** GbpStatus from apps/api/src/services/growth/gbp.service.ts. */
export interface GoogleBusinessProfileStatus {
  optIn: boolean;
  provider: string;
  configured: boolean;
  updatedAt: string | null;
}

export interface GoogleBusinessProfileResponse {
  googleBusinessProfile: GoogleBusinessProfileStatus;
}

export const GBP_PATH = "/api/v1/integrations/google-business-profile";

export const gbpKeys = { status: ["integrations", "google-business-profile"] as const };

export function useGoogleBusinessProfileStatus(enabled = true) {
  return useQuery({
    queryKey: gbpKeys.status,
    queryFn: () => api.get<GoogleBusinessProfileResponse>(GBP_PATH),
    enabled
  });
}

/** The API has no version/precondition on this PUT, so callers disable while pending and we refetch after. */
export function useSetGoogleBusinessProfileOptIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (optIn: boolean) => api.put<GoogleBusinessProfileResponse>(`${GBP_PATH}/opt-in`, { optIn }),
    onSuccess: (data) => client.setQueryData(gbpKeys.status, data),
    onSettled: () => client.invalidateQueries({ queryKey: gbpKeys.status })
  });
}
