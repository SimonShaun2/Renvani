"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerHistoryTimelineResponse, FileAttachment } from "@fsm/types";

import { api } from "@/src/lib/api";
import { uploadFile } from "@/src/lib/upload";

import { attachmentKeys } from "./attachments.hooks";

export interface CustomerNoteRecord {
  id: string;
  customerId: string;
  authorId: string | null;
  content: string;
  isInternal: boolean;
  notedAt: string | null;
  createdAt: string;
}

export interface SignedUrl {
  url: string;
  expiresAt: string;
  objectKey: string;
}

export const HISTORY_PAGE_SIZE = 20;

/** GET /api/v1/customers/:id/notes (read-only on dev; there is no create-note route). */
export function useCustomerNotes(customerId: string | null) {
  return useQuery({
    queryKey: ["customers", "notes", customerId ?? "pending"],
    queryFn: () => api.get<{ notes: CustomerNoteRecord[] }>(`/api/v1/customers/${customerId}/notes`),
    enabled: Boolean(customerId)
  });
}

export function buildHistoryTimelinePath(customerId: string, cursor?: string | null): string {
  const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return `/api/v1/customers/${encodeURIComponent(customerId)}/history-timeline?${params.toString()}`;
}

/** Unified, cursor-paged customer history (jobs, estimates, invoices, payments, notes, comms). */
export function useCustomerHistoryFeed(customerId: string | null) {
  return useInfiniteQuery({
    queryKey: ["customers", "history-feed", customerId ?? "pending"],
    queryFn: ({ pageParam }) =>
      api.get<CustomerHistoryTimelineResponse>(buildHistoryTimelinePath(customerId as string, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(customerId)
  });
}

/** Mints a short-lived signed download URL: GET /api/v1/attachments/:id/download-url. */
export async function getAttachmentDownloadUrl(attachmentId: string): Promise<string> {
  const result = await api.get<{ download: SignedUrl }>(
    `/api/v1/attachments/${encodeURIComponent(attachmentId)}/download-url`
  );
  return result.download.url;
}

/**
 * Uploads a customer file. The dev signed-URL route (POST /attachments/upload-url) only mints a
 * storage URL and has no finalize route to register the attachment, so we use the existing
 * POST /attachments upload, which stores the file and creates the record in one call.
 */
export function useUploadCustomerAttachment(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (progress: number) => void }): Promise<FileAttachment> =>
      uploadFile({ file, entityType: "customer", entityId: customerId, ...(onProgress ? { onProgress } : {}) }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: attachmentKeys.entity("customer", customerId) });
    }
  });
}
