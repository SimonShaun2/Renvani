"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EmergencyServiceSettings,
  ServiceAreaSettings,
  UpdateEmergencyServiceBody,
  UpdateServiceAreaBody
} from "@fsm/types";

import { api } from "@/src/lib/api";

/** #320: GET/PUT /api/v1/company/service-area and /api/v1/company/emergency-service (writes: owner/admin). */
export const homeServicesKeys = {
  serviceArea: ["company", "service-area"] as const,
  emergency: ["company", "emergency-service"] as const
};

export function useServiceArea() {
  return useQuery({
    queryKey: homeServicesKeys.serviceArea,
    queryFn: () => api.get<{ serviceArea: ServiceAreaSettings }>("/api/v1/company/service-area")
  });
}

export function useEmergencyService() {
  return useQuery({
    queryKey: homeServicesKeys.emergency,
    queryFn: () => api.get<{ emergencyService: EmergencyServiceSettings }>("/api/v1/company/emergency-service")
  });
}

export function useUpdateServiceArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateServiceAreaBody) => api.put<{ serviceArea: ServiceAreaSettings }>("/api/v1/company/service-area", body),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: homeServicesKeys.serviceArea })
  });
}

export function useUpdateEmergencyService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEmergencyServiceBody) =>
      api.put<{ emergencyService: EmergencyServiceSettings }>("/api/v1/company/emergency-service", body),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: homeServicesKeys.emergency })
  });
}
