"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import type {
  CreateStockLocationBody,
  StockAdjustmentBody,
  StockLevel,
  StockLocation,
  StockMutationResponse,
  StockTransferBody
} from "@fsm/types";

/** FS-181/FS-211: /api/v1/inventory routes (FS-170 #220 + #345 productName/productSku). */
export const inventoryKeys = {
  all: ["inventory"] as const,
  locations: () => ["inventory", "locations"] as const,
  levels: (locationId: string | null, lowStock: boolean) => ["inventory", "levels", locationId, lowStock] as const
};

export function buildLevelsPath(locationId: string | null, lowStock: boolean) {
  const params = new URLSearchParams();
  if (locationId) params.set("locationId", locationId);
  const qs = params.toString();
  const base = lowStock ? "/api/v1/inventory/low-stock" : "/api/v1/inventory/levels";
  return qs ? `${base}?${qs}` : base;
}

export function useStockLocations() {
  return useQuery({
    queryKey: inventoryKeys.locations(),
    queryFn: () => api.get<{ locations: StockLocation[] }>("/api/v1/inventory/locations")
  });
}

export function useStockLevels(locationId: string | null, lowStock: boolean) {
  return useQuery({
    queryKey: inventoryKeys.levels(locationId, lowStock),
    queryFn: () => api.get<{ levels: StockLevel[] }>(buildLevelsPath(locationId, lowStock))
  });
}

function useInventoryMutation<TBody, TResponse>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => api.post<TResponse>(path, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    }
  });
}

export const useCreateStockLocation = () =>
  useInventoryMutation<CreateStockLocationBody, { location: StockLocation }>("/api/v1/inventory/locations");
export const useAdjustStock = () => useInventoryMutation<StockAdjustmentBody, StockMutationResponse>("/api/v1/inventory/adjustments");
export const useTransferStock = () => useInventoryMutation<StockTransferBody, StockMutationResponse>("/api/v1/inventory/transfers");

/** Catalog names for the item picker. /api/v1/products is owner/admin only, so callers pass `enabled`. */
export function useInventoryProductOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["inventory", "product-options"],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string }> }>("/api/v1/products?isActive=true&page=1&limit=100"),
    enabled
  });
}
