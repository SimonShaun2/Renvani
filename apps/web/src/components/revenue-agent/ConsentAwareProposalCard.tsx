"use client";

import type { OperatorInboxItem } from "@fsm/types";

import { useRejectAgentAction } from "@/src/hooks/operator-inbox.hooks";
import { useRevenueProposalConsent } from "@/src/hooks/revenue-proposals.hooks";
import { showToast } from "@/src/stores/toast.store";

import { AgentProposalCard } from "./AgentProposalCard";
import { isRevenueProposal } from "./proposal.config";

/**
 * Inbox card that checks consent (GET /ai/revenue-agent/proposals/:id/consent) for Revenue proposals awaiting approval
 * and shows the Figma 10:363 consent-blocked state. Dismiss rejects the proposal; nothing is sent to the customer.
 */
export function ConsentAwareProposalCard({
  item,
  selected,
  canReview,
  onSelect
}: {
  item: OperatorInboxItem;
  selected: boolean;
  canReview: boolean;
  onSelect: (id: string) => void;
}) {
  const check = canReview && item.state === "awaiting_approval" && isRevenueProposal(item.provenance.actionType);
  const consent = useRevenueProposalConsent(item.id, check);
  const reject = useRejectAgentAction(item.id);
  const blocked = consent.data?.blocked ? { channel: consent.data.channel, reason: consent.data.reason } : null;
  const canDismiss = item.overridePaths.includes("reject");

  return (
    <AgentProposalCard
      item={item}
      selected={selected}
      busy={reject.isPending}
      onSelect={onSelect}
      consentBlocked={blocked}
      onDismiss={
        canDismiss
          ? () =>
              reject.mutate(undefined, {
                onSuccess: () => showToast({ tone: "success", title: "Proposal dismissed" }),
                onError: (error) =>
                  showToast({ tone: "error", title: "Couldn’t dismiss", description: error instanceof Error ? error.message : "Try again." })
              })
          : undefined
      }
    />
  );
}
