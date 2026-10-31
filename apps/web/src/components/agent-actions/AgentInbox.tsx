"use client";

import { useState } from "react";

import { ConsentAwareProposalCard } from "@/src/components/revenue-agent/ConsentAwareProposalCard";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { agentLabel } from "@/src/components/command-center/command-center.config";
import { useOperatorInbox } from "@/src/hooks/operator-inbox.hooks";
import { GENERATE_LIMIT, REVENUE_REVIEWER_ROLES, useGenerateRevenueProposals } from "@/src/hooks/revenue-proposals.hooks";
import { cn } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";

import "@/src/components/revenue-agent/revenue-agent-motion.css";

import { AgentActionPanel } from "./AgentActionPanel";
import { INBOX_TABS, agentProducts, type InboxTabKey } from "./agent-actions.config";
import { DeliveryStates } from "./DeliveryStates";
import { sortApprovals } from "./delivery-states.config";

/** Approvals inbox for every agent (Figma 10:220: tabs 10:289–10:304, list 10:309+, detail 10:379). */
export function AgentInbox() {
  const [tab, setTab] = useState<InboxTabKey>("awaiting_approval");
  const [agent, setAgent] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inbox = useOperatorInbox(tab);
  const generate = useGenerateRevenueProposals();
  const role = useAuthStore((state) => state.user?.role ?? null);
  const canReview = role !== null && REVENUE_REVIEWER_ROLES.has(role);
  const items = inbox.data?.items ?? [];
  const visible = sortApprovals(agent === "all" ? items : items.filter((i) => i.provenance.agentProduct === agent));
  const selected = visible.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Inbox state" className="flex flex-wrap gap-2">
          {INBOX_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setSelectedId(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                tab === t.key ? "border-[#0f1530] bg-[#0f1530] text-white" : "border-[#e6dccb] bg-white text-[#0f1530]"
              )}
            >
              {t.label}
              {tab === t.key ? ` ${inbox.isLoading ? "—" : items.length}` : null}
            </button>
          ))}
        </div>
        <select
          aria-label="Agent"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="rounded-full border border-[#e6dccb] bg-white px-3 py-1.5 text-[13px] font-medium"
        >
          <option value="all">All agents</option>
          {agentProducts(items).map((p) => (
            <option key={p} value={p}>
              {agentLabel(p)}
            </option>
          ))}
        </select>
        {canReview ? (
          <button
            type="button"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ limit: GENERATE_LIMIT })}
            className="ml-auto rounded-[10px] border border-[#e6dccb] bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {generate.isPending ? "Finding…" : "Find new proposals"}
          </button>
        ) : null}
      </div>
      {generate.isError ? (
        <p role="alert" className="text-sm text-[#b42318]">
          Couldn’t find new proposals{generate.error instanceof Error && generate.error.message ? `: ${generate.error.message}` : "."}
        </p>
      ) : null}
      {generate.data ? (
        <p className="text-sm text-[#5e6684]">
          {generate.data.created} new · {generate.data.existing} already waiting · {generate.data.skipped} skipped
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {inbox.isLoading ? <p className="text-sm text-[#5e6684]">Loading…</p> : null}
          {inbox.isError ? (
            <ErrorState compact title="Couldn’t load the inbox" onRetry={() => void inbox.refetch()} isRetrying={inbox.isFetching} />
          ) : null}
          {!inbox.isLoading && !inbox.isError && visible.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#e6dccb] bg-white p-6 text-sm text-[#5e6684]">Nothing here.</p>
          ) : null}
          {visible.map((item) => (
            <ConsentAwareProposalCard
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              canReview={canReview}
              onSelect={setSelectedId}
            />
          ))}
        </div>
        <div className="rounded-[14px] border border-[#e6dccb] bg-white p-6">
          {selected ? (
            <AgentActionPanel key={selected.id} item={selected} onDone={() => setSelectedId(null)} />
          ) : (
            <p className="text-sm text-[#5e6684]">Select an item to see what happens if you approve it.</p>
          )}
        </div>
      </div>
      {selected ? <DeliveryStates key={`delivery-${selected.id}`} item={selected} /> : null}
    </div>
  );
}
