"use client";

import { useQuery } from "@tanstack/react-query";
import type { AttachmentEntityType, AttachmentListResult } from "@fsm/types";

import { api } from "@/src/lib/api";

const ATTACHMENT_SIGNED_URL_STALE_MS = 4 * 60 * 1000;

export const attachmentKeys = {
  entity: (entityType: AttachmentEntityType, entityId: string) =>
    ["attachments", entityType, entityId] as const
};

export function useEntityAttachments(entityType: AttachmentEntityType, entityId: string | null) {
  return useQuery({
    queryKey: entityId ? attachmentKeys.entity(entityType, entityId) : attachmentKeys.entity(entityType, "pending"),
    queryFn: () =>
      api.get<AttachmentListResult>(
        `/api/v1/attachments?entityType=${entityType}&entityId=${entityId}&page=1&limit=100`
      ),
    enabled: Boolean(entityId),
    staleTime: ATTACHMENT_SIGNED_URL_STALE_MS
  });
}

export function useCustomerAttachments(customerId: string | null) {
  return useEntityAttachments("customer", customerId);
}

export function useAssetAttachments(assetId: string | null) {
  return useEntityAttachments("asset", assetId);
}
