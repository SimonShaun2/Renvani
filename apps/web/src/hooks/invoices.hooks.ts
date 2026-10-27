"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddInvoiceItemInput,
  CreateInvoiceInput,
  InvoiceStatus,
  ListInvoicesQuery,
  RecordPaymentInput,
  UpdateInvoiceInput,
  UpdateInvoiceItemInput
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

export interface InvoiceItemRecord {
  id: string;
  invoiceId: string;
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

export interface InvoiceListRecord {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: InvoiceStatus;
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

export interface InvoicePaymentSummaryRecord {
  id: string;
  amount: string;
  method: string;
  status: string;
  paidAt: string | null;
  stripePaymentIntentId: string | null;
}

export interface InvoiceDetailRecord {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: InvoiceStatus;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  amountPaid: string;
  balanceDue: string;
  issuedAt: string | null;
  sentAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  stripePaymentLinkUrl: string | null;
  paymentToken: string | null;
  messageToCustomer: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
  job: {
    id: string;
    jobNumber: string;
    title: string;
  } | null;
  items: InvoiceItemRecord[];
  payments: InvoicePaymentSummaryRecord[];
  createdAt: string;
}

interface InvoiceResponse {
  invoice: InvoiceDetailRecord;
}

interface InvoiceItemResponse {
  item: InvoiceItemRecord;
}

interface PublicPaymentLinkResponse {
  invoiceNumber: string;
  paymentLinkUrl: string;
  checkoutClientSecret: string | null;
  invoiceAmount: string;
  platformFeeAmount: string;
  totalDue: string;
  platformFeePercent: number | null;
  platformFeePaidByCustomer: boolean;
  platformFeeDisclosure: string | null;
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

const invoiceKeys = {
  all: ["invoices"] as const,
  list: (query: ListInvoicesQuery) => ["invoices", "list", query] as const,
  detail: (invoiceId: string) => ["invoices", "detail", invoiceId] as const,
  publicPay: (token: string) => ["invoices", "public-pay", token] as const
};

async function invalidateInvoiceQueries(queryClient: ReturnType<typeof useQueryClient>, invoiceId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["customers"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["ai-revenue"] })
  ]);

  if (invoiceId) {
    await queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
  }
}

export function useInvoices(query: ListInvoicesQuery) {
  const queryString = buildQueryString({
    status: query.status,
    customerId: query.customerId,
    jobId: query.jobId,
    search: query.search,
    dueBefore: query.dueBefore,
    dueAfter: query.dueAfter,
    createdAfter: query.createdAfter,
    createdBefore: query.createdBefore,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    limit: query.limit
  });

  return useQuery({
    queryKey: invoiceKeys.list(query),
    queryFn: () => api.get<PaginatedResponse<InvoiceListRecord>>(`/api/v1/invoices?${queryString}`)
  });
}

export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: invoiceId ? invoiceKeys.detail(invoiceId) : invoiceKeys.detail("pending"),
    queryFn: () => api.get<InvoiceResponse>(`/api/v1/invoices/${invoiceId}`),
    enabled: Boolean(invoiceId)
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => api.post<InvoiceResponse>("/api/v1/invoices", input),
    onSuccess: async (response) => {
      await invalidateInvoiceQueries(queryClient, response.invoice.id);
    }
  });
}

export function useUpdateInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateInvoiceInput) => api.patch<InvoiceResponse>(`/api/v1/invoices/${invoiceId}`, input),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useSendInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<InvoiceResponse>(`/api/v1/invoices/${invoiceId}/send`, {}),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useRecordPayment(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      api.post<{ payment: unknown; invoice: InvoiceDetailRecord }>(`/api/v1/invoices/${invoiceId}/payments`, input),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useVoidInvoice(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => api.post<InvoiceResponse>(`/api/v1/invoices/${invoiceId}/void`, { reason }),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useResendPaymentReminder(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<InvoiceResponse>(`/api/v1/invoices/${invoiceId}/remind`, {}),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useAddInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddInvoiceItemInput) =>
      api.post<InvoiceItemResponse>(`/api/v1/invoices/${invoiceId}/items`, input),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useUpdateInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateInvoiceItemInput }) =>
      api.patch<InvoiceItemResponse>(`/api/v1/invoices/${invoiceId}/items/${itemId}`, input),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function useDeleteInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => api.delete<void>(`/api/v1/invoices/${invoiceId}/items/${itemId}`),
    onSuccess: async () => {
      await invalidateInvoiceQueries(queryClient, invoiceId);
    }
  });
}

export function usePublicPaymentLink(token: string | null) {
  return useQuery({
    queryKey: token ? invoiceKeys.publicPay(token) : invoiceKeys.publicPay("pending"),
    queryFn: () => publicApi.get<PublicPaymentLinkResponse>(`/api/v1/public/pay/${token}`),
    enabled: Boolean(token)
  });
}
