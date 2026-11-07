"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { OperatorInboxItem } from "@fsm/types";
import { AgentProposalCard } from "@/src/components/revenue-agent/AgentProposalCard";
import { AgentActionPanel } from "@/src/components/agent-actions/AgentActionPanel";
import { deliveryToken, receiptErrorMessage } from "@/src/components/agent-actions/delivery-states.config";
import { proposalTypeConfig } from "@/src/components/revenue-agent/proposal.config";
import { agentActionErrorMessage, useApproveAgentAction, useOperatorInbox } from "@/src/hooks/operator-inbox.hooks";
import { commandCenterKeys } from "@/src/hooks/command-center.hooks";
import { cn } from "@/src/lib/utils";
import { EMPTY, NEEDS_YOU_STATES, agentLabel, itemStatus, needsYouCounts, plural, type StatusTone } from "./command-center.config";
import { ownerPanelState } from "./owner-home-state";
import { OwnerPanelNotice } from "./OwnerPanelNotice";

const pill: Record<StatusTone, string> = {
  approval: "bg-[#fff4d6] text-[#7a5600]", escalated: "bg-[#fbe3dc] text-[#b42318]",
  stale: "bg-[#fff4d6] text-[#7a5600]", neutral: "bg-[#f3eadc] text-[#2a3360]"
};
const btn = "flex min-h-11 items-center justify-center rounded-[10px] px-3.5 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1530] disabled:opacity-50";

function useNeedsYouItems() {
  const query = useOperatorInbox();
  const state = ownerPanelState(query);
  const items = useMemo(
    () => state === "ready" && Array.isArray(query.data?.items) ? query.data.items.filter((item) => NEEDS_YOU_STATES.includes(item.state)) : [],
    [query.data, state]
  );
  // Missing items is an invalid response, not a confirmed empty queue.
  const resolvedState = state === "ready" && !Array.isArray(query.data?.items) ? "unavailable" : state;
  return { query, state: resolvedState, items, counts: needsYouCounts(items) };
}

/** Shares the real inbox cache. Errors must never claim that no approvals are waiting. */
export function HeaderSummary() {
  const { state, counts } = useNeedsYouItems();
  if (state === "loading") return <>Checking approvals…</>;
  if (state === "unavailable") return <>Approval status unavailable</>;
  return <>{`${plural(counts.approvals, "approval", "approvals")} waiting · ${plural(counts.exceptions, "exception", "exceptions")}`}</>;
}

function NeedsYouItem({ item }: { item: OperatorInboxItem }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const approve = useApproveAgentAction(item);
  const queryClient = useQueryClient();
  const status = itemStatus(item.state);
  const canApprove = item.state === "awaiting_approval" && item.overridePaths.includes("approve");
  const evidence = item.provenance.sourceEvents.map((e) => e.summary).filter(Boolean).slice(0, 2);

  async function onApprove() {
    setError(null);
    setMessage(null);
    try {
      const result = await approve.mutateAsync();
      setMessage(result.state === "approved" ? "Approval recorded. Execution and delivery are tracked separately." : "Action state updated. Open Details to review its status.");
      await queryClient.invalidateQueries({ queryKey: commandCenterKeys.all });
    } catch (e) {
      setError(agentActionErrorMessage(e));
    }
  }

  return (
    <li data-cc-reveal data-testid="cc-item" className="space-y-2 border-t border-[#e6dccb] px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", pill[status.tone])}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />{status.label}
        </span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#5e6684]">{agentLabel(item.provenance.agentProduct)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-[1_1_240px] space-y-1 [overflow-wrap:anywhere]">
          <p className="text-[15px] font-semibold">{proposalTypeConfig(item.provenance.actionType).verb} · {item.recipient.displayName}</p>
          <p className="text-[13px] text-[#5e6684]">{item.provenance.reason ?? EMPTY}</p>
          <p className="text-xs font-medium text-[#2b4acb]">{[...evidence, `policy ${item.provenance.policyVersion}`].join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" data-cc-button aria-expanded={open} className={cn(btn, "border border-[#e6dccb] bg-white")} onClick={() => setOpen((v) => !v)}>Details</button>
          {canApprove ? (
            <button type="button" data-cc-button disabled={approve.isPending || message !== null} className={cn(btn, "bg-[#f6b400] hover:bg-[#e0a400]")} onClick={onApprove}>
              {approve.isPending ? "Approving…" : "Approve"}
            </button>
          ) : status.exception && item.recipient.phone ? (
            <a data-cc-button href={`tel:${item.recipient.phone}`} className={cn(btn, "bg-[#0f1530] text-white")}>Call customer</a>
          ) : null}
        </div>
      </div>
      {deliveryToken(item) === "failed" ? <p data-testid="cc-failure" className="text-[13px] text-[#b42318] [overflow-wrap:anywhere]">Delivery failure · {receiptErrorMessage(item.executionReceipt) ?? "Execution failed."}</p> : null}
      {error ? <p className="text-sm text-[#b42318]" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-[#2a3360]" role="status">{message}</p> : null}
      {open ? <div className="space-y-3 pt-2"><AgentProposalCard item={item} /><AgentActionPanel item={item} onDone={() => setOpen(false)} /></div> : null}
    </li>
  );
}

/** Figma 399:4253: connected approvals and exceptions, not sample/demo items. */
export function NeedsYou() {
  const { query, state, items, counts } = useNeedsYouItems();
  return (
    <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#e6dccb] bg-white" data-figma="399:4253" aria-label="Needs you" aria-busy={state === "loading"} data-panel-state={state}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-[18px]">
        <h2 className="text-lg font-semibold">Needs you</h2>
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-md bg-[#f3eadc] px-2 py-[3px] text-[#2a3360]">Approvals {state === "ready" ? counts.approvals : EMPTY}</span>
          <span className="rounded-md bg-[#fbe3dc] px-2 py-[3px] text-[#b42318]">Exceptions {state === "ready" ? counts.exceptions : EMPTY}</span>
        </div>
      </div>
      {state === "loading" ? <p className="border-t border-[#e6dccb] px-5 py-4 text-sm text-[#5e6684]" role="status">Loading approvals and exceptions…</p> : null}
      {state === "unavailable" ? <div className="border-t border-[#e6dccb] px-5 py-4"><OwnerPanelNotice message="Couldn’t load the inbox. Pending approvals are unknown, not zero." retry={() => query.refetch()} pending={query.isFetching} /></div> : null}
      {state === "ready" && items.length === 0 ? <p className="border-t border-[#e6dccb] px-5 py-4 text-sm text-[#5e6684]">Nothing needs you right now.</p> : null}
      {state === "ready" ? <ul>{items.map((item) => <NeedsYouItem key={`${item.id}:${item.version}`} item={item} />)}</ul> : null}
    </section>
  );
}
