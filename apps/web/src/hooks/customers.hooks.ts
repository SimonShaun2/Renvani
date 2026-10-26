"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateAssetInput,
  CreateCustomerInput,
  CreatePropertyInput,
  CustomerImportedHistoryResponse,
  UpdateAssetInput,
  UpdateCustomerInput
} from "@fsm/types";

import { api } from "@/src/lib/api";

interface PaginatedResponse<TItem> {
  data: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerJobsQuery {
  status?: string | string[];
  technicianId?: string;
  propertyId?: string;
  assetId?: string;
  type?: string;
  priority?: string;
  scheduledAfter?: string;
  scheduledBefore?: string;
  search?: string;
  sortBy?: "scheduledStart" | "createdAt" | "priority" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CustomerListQuery {
  search?: string;
  tags?: string[];
  status?: "active" | "dormant";
  hasActiveMaintenancePlan?: boolean;
  hasOverdueInvoice?: boolean;
  sortBy?: "lastServiceDate" | "createdAt" | "lifetimeValue" | "lastName";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CustomerListRecord {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  lifetimeValue: string;
  totalJobs: number;
  lastServiceDate: string | null;
  doNotContact: boolean;
  createdAt: string;
}

export interface AssetRecord {
  id: string;
  companyId: string;
  propertyId: string;
  customerId: string;
  name: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiration: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  condition: "excellent" | "good" | "fair" | "poor" | "failed" | null;
  conditionNotes: string | null;
  conditionScore: number | null;
  replacementProbability: string | null;
  photoUrls: string[];
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  jobCount?: number;
}

export interface PropertyRecord {
  id: string;
  companyId: string;
  customerId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string | null;
  lat: string | null;
  lng: string | null;
  type: "residential" | "commercial" | "industrial" | "multi_family";
  sqft: number | null;
  yearBuilt: number | null;
  accessNotes: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  assets?: AssetRecord[];
}

export interface CustomerDetailRecord {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  leadSource: string | null;
  referredBy: string | null;
  tags: string[];
  internalNotes: string | null;
  lifetimeValue: string;
  totalJobs: number;
  lastServiceDate: string | null;
  firstServiceDate: string | null;
  prefersSms: boolean;
  prefersEmail: boolean;
  doNotContact: boolean;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  properties: PropertyRecord[];
}

export interface CustomerJobRecord {
  id: string;
  jobNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  property: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
  } | null;
  technician: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    calendarColor: string | null;
  } | null;
  createdAt: string;
}

export interface CustomerInvoiceRecord {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  dueAt: string | null;
  paidAt: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export interface CustomerPaymentRecord {
  id: string;
  companyId: string;
  invoiceId: string;
  customerId: string;
  collectedById: string | null;
  amount: string;
  method: string;
  status: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CustomerAgreementRecord {
  id: string;
  name: string;
  status: string;
  frequency: string;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
  price: string | null;
  billingCycle: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export interface CustomerActivityRecord {
  id: string;
  companyId: string;
  eventType: string;
  actorId: string | null;
  actorType: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  customerId: string | null;
  jobId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  payload: unknown;
  summary: string;
  occurredAt: string;
}

export interface CustomerMessageLogRecord {
  id: string;
  customerId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  channel: string;
  direction: string;
  toAddress: string;
  fromAddress: string | null;
  subject: string | null;
  body: string;
  providerStatus: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

interface CustomerResponse {
  customer: CustomerDetailRecord;
}

interface PropertyResponse {
  property: PropertyRecord;
}

interface PropertiesResponse {
  properties: PropertyRecord[];
}

interface AssetResponse {
  asset: AssetRecord;
}

interface InvoiceResponse {
  invoice: CustomerInvoiceRecord;
}

interface AgreementsResponse extends PaginatedResponse<CustomerAgreementRecord> {}
interface InvoicesResponse extends PaginatedResponse<CustomerInvoiceRecord> {}
interface JobsResponse extends PaginatedResponse<CustomerJobRecord> {}
interface PaymentsResponse extends PaginatedResponse<CustomerPaymentRecord> {}
interface ActivityResponse extends PaginatedResponse<CustomerActivityRecord> {}
interface MessageLogsResponse extends PaginatedResponse<CustomerMessageLogRecord> {}

function buildQueryString(
  values: Record<string, string | number | boolean | string[] | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}

const customerKeys = {
  all: ["customers"] as const,
  list: (query: CustomerListQuery) => ["customers", "list", query] as const,
  detail: (customerId: string) => ["customers", "detail", customerId] as const,
  properties: (customerId: string) => ["customers", "properties", customerId] as const,
  property: (customerId: string, propertyId: string) =>
    ["customers", "property", customerId, propertyId] as const,
  asset: (customerId: string, propertyId: string, assetId: string) =>
    ["customers", "asset", customerId, propertyId, assetId] as const,
  jobs: (customerId: string, query: CustomerJobsQuery) => ["customers", "jobs", customerId, query] as const,
  invoices: (customerId: string) => ["customers", "invoices", customerId] as const,
  payments: (customerId: string) => ["customers", "payments", customerId] as const,
  agreements: (customerId: string) => ["customers", "agreements", customerId] as const,
  activity: (customerId: string) => ["customers", "activity", customerId] as const,
  importedHistory: (customerId: string) => ["customers", "imported-history", customerId] as const,
  messages: (customerId: string) => ["customers", "messages", customerId] as const
};

async function invalidateCustomerQueries(queryClient: ReturnType<typeof useQueryClient>, customerId?: string) {
  await queryClient.invalidateQueries({ queryKey: customerKeys.all });

  if (customerId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.properties(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.invoices(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.payments(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.agreements(customerId) }),
      queryClient.invalidateQueries({ queryKey: ["customers", "jobs", customerId] }),
      queryClient.invalidateQueries({ queryKey: customerKeys.activity(customerId) }),
      queryClient.invalidateQueries({ queryKey: customerKeys.messages(customerId) })
    ]);
  }
}

export function useCustomers(query: CustomerListQuery) {
  const queryString = buildQueryString({
    search: query.search,
    tags: query.tags,
    status: query.status,
    hasActiveMaintenancePlan: query.hasActiveMaintenancePlan,
    hasOverdueInvoice: query.hasOverdueInvoice,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    limit: query.limit
  });

  return useQuery({
    queryKey: customerKeys.list(query),
    queryFn: () => api.get<PaginatedResponse<CustomerListRecord>>(`/api/v1/customers?${queryString}`)
  });
}

export function useCustomer(customerId: string | null) {
  return useQuery({
    queryKey: customerId ? customerKeys.detail(customerId) : customerKeys.detail("pending"),
    queryFn: () => api.get<CustomerResponse>(`/api/v1/customers/${customerId}`),
    enabled: Boolean(customerId)
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCustomerInput) => api.post<CustomerResponse>("/api/v1/customers", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
    }
  });
}

export function useUpdateCustomer(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCustomerInput) =>
      api.patch<CustomerResponse>(`/api/v1/customers/${customerId}`, input),
    onSuccess: async () => {
      await invalidateCustomerQueries(queryClient, customerId);
    }
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerId: string) => api.delete<void>(`/api/v1/customers/${customerId}`),
    onSuccess: async (_value, customerId) => {
      await invalidateCustomerQueries(queryClient, customerId);
    }
  });
}

