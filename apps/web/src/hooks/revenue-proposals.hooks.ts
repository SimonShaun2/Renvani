"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GenerateRevenueProposalsBody,
  GenerateRevenueProposalsResponse,
  OperatorInboxItem,
  ProposeRecommendationResponse
} from "@fsm/types";

import { api } from "@/src/lib/api";
import { useOperatorInbox } from "@/src/hooks/operator-inbox.hooks";
import { isRevenueProposal } from "@/src/components/revenue-agent/proposal.config";

/** Revenue Agent proposals awaiting approval. Approve / reject / execute use the /agent-actions hooks. */
export function useRevenueProposalInbox() {
  const query = useOperatorInbox("awaiting_approval");
  const items: OperatorInboxItem[] = (query.data?.items ?? []).filter((item) => isRevenueProposal(item.provenance.actionType));
  return { ...query, items };
}

export function useProposeRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recommendationId: string) =>
      api.post<ProposeRecommendationResponse>(`/api/v1/ai/recommendations/${recommendationId}/propose`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operator-inbox"] });
    }
  });
}

/** Max proposals one "Find new proposals" run may create (API allows 1-50). */
export const GENERATE_LIMIT = 20;

/** Roles the API allows on generate / consent (requireRevenueAgentReviewer). */
export const REVENUE_REVIEWER_ROLES = new Set(["owner", "admin", "dispatcher"]);

/** Mirrors RevenueProposalConsentCheck from GET /ai/revenue-agent/proposals/:id/consent (read-only, nothing sent). */
export interface RevenueProposalConsent {
  actionId: string;
  channel: "sms" | "email";
  consentScope: "appointment" | "marketing";
  allowed: boolean;
  blocked: boolean;
  reason: string;
  failureCode: string | null;
  policyVersion: string;
}

export function useRevenueProposalConsent(actionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["revenue-proposal-consent", actionId],
    enabled,
    staleTime: 60_000,
    queryFn: () => api.get<RevenueProposalConsent>(`/api/v1/ai/revenue-agent/proposals/${encodeURIComponent(actionId)}/consent`)
  });
}

export function useGenerateRevenueProposals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateRevenueProposalsBody = { limit: GENERATE_LIMIT }) =>
      api.post<GenerateRevenueProposalsResponse>("/api/v1/ai/revenue-agent/proposals/generate", body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operator-inbox"] });
    }
  });
}
