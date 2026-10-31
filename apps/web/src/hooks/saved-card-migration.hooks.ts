"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApplySavedCardMigrationMappingsBody,
  ConfirmStripeImportBody,
  GetSavedCardMigrationResponse,
  SavedCardMigration,
  StartSavedCardMigrationBody
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
      api.post<SavedCardMigration>(
        `/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration/apply-mappings`,
        body
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(bundleId) })
  });
}

/** POST confirm-stripe-import: saves Stripe import result rows as pending mappings (#224). */
export function useConfirmStripeImport(bundleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmStripeImportBody) =>
      api.post<SavedCardMigration>(
        `/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration/confirm-stripe-import`,
        body
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(bundleId) })
  });
}

/** POST start (201, returns the migration object): creates the saved-card migration for this import. */
export function useStartSavedCardMigration(bundleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StartSavedCardMigrationBody) =>
      api.post<SavedCardMigration>(`/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration`, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(bundleId) })
  });
}