export function useCustomerJobs(customerId: string | null, query: CustomerJobsQuery) {
  const queryString = buildQueryString({
    customerId: customerId ?? undefined,
    status: Array.isArray(query.status) ? query.status : query.status ? [query.status] : undefined,
    technicianId: query.technicianId,
    propertyId: query.propertyId,
    assetId: query.assetId,
    type: query.type,
    priority: query.priority,
    scheduledAfter: query.scheduledAfter,
    scheduledBefore: query.scheduledBefore,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    limit: query.limit
  });

  return useQuery({
    queryKey: customerId ? customerKeys.jobs(customerId, query) : customerKeys.jobs("pending", query),
    queryFn: () => api.get<JobsResponse>(`/api/v1/jobs?${queryString}`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerInvoices(customerId: string | null) {
  const queryString = buildQueryString({
    customerId: customerId ?? undefined,
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });

  return useQuery({
    queryKey: customerId ? customerKeys.invoices(customerId) : customerKeys.invoices("pending"),
    queryFn: () => api.get<InvoicesResponse>(`/api/v1/invoices?${queryString}`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerPayments(customerId: string | null) {
  const queryString = buildQueryString({
    customerId: customerId ?? undefined,
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });

  return useQuery({
    queryKey: customerId ? customerKeys.payments(customerId) : customerKeys.payments("pending"),
    queryFn: () => api.get<PaymentsResponse>(`/api/v1/payments?${queryString}`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerProperties(customerId: string | null) {
  return useQuery({
    queryKey: customerId ? customerKeys.properties(customerId) : customerKeys.properties("pending"),
    queryFn: () => api.get<PropertiesResponse>(`/api/v1/customers/${customerId}/properties`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerProperty(customerId: string | null, propertyId: string | null) {
  return useQuery({
    queryKey:
      customerId && propertyId
        ? customerKeys.property(customerId, propertyId)
        : customerKeys.property("pending", "pending"),
    queryFn: () => api.get<PropertyResponse>(`/api/v1/customers/${customerId}/properties/${propertyId}`),
    enabled: Boolean(customerId && propertyId)
  });
}

export function useCreateProperty(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePropertyInput) =>
      api.post<{ property: PropertyRecord }>(`/api/v1/customers/${customerId}/properties`, input),
    onSuccess: async () => {
      await invalidateCustomerQueries(queryClient, customerId);
    }
  });
}

export function useCustomerAssets(customerId: string | null) {
  const customerQuery = useCustomer(customerId);

  return {
    ...customerQuery,
    data: customerQuery.data?.customer.properties.flatMap((property) =>
      (property.assets ?? []).map((asset) => ({
        ...asset,
        property
      }))
    ) ?? []
  };
}

export function useCustomerAsset(customerId: string | null, propertyId: string | null, assetId: string | null) {
  return useQuery({
    queryKey:
      customerId && propertyId && assetId
        ? customerKeys.asset(customerId, propertyId, assetId)
        : customerKeys.asset("pending", "pending", "pending"),
    queryFn: () =>
      api.get<AssetResponse>(`/api/v1/customers/${customerId}/properties/${propertyId}/assets/${assetId}`),
    enabled: Boolean(customerId && propertyId && assetId)
  });
}

export function useCreateAsset(customerId: string, propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAssetInput) =>
      api.post<{ asset: AssetRecord }>(
        `/api/v1/customers/${customerId}/properties/${propertyId}/assets`,
        input
      ),
    onSuccess: async () => {
      await invalidateCustomerQueries(queryClient, customerId);
    }
  });
}

export function useUpdateAsset(customerId: string, propertyId: string, assetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAssetInput) =>
      api.patch<AssetResponse>(
        `/api/v1/customers/${customerId}/properties/${propertyId}/assets/${assetId}`,
        input
      ),
    onSuccess: async () => {
      await invalidateCustomerQueries(queryClient, customerId);
    }
  });
}

export function useCustomerAgreements(customerId: string | null) {
  const queryString = buildQueryString({
    customerId: customerId ?? undefined,
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });

  return useQuery({
    queryKey: customerId ? customerKeys.agreements(customerId) : customerKeys.agreements("pending"),
    queryFn: () => api.get<AgreementsResponse>(`/api/v1/service-agreements?${queryString}`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerActivity(customerId: string | null) {
  const queryString = buildQueryString({
    entityType: "customer",
    entityId: customerId ?? undefined,
    page: 1,
    limit: 100
  });

  return useQuery({
    queryKey: customerId ? customerKeys.activity(customerId) : customerKeys.activity("pending"),
    queryFn: () => api.get<ActivityResponse>(`/api/v1/activity-events?${queryString}`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerImportedHistory(customerId: string | null) {
  return useQuery({
    queryKey: customerId ? customerKeys.importedHistory(customerId) : customerKeys.importedHistory("pending"),
    queryFn: () =>
      api.get<CustomerImportedHistoryResponse>(`/api/v1/customers/${customerId}/imported-history`),
    enabled: Boolean(customerId)
  });
}

export function useCustomerMessageLogs(customerId: string | null) {
  const queryString = buildQueryString({
    customerId: customerId ?? undefined,
    page: 1,
    limit: 100
  });

  return useQuery({
    queryKey: customerId ? customerKeys.messages(customerId) : customerKeys.messages("pending"),
    queryFn: () => api.get<MessageLogsResponse>(`/api/v1/message-logs?${queryString}`),
    enabled: Boolean(customerId)
  });
}

export function useSendInvoiceLink(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<InvoiceResponse>(`/api/v1/invoices/${invoiceId}/send`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });
}
