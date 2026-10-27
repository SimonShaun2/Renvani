"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApplySavedCardMigrationMappingsBody,
  GetSavedCardMigrationResponse,
  SavedCardMigration
} from "@fsm/types";

import { api } from "@/src/lib/api";

const key = (bundleId: string) => ["saved-card-migration", bundleId] as const;

export function useSavedCardMigration(bundleId: string | null, enabled = true) {
  return useQuery({
    queryKey: key(bundleId ?? "none"),
    enabled: enabled && Boolean(bundleId),
    retry: false,
    queryFn: () =>
      api.get<GetSavedCardMigrationResponse>(`/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration`)
  });
}

export function useApplySavedCardMappings(bundleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplySavedCardMigrationMappingsBody) =>
      api.post<{ migration: SavedCardMigration }>(
        `/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration/apply-mappings`,
        body
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(bundleId) })
  });
}
