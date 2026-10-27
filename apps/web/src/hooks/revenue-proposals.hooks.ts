"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useGenerateRevenueProposals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateRevenueProposalsBody = {}) =>
      api.post<GenerateRevenueProposalsResponse>("/api/v1/ai/revenue-agent/proposals/generate", body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operator-inbox"] });
    }
  });
}
