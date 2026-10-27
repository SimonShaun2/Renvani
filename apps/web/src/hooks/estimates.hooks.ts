"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddEstimateItemInput,
  CreateEstimateInput,
  EstimateStatus,
  ListEstimatesQuery,
  UpdateEstimateInput,
  UpdateEstimateItemInput
} from "@fsm/types";

import { api } from "@/src/lib/api";
import { publicApi } from "@/src/lib/public-api";

interface PaginatedResponse<TItem> {
  data: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EstimateItemRecord {
  id: string;
  estimateId: string;
  companyId: string;
  priceBookItemId: string | null;
  name: string;
  description: string | null;
  itemType: "service" | "labor" | "material" | "fee";
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EstimateListRecord {
  id: string;
  estimateNumber: string;
  title: string | null;
  status: EstimateStatus;
  tierLabel: string | null;
  tierGroupId: string | null;
  total: string;
  subtotal: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  sentAt: string | null;
  expiresAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

export interface EstimateDetailRecord {
  id: string;
  companyId: string;
  estimateNumber: string;
  jobId: string | null;
  customerId: string;
  propertyId: string | null;
  createdById: string | null;
  status: EstimateStatus;
  tierLabel: string | null;
  tierGroupId: string | null;
  isSelectedTier: boolean | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  title: string | null;
  messageToCustomer: string | null;
  internalNotes: string | null;
  approvalToken: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  approvedSignatureUrl: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  followUpSentAt: string | null;
  financingOffered: boolean | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
  property: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
  } | null;
  job: {
    id: string;
    jobNumber: string;
    title: string;
  } | null;
  items: EstimateItemRecord[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EstimateGroupRecord {
  primary: EstimateDetailRecord;
  estimates: EstimateDetailRecord[];
}

export interface PublicEstimateTierRecord {
  estimateNumber: string;
  title: string | null;
  tierLabel: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  items: Array<{
    name: string;
    description: string | null;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
}

export interface PublicEstimateSchedulingRecord {
  companyName: string;
  bookingSlug: string;
  zip: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  property: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zip: string;
  } | null;
}

export interface PublicEstimateRecord {
  estimateNumber: string;
  title: string | null;
  status: EstimateStatus;
  messageToCustomer: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  financingOffered: boolean | null;
  tierLabel: string | null;
  expiresAt: string | null;
  tiers: PublicEstimateTierRecord[] | null;
  items: Array<{
    name: string;
    description: string | null;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
}

interface EstimateResponse {
  estimate: EstimateDetailRecord;
}

interface JobFromEstimateResponse {
  job: {
    id: string;
    jobNumber: string;
    title: string;
    customerId: string;
    propertyId: string | null;
    technicianId: string | null;
    estimateId: string | null;
    invoiceId: string | null;
    assetId: string | null;
    parentJobId: string | null;
    type: string;
    priority: string;
    status: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
    description: string | null;
    customerNotes: string | null;
    techNotes: string | null;
    estimateTotal: string | null;
    invoiceTotal: string | null;
    signedAt: string | null;
    completionSummary: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
}

interface EstimateItemResponse {
  item: EstimateItemRecord;
}

interface PublicEstimateResponse {
  estimate: PublicEstimateRecord;
  scheduling: PublicEstimateSchedulingRecord | null;
}

function buildQueryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}

function getTierSortRank(label: string | null): number {
  switch ((label ?? "").trim().toLowerCase()) {
    case "good":
      return 0;
    case "better":
      return 1;
    case "best":
      return 2;
    default:
      return 99;
  }
}

function sortEstimateGroup(estimates: EstimateDetailRecord[]) {
  return estimates.slice().sort((left, right) => {
    const tierComparison = getTierSortRank(left.tierLabel) - getTierSortRank(right.tierLabel);
    if (tierComparison !== 0) {
      return tierComparison;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function getPrimaryEstimate(estimates: EstimateDetailRecord[]): EstimateDetailRecord {
  const approved = estimates.find((estimate) => estimate.isSelectedTier || estimate.status === "approved");
  if (approved) {
    return approved;
  }

  const betterTier = estimates.find((estimate) => (estimate.tierLabel ?? "").trim().toLowerCase() === "better");
  if (betterTier) {
    return betterTier;
  }

  return estimates[0]!;
}

const estimateKeys = {
  all: ["estimates"] as const,
  list: (query: ListEstimatesQuery) => ["estimates", "list", query] as const,
  detail: (estimateId: string) => ["estimates", "detail", estimateId] as const,
  group: (estimateId: string) => ["estimates", "group", estimateId] as const,
  publicView: (token: string) => ["estimates", "public", token] as const
};

async function invalidateEstimateQueries(queryClient: ReturnType<typeof useQueryClient>, estimateId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: estimateKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["customers"] }),
    queryClient.invalidateQueries({ queryKey: ["jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    queryClient.invalidateQueries({ queryKey: ["ai-revenue"] })
  ]);

  if (estimateId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: estimateKeys.detail(estimateId) }),
      queryClient.invalidateQueries({ queryKey: estimateKeys.group(estimateId) })
    ]);
  }
}

export function useEstimates(query: ListEstimatesQuery) {
  const queryString = buildQueryString({
    status: query.status,
    customerId: query.customerId,
    jobId: query.jobId,
    tierGroupId: query.tierGroupId,
    search: query.search,
    createdAfter: query.createdAfter,
    createdBefore: query.createdBefore,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    limit: query.limit
  });

  return useQuery({
    queryKey: estimateKeys.list(query),
    queryFn: () => api.get<PaginatedResponse<EstimateListRecord>>(`/api/v1/estimates?${queryString}`)
  });
}

export function useEstimate(estimateId: string | null) {
  return useQuery({
    queryKey: estimateId ? estimateKeys.detail(estimateId) : estimateKeys.detail("pending"),
    queryFn: () => api.get<EstimateResponse>(`/api/v1/estimates/${estimateId}`),
    enabled: Boolean(estimateId)
  });
}

export function useEstimateGroup(estimateId: string | null) {
  return useQuery({
    queryKey: estimateId ? estimateKeys.group(estimateId) : estimateKeys.group("pending"),
    queryFn: async (): Promise<EstimateGroupRecord> => {
      const initial = await api.get<EstimateResponse>(`/api/v1/estimates/${estimateId}`);
      const anchorEstimate = initial.estimate;

      if (!anchorEstimate.tierGroupId) {
        return {
          primary: anchorEstimate,
          estimates: [anchorEstimate]
        };
      }

      const listResponse = await api.get<PaginatedResponse<EstimateListRecord>>(
        `/api/v1/estimates?${buildQueryString({
          tierGroupId: anchorEstimate.tierGroupId,
          page: 1,
          limit: 100,
          sortBy: "createdAt",
          sortOrder: "asc"
        })}`
      );
      const estimates = await Promise.all(
        listResponse.data.map(async (estimate) => {
          const response = await api.get<EstimateResponse>(`/api/v1/estimates/${estimate.id}`);
          return response.estimate;
        })
      );
      const sorted = sortEstimateGroup(estimates);

      return {
        primary: getPrimaryEstimate(sorted),
        estimates: sorted
      };
    },
    enabled: Boolean(estimateId)
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEstimateInput) => api.post<EstimateResponse>("/api/v1/estimates", input),
    onSuccess: async (response) => {
      await invalidateEstimateQueries(queryClient, response.estimate.id);
    }
  });
}

export function useUpdateEstimate(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEstimateInput) => api.patch<EstimateResponse>(`/api/v1/estimates/${estimateId}`, input),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useDeleteEstimate(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<void>(`/api/v1/estimates/${estimateId}`),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useSendEstimate(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<EstimateResponse>(`/api/v1/estimates/${estimateId}/send`, {}),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useApproveEstimate(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<EstimateResponse>(`/api/v1/estimates/${estimateId}/approve`, {}),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useDeclineEstimate(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) => api.post<EstimateResponse>(`/api/v1/estimates/${estimateId}/decline`, { reason }),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useReviseEstimate(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<EstimateResponse>(`/api/v1/estimates/${estimateId}/revise`, {}),
    onSuccess: async (response) => {
      await invalidateEstimateQueries(queryClient, response.estimate.id);
    }
  });
}

export function useConvertEstimateToJob(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<JobFromEstimateResponse>(`/api/v1/estimates/${estimateId}/convert-to-job`, {}),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useAddEstimateItem(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddEstimateItemInput) =>
      api.post<EstimateItemResponse>(`/api/v1/estimates/${estimateId}/items`, input),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useUpdateEstimateItem(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateEstimateItemInput }) =>
      api.patch<EstimateItemResponse>(`/api/v1/estimates/${estimateId}/items/${itemId}`, input),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function useDeleteEstimateItem(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => api.delete<void>(`/api/v1/estimates/${estimateId}/items/${itemId}`),
    onSuccess: async () => {
      await invalidateEstimateQueries(queryClient, estimateId);
    }
  });
}

export function usePublicEstimate(token: string | null) {
  return useQuery({
    queryKey: token ? estimateKeys.publicView(token) : estimateKeys.publicView("pending"),
    queryFn: () => publicApi.get<PublicEstimateResponse>(`/api/v1/public/estimates/${token}`),
    enabled: Boolean(token)
  });
}

export function usePublicApproveEstimate(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { approvedByName: string; selectedEstimateNumber?: string }) =>
      publicApi.post<{ success: boolean }>(`/api/v1/public/estimates/${token}/approve`, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: estimateKeys.publicView(token) });
    }
  });
}

export function usePublicDeclineEstimate(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason?: string) =>
      publicApi.post<{ success: boolean }>(`/api/v1/public/estimates/${token}/decline`, {
        ...(reason ? { reason } : {})
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: estimateKeys.publicView(token) });
    }
  });
}
