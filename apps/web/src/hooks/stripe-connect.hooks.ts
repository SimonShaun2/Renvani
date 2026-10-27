"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StripeConnectStatus } from "@fsm/types";

import { api } from "@/src/lib/api";

interface StripeUrlResponse {
  url: string;
}

interface StripeAccountSessionResponse {
  clientSecret: string;
}

const stripeConnectKeys = {
  status: ["stripe-connect", "status"] as const
};

export function useStripeConnectStatus(enabled = true) {
  return useQuery({
    queryKey: stripeConnectKeys.status,
    enabled,
    queryFn: () => api.get<StripeConnectStatus>("/api/v1/stripe/connect/status"),
    staleTime: 60 * 1000
  });
}

export function useStartStripeConnect() {
  return useMutation({
    mutationFn: () => api.post<StripeUrlResponse>("/api/v1/stripe/connect/onboard", {})
  });
}

export function useStripeConnectAccountSession() {
  return useMutation({
    mutationFn: (components: Array<"account_onboarding" | "payments" | "payouts">) =>
      api.post<StripeAccountSessionResponse>("/api/v1/stripe/connect/account-session", { components })
  });
}

export function useStripeDashboardLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<StripeUrlResponse>("/api/v1/stripe/connect/dashboard-link", {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: stripeConnectKeys.status });
    }
  });
}
