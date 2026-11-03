"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateVipMembershipTierInput,
  ServiceAgreementStripeStatus,
  UpdateVipMembershipTierInput,
  VipMembershipPolicyInput
} from "@fsm/types";

import { api } from "@/src/lib/api";

export interface VipMembershipTierRecord {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  discountPercent: string;
  includedVisitsPerMonth: number | null;
  isActive: boolean;
  sortOrder: number | null;
}

export interface VipMembershipListRecord {
  id: string;
  customerId: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  vipTierId: string | null;
  tierName: string;
  status: "active" | "paused" | "expired" | "cancelled";
  monthlyPrice: string | null;
  discountPercent: string;
  stripeSubscriptionId: string | null;
  stripeStatus: ServiceAgreementStripeStatus | null;
  stripeCancelAtPeriodEnd: boolean;
  stripeCurrentPeriodEnd: string | null;
  startDate: string;
}

export interface VipMembershipPolicyRecord {
  maxPauseMonths: number;
  pastDueGraceDays: number;
}

const vipKeys = {
  tiers: ["vip-tiers"] as const,
  memberships: ["vip-memberships"] as const,
  policy: ["vip-policy"] as const
};

export function useVipTiers() {
  return useQuery({
    queryKey: vipKeys.tiers,
    queryFn: () => api.get<{ tiers: VipMembershipTierRecord[] }>("/api/v1/vip/tiers")
  });
}

export function useVipMemberships() {
  return useQuery({
    queryKey: vipKeys.memberships,
    queryFn: () => api.get<{ memberships: VipMembershipListRecord[] }>("/api/v1/vip/memberships")
  });
}

export function useVipPolicy() {
  return useQuery({
    queryKey: vipKeys.policy,
    queryFn: () => api.get<{ policy: VipMembershipPolicyRecord }>("/api/v1/vip/policy")
  });
}

export function useCreateVipTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVipMembershipTierInput) =>
      api.post<{ tier: VipMembershipTierRecord }>("/api/v1/vip/tiers", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vipKeys.tiers });
    }
  });
}

export function useUpdateVipTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVipMembershipTierInput }) =>
      api.patch<{ tier: VipMembershipTierRecord }>(`/api/v1/vip/tiers/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vipKeys.tiers });
    }
  });
}

export function useDeleteVipTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/vip/tiers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vipKeys.tiers });
    }
  });
}

export function useUpdateVipPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VipMembershipPolicyInput) =>
      api.patch<{ policy: VipMembershipPolicyRecord }>("/api/v1/vip/policy", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vipKeys.policy });
    }
  });
}

export function usePauseVipMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) =>
      api.post(`/api/v1/vip/memberships/${membershipId}/pause`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vipKeys.memberships });
    }
  });
}

export function useCancelVipMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      cancelImmediately
    }: {
      membershipId: string;
      cancelImmediately?: boolean;
    }) =>
      api.post(`/api/v1/vip/memberships/${membershipId}/cancel`, {
        cancelImmediately: cancelImmediately ?? false
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vipKeys.memberships });
    }
  });
}
