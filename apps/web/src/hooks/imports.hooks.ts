"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicEnv } from "@fsm/config";
import type {
  ColumnMapping,
  ImportSessionIngestStatus,
  ImportSessionReconciliationResponse
} from "@fsm/types";

import type { CustomerListRecord } from "@/src/hooks/customers.hooks";
import { clearBrowserAuthSession, getAuthToken } from "@/src/lib/auth";
import { api, ApiError, type ApiErrorPayload } from "@/src/lib/api";

export interface ImportSessionRecord {
  id: string;
  status: "uploaded" | "mapping" | "preview" | "importing" | "completed" | "failed" | "rolled_back";
  entityType: "customers" | "jobs" | "estimates" | "price_book" | "notes" | "communications";
  fileName: string;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  duplicateRows: number | null;
  columnMappings: ColumnMapping;
  completedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  errorMessage?: string | null;
}

export interface ImportErrorRecord {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface ImportSessionResponse {
  importSession: ImportSessionRecord;
  ingest?: ImportSessionIngestStatus;
}

export interface ImportErrorsResponse {
  errors: ImportErrorRecord[];
}

interface PaginatedResponse<TItem> {
  data: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function parseError(responseText: string): ApiErrorPayload {
  try {
    return JSON.parse(responseText) as ApiErrorPayload;
  } catch {
    return {
      error: "NOT_IMPLEMENTED",
      message: responseText || "Import upload failed"
    };
  }
}

async function uploadImportFile(file: File): Promise<ImportSessionResponse> {
  const formData = new FormData();
  const token = getAuthToken();

  formData.append("file", file);

  const requestHeaders = token
    ? {
        Authorization: `Bearer ${token}`
      }
    : null;
  const uploadResponse = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/api/v1/imports`, {
    method: "POST",
    body: formData,
    credentials: "include",
    ...(requestHeaders ? { headers: requestHeaders } : {})
  });

  if (uploadResponse.status === 401) {
    clearBrowserAuthSession();

    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }

  if (!uploadResponse.ok) {
    throw new ApiError(uploadResponse.status, parseError(await uploadResponse.text()));
  }

  return (await uploadResponse.json()) as ImportSessionResponse;
}

async function fetchAllCustomersForMatching() {
  const customers: CustomerListRecord[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await api.get<PaginatedResponse<CustomerListRecord>>(
      `/api/v1/customers?page=${page}&limit=100&sortBy=lastName&sortOrder=asc`
    );

    customers.push(...response.data);
    totalPages = response.totalPages;
    page += 1;
  }

  return customers;
}

const importKeys = {
  all: ["imports"] as const,
  detail: (id: string) => ["imports", "detail", id] as const,
  errors: (id: string) => ["imports", "errors", id] as const,
  reconciliation: (id: string) => ["imports", "reconciliation", id] as const,
  customers: ["imports", "customers-match"] as const
};

export function useCreateImportSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadImportFile,
    onSuccess: async ({ importSession }) => {
      await queryClient.invalidateQueries({ queryKey: importKeys.all });
      queryClient.setQueryData(importKeys.detail(importSession.id), { importSession });
    }
  });
}

export function useImportSession(
  importSessionId: string | null,
  options: {
    enabled?: boolean;
    refetchInterval?: number | false;
  } = {}
) {
  return useQuery<ImportSessionResponse>({
    queryKey: importSessionId ? importKeys.detail(importSessionId) : importKeys.detail("pending"),
    queryFn: () => api.get<ImportSessionResponse>(`/api/v1/imports/${importSessionId}`),
    enabled: (options.enabled ?? true) && Boolean(importSessionId),
    ...(options.refetchInterval !== undefined
      ? { refetchInterval: options.refetchInterval }
      : {})
  });
}

export function useImportErrors(importSessionId: string | null, enabled = true) {
  return useQuery<ImportErrorsResponse>({
    queryKey: importSessionId ? importKeys.errors(importSessionId) : importKeys.errors("pending"),
    queryFn: () => api.get<ImportErrorsResponse>(`/api/v1/imports/${importSessionId}/errors`),
    enabled: enabled && Boolean(importSessionId)
  });
}

export function useImportReconciliation(importSessionId: string | null, enabled = true) {
  return useQuery<ImportSessionReconciliationResponse>({
    queryKey: importSessionId
      ? importKeys.reconciliation(importSessionId)
      : importKeys.reconciliation("pending"),
    queryFn: () =>
      api.get<ImportSessionReconciliationResponse>(`/api/v1/imports/${importSessionId}/reconciliation`),
    enabled: enabled && Boolean(importSessionId),
    retry: false
  });
}

export function useConfirmImportMapping(importSessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mappingOverrides: Record<string, string | null>) =>
      api.post<ImportSessionResponse>(`/api/v1/imports/${importSessionId}/confirm-mapping`, {
        mappingOverrides
      }),
    onSuccess: async ({ importSession }) => {
      if (!importSessionId) {
        return;
      }

      queryClient.setQueryData(importKeys.detail(importSessionId), { importSession });
      await queryClient.invalidateQueries({ queryKey: importKeys.detail(importSessionId) });
      await queryClient.invalidateQueries({ queryKey: importKeys.errors(importSessionId) });
    }
  });
}

export function useStartImport(importSessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (duplicateActions: Record<string, "skip" | "update_existing" | "import_new">) =>
      api.post<ImportSessionResponse>(`/api/v1/imports/${importSessionId}/start`, {
        duplicateActions
      }),
    onSuccess: async ({ importSession }) => {
      if (!importSessionId) {
        return;
      }

      queryClient.setQueryData(importKeys.detail(importSessionId), { importSession });
      await queryClient.invalidateQueries({ queryKey: importKeys.detail(importSessionId) });
    }
  });
}

export function useImportMatchCustomers(enabled: boolean) {
  return useQuery<CustomerListRecord[]>({
    queryKey: importKeys.customers,
    queryFn: fetchAllCustomersForMatching,
    enabled,
    staleTime: 5 * 60 * 1000
  });
}
