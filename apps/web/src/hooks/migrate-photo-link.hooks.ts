"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicEnv } from "@fsm/config";

import { api, ApiError, type ApiErrorPayload } from "@/src/lib/api";
import { getAuthToken } from "@/src/lib/auth";

async function postMultipart<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  const token = getAuthToken();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers
  });

  if (!response.ok) {
    let payload: ApiErrorPayload;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = { error: "NOT_IMPLEMENTED", message: "Upload failed" };
    }
    throw new ApiError(response.status, payload);
  }

  return (await response.json()) as TResponse;
}

export interface MigratePhotoLinkPreview {
  bundleId: string;
  importBundleId: string;
  mediaImportSessionId: string;
  upload: {
    objectCount: number;
    clientBatchCount: number;
  };
  suggestions: Array<{
    vendorFileId: string;
    relativePath: string;
    r2Key: string;
    confidence: number;
    suggestedCustomerId: string | null;
    suggestedCustomerLabel: string | null;
    suggestedJobId: string | null;
    suggestedJobLabel: string | null;
    suggestedAssetId: string | null;
    suggestedAssetLabel: string | null;
    matchReason: string | null;
  }>;
  decisions: Record<
    string,
    {
      customerId?: string | null;
      jobId?: string | null;
      assetId?: string | null;
      skip?: boolean;
    }
  >;
}

export function useMigratePhotoUploadStatus(bundleId: string | null) {
  return useQuery({
    queryKey: ["migrate-photo-upload-status", bundleId],
    enabled: Boolean(bundleId),
    queryFn: async () =>
      api.get<{
        bundleId: string;
        mediaImportSessionId: string;
        objectCount: number;
        clientBatchCount: number;
        resumable: true;
      }>(`/api/v1/migrate/photo-link/bundles/${bundleId}/upload-status`)
  });
}

export function useMigratePhotoLinkPreview(bundleId: string | null) {
  return useQuery({
    queryKey: ["migrate-photo-link-preview", bundleId],
    enabled: Boolean(bundleId),
    queryFn: async () =>
      api.get<MigratePhotoLinkPreview>(`/api/v1/migrate/photo-link/bundles/${bundleId}/preview`)
  });
}

export function useUploadMigratePhotoBatch(bundleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { clientBatchId: string; files: File[] }) => {
      const formData = new FormData();
      for (const file of input.files) {
        const relativePath = file.webkitRelativePath.length > 0 ? file.webkitRelativePath : file.name;
        formData.append(relativePath, file, file.name);
      }

      return postMultipart<{
        objectCount: number;
        clientBatchCount: number;
      }>(
        `/api/v1/migrate/photo-link/bundles/${bundleId}/upload-batch?clientBatchId=${encodeURIComponent(input.clientBatchId)}`,
        formData
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["migrate-photo-upload-status", bundleId] });
      await queryClient.invalidateQueries({ queryKey: ["migrate-photo-link-preview", bundleId] });
    }
  });
}

export function useCommitMigratePhotoLinks(bundleId: string) {
  return useMutation({
    mutationFn: async () =>
      api.post<{ enqueuedBatches: number; mediaImportSessionId: string }>(
        `/api/v1/migrate/photo-link/bundles/${bundleId}/commit-links`,
        {}
      )
  });
}
