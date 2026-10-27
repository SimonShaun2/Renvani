"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { buildPaymentsQuery, type PaymentFilters } from "@/src/components/payments/payments.utils";

export interface PaymentListRecord {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: string;
  /** Customer-paid Service Fee on this payment (Flex); "0.00" on Flat. */
  serviceFeeAmount?: string;
  method: string;
  status: string;
  checkNumber: string | null;
  referenceNumber: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentListResponse {
  data: PaymentListRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function usePaymentsList(filters: Partial<PaymentFilters>, limit = 25, enabled = true) {
  const queryString = buildPaymentsQuery(filters, limit);
  return useQuery({
    queryKey: ["payments", "list", queryString],
    enabled,
    queryFn: () => api.get<PaymentListResponse>(`/api/v1/payments?${queryString}`)
  });
}
