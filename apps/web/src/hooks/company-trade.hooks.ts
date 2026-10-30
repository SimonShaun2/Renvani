"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HomeServiceTrade } from "@fsm/types";

import { api } from "@/src/lib/api";

export interface CompanyTradeResponse {
  trade: { trade: HomeServiceTrade | null; label: string | null; schemaType: string | null; tradeDescription?: string | null };
}

/** Body accepted by PUT /api/v1/company/trade (#318, strict). `tradeDescription` is required for "other". */
export interface UpdateCompanyTradeInput {
  trade: HomeServiceTrade;
  tradeDescription?: string | null;
}

export const companyTradeKeys = { all: ["company", "trade"] as const };

export function useCompanyTrade() {
  return useQuery({
    queryKey: companyTradeKeys.all,
    queryFn: () => api.get<CompanyTradeResponse>("/api/v1/company/trade"),
    staleTime: 60 * 1000
  });
}

export function useUpdateCompanyTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyTradeInput) => api.put<CompanyTradeResponse>("/api/v1/company/trade", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company"] });
    }
  });
}
