"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QboCatalogV1, QboMappingBoardV1, QboMappingKind, QboSyncStatusV1, UpsertQboMappingsBodyV1 } from "@fsm/types";

import { api } from "@/src/lib/api";

const qboSyncKeys = {
  status: ["qbo-sync", "status"] as const,
  mappings: ["qbo-sync", "mappings"] as const,
  catalog: (kind: QboMappingKind) => ["qbo-sync", "catalog", kind] as const
};

export function useQboSyncStatus() {
  return useQuery({
    queryKey: qboSyncKeys.status,
    queryFn: () => api.get<QboSyncStatusV1>("/api/v1/qbo-sync/status"),
    staleTime: 30_000
  });
}

export function useQboMappingBoard() {
  return useQuery({
    queryKey: qboSyncKeys.mappings,
    queryFn: () => api.get<QboMappingBoardV1>("/api/v1/qbo-sync/mappings"),
    staleTime: 30_000
  });
}

export function useQboCatalog(kind: QboMappingKind, enabled: boolean) {
  return useQuery({
    queryKey: qboSyncKeys.catalog(kind),
    queryFn: () => api.get<QboCatalogV1>(`/api/v1/qbo-sync/catalog?kind=${kind}`),
    enabled,
    staleTime: 60_000
  });
}

export function useSaveQboMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpsertQboMappingsBodyV1) => api.put<QboMappingBoardV1>("/api/v1/qbo-sync/mappings", body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qboSyncKeys.mappings });
      await queryClient.invalidateQueries({ queryKey: qboSyncKeys.status });
    }
  });
}

export function useRetryQboSyncIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueId: string) =>
      api.post(`/api/v1/qbo-sync/issues/${issueId}/retry`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qboSyncKeys.status });
    }
  });
}
