"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  GrowthCheckReportDraft,
  GrowthCheckReportDraftDetailResponse,
  GrowthCheckReportDraftEditBody,
  GrowthCheckReportDraftMutationResponse,
  GrowthCheckReportExportFormat,
  GrowthCheckReportPreviewResponse,
  GrowthCheckReportShareCreateResponse,
  GrowthCheckReportShareListResponse,
  GrowthCheckReportShareRevokeResponse
} from "@fsm/types";

import { ApiError, api, authorizedFetch } from "@/src/lib/api";

import { newIdempotencyKey } from "./growth-check-review.hooks";

const BASE = "/api/v1/growth-check";
const enc = encodeURIComponent;

export const reportKeys = {
  all: ["growth-check-report"] as const,
  byScan: (scanId: string) => ["growth-check-report", "scan", scanId] as const,
  draft: (draftId: string) => ["growth-check-report", "draft", draftId] as const,
  preview: (draftId: string) => ["growth-check-report", "preview", draftId] as const,
  shares: (draftId: string) => ["growth-check-report", "shares", draftId] as const
};

/** API failure reason (`fields.reason`, e.g. stale_version, not_approved, delivery_disabled). */
export function apiReason(error: unknown): string | null {
  return error instanceof ApiError ? (error.payload.fields?.reason ?? null) : null;
}

/** Draft for a scan; resolves to null when the scan has no draft yet (404). */
export const useScanReportDraft = (scanId: string) =>
  useQuery({
    queryKey: reportKeys.byScan(scanId),
    queryFn: async () => {
      try {
        return (await api.get<{ draft: GrowthCheckReportDraft }>(`${BASE}/scans/${enc(scanId)}/report-draft`)).draft;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    }
  });

export const useReportDraftDetail = (draftId: string) =>
  useQuery({
    queryKey: reportKeys.draft(draftId),
    queryFn: () => api.get<GrowthCheckReportDraftDetailResponse>(`${BASE}/report-drafts/${enc(draftId)}`)
  });

export const useReportPreview = (draftId: string, version: number) =>
  useQuery({
    queryKey: [...reportKeys.preview(draftId), version],
    queryFn: () => api.get<GrowthCheckReportPreviewResponse>(`${BASE}/report-drafts/${enc(draftId)}/preview`)
  });

export const useReportShares = (draftId: string) =>
  useQuery({
    queryKey: reportKeys.shares(draftId),
    queryFn: () => api.get<GrowthCheckReportShareListResponse>(`${BASE}/report-drafts/${enc(draftId)}/shares`)
  });

function useInvalidateReport() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: reportKeys.all });
}

export function useCreateReportDraft(scanId: string) {
  const invalidate = useInvalidateReport();
  return useMutation({
    mutationFn: () =>
      api.post<GrowthCheckReportDraftMutationResponse>(`${BASE}/scans/${enc(scanId)}/report-draft`, { idempotencyKey: newIdempotencyKey() }),
    onSettled: invalidate
  });
}

export type ReportEdit = Omit<GrowthCheckReportDraftEditBody, "expectedVersion" | "idempotencyKey">;

export function useEditReportDraft(draftId: string) {
  const invalidate = useInvalidateReport();
  return useMutation({
    mutationFn: ({ expectedVersion, edit }: { expectedVersion: number; edit: ReportEdit }) =>
      api.patch<GrowthCheckReportDraftMutationResponse>(`${BASE}/report-drafts/${enc(draftId)}`, {
        ...edit,
        expectedVersion,
        idempotencyKey: newIdempotencyKey()
      }),
    onSuccess: invalidate
  });
}

export function useApproveReportDraft(draftId: string) {
  const invalidate = useInvalidateReport();
  return useMutation({
    mutationFn: (expectedVersion: number) =>
      api.post<GrowthCheckReportDraftMutationResponse>(`${BASE}/report-drafts/${enc(draftId)}/approve`, {
        expectedVersion,
        idempotencyKey: newIdempotencyKey()
      }),
    onSuccess: invalidate
  });
}

export function useCreateReportShare(draftId: string) {
  const invalidate = useInvalidateReport();
  return useMutation({
    mutationFn: ({ expectedVersion, expiresInDays }: { expectedVersion: number; expiresInDays: number }) =>
      api.post<GrowthCheckReportShareCreateResponse>(`${BASE}/report-drafts/${enc(draftId)}/shares`, {
        expectedVersion,
        expiresInDays,
        idempotencyKey: newIdempotencyKey()
      }),
    onSuccess: invalidate
  });
}

export function useRevokeReportShare() {
  const invalidate = useInvalidateReport();
  return useMutation({
    mutationFn: (shareId: string) => api.post<GrowthCheckReportShareRevokeResponse>(`${BASE}/report-shares/${enc(shareId)}/revoke`, {}),
    onSuccess: invalidate
  });
}

export const EXPORT_EXTENSION: Record<GrowthCheckReportExportFormat, string> = { markdown: "md", html: "html", text: "txt", json: "json" };

/** Downloads an approved export. Throws ApiError (409 not_approved, etc.) on failure. */
export async function downloadReportExport(draftId: string, format: GrowthCheckReportExportFormat): Promise<void> {
  const response = await authorizedFetch(`${BASE}/report-drafts/${enc(draftId)}/export?format=${format}`);
  if (!response.ok) {
    let payload: ApiError["payload"] = { error: "INTERNAL_ERROR" as ApiError["payload"]["error"], message: "Export failed" };
    try {
      payload = (await response.json()) as ApiError["payload"];
    } catch {
      /* keep default */
    }
    throw new ApiError(response.status, payload);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `growth-check-report-v${response.headers.get("X-Report-Version") ?? "x"}.${EXPORT_EXTENSION[format]}`;
  link.click();
  URL.revokeObjectURL(url);
}
