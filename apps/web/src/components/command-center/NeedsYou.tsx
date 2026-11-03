"use client";

import { useMemo, useState } from "react";

import type { OperatorInboxItem } from "@fsm/types";

import { AgentProposalCard } from "@/src/components/revenue-agent/AgentProposalCard";
import { AgentActionPanel } from "@/src/components/agent-actions/AgentActionPanel";
import { deliveryToken, receiptErrorMessage } from "@/src/components/agent-actions/delivery-states.config";
import { proposalTypeConfig } from "@/src/components/revenue-agent/proposal.config";
import { agentActionErrorMessage, useApproveAgentAction, useOperatorInbox } from "@/src/hooks/operator-inbox.hooks";
import { cn } from "@/src/lib/utils";

import { EMPTY, NEEDS_YOU_STATES, agentLabel, itemStatus, needsYouCounts, plural, type StatusTone } from "./command-center.config";

const pill: Record<StatusTone, string> = {
  approval: "bg-[#fff4d6] text-[#7a5600]",
  escalated: "bg-[#fbe3dc] text-[#b42318]",
  stale: "bg-[#fff4d6] text-[#7a5600]",
  neutral: "bg-[#f3eadc] text-[#2a3360]"
};
const btn = "flex min-h-11 items-center rounded-[10px] px-3.5 text-[13px] font-semibold disabled:opacity-50";

function useNeedsYouItems() {
  const query = useOperatorInbox();
  const items = useMemo(
    () => (query.data?.items ?? []).filter((item) => NEEDS_YOU_STATES.includes(item.state)),
    [query.data]
  );
  return { query, items, counts: needsYouCounts(items) };
}

/** Header subline counts (10:68). Shares the inbox query cache with NeedsYou. */
export function HeaderSummary() {
  const { query, counts } = useNeedsYouItems();
  if (query.isLoading || query.isError) return <>{EMPTY}</>;
  return <>{`${plural(counts.approvals, "approval", "approvals")} waiting · ${plural(counts.exceptions, "exception", "exceptions")}`}</>;
}

function NeedsYouItem({ item }: { item: OperatorInboxItem }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveAgentAction(item);
  const status = itemStatus(item.state);
  const canApprove = item.state === "awaiting_approval" && item.overridePaths.includes("approve");
  const evidence = item.provenance.sourceEvents.map((e) => e.summary).filter(Boolean).slice(0, 2);

  async function onApprove() {
    setError(null);
    try {
      await approve.mutateAsync();
    } catch (e) {
      setError(agentActionErrorMessage(e));
    }
  }

  return (
    <li data-cc-reveal data-testid="cc-item" className="space-y-2 border-t border-[#e6dccb] px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", pill[status.tone])}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {status.label}
        </span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#5e6684]">
          {agentLabel(item.provenance.agentProduct)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[15px] font-semibold">
            {proposalTypeConfig(item.provenance.actionType).verb} · {item.recipient.displayName}
          </p>
          <p className="text-[13px] text-[#5e6684]">{item.provenance.reason ?? EMPTY}</p>
          <p className="text-xs font-medium text-[#2b4acb]">
            {[...evidence, `policy ${item.provenance.policyVersion}`].join(" · ")}
          </p>
        </div>
        <button type="button" data-cc-button aria-expanded={open} className={cn(btn, "border border-[#e6dccb] bg-white")} onClick={() => setOpen((v) => !v)}>
          Details
        </button>
        {canApprove ? (
          <button type="button" data-cc-button disabled={approve.isPending} className={cn(btn, "bg-[#f6b400] hover:bg-[#e0a400]")} onClick={onApprove}>
            Approve &amp; send
          </button>
        ) : status.exception && item.recipient.phone ? (
          <a data-cc-button href={`tel:${item.recipient.phone}`} className={cn(btn, "bg-[#0f1530] text-white")}>
            Call customer
          </a>
        ) : null}
      </div>
      {deliveryToken(item) === "failed" ? (
        <p data-testid="cc-failure" className="text-[13px] text-[#b42318] [overflow-wrap:anywhere]">
          Delivery failure · {receiptErrorMessage(item.executionReceipt) ?? "Execution failed."}
        </p>
      ) : null}
      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
      {open ? (
        <div className="space-y-3 pt-2">
          <AgentProposalCard item={item} />
          <AgentActionPanel item={item} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </li>
  );
}

/** "Needs you" (10:96): tags 10:99 / 10:101, items 10:104/10:120/10:136/10:152 from GET /operator/inbox. */
export function NeedsYou() {
  const { query, items, counts } = useNeedsYouItems();
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#e6dccb] bg-white" data-figma="10:96">
      <div className="flex items-center justify-between px-5 py-[18px]">
        <h2 className="text-lg font-semibold">Needs you</h2>
        <div className="flex gap-2 text-[11px] font-medium">
          <span className="rounded-md bg-[#f3eadc] px-2 py-[3px] text-[#2a3360]">
            Approvals {query.isLoading ? EMPTY : counts.approvals}
          </span>
          <span className="rounded-md bg-[#fbe3dc] px-2 py-[3px] text-[#b42318]">
            Exceptions {query.isLoading ? EMPTY : counts.exceptions}
          </span>
        </div>
      </div>
      {query.isLoading ? <p className="border-t border-[#e6dccb] px-5 py-4 text-sm text-[#5e6684]">Loading…</p> : null}
      {query.isError ? <p className="border-t border-[#e6dccb] px-5 py-4 text-sm text-[#b42318]">Couldn’t load the inbox.</p> : null}
      {!query.isLoading && !query.isError && items.length === 0 ? (
        <p className="border-t border-[#e6dccb] px-5 py-4 text-sm text-[#5e6684]">Nothing needs you right now.</p>
      ) : null}
      <ul>
        {items.map((item) => (
          <NeedsYouItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
