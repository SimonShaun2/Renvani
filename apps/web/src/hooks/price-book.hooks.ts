"use client";

import { useQuery } from "@tanstack/react-query";

import type { PriceBookItemSearchResponse } from "@fsm/types";

import { api } from "@/src/lib/api";

export function usePriceBookItemSearch(query: string) {
  return useQuery({
    queryKey: ["price-book", "search", query],
    queryFn: () =>
      api.get<PriceBookItemSearchResponse>(
        `/api/v1/price-book/items/search?q=${encodeURIComponent(query)}`
      ),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000
  });
}
