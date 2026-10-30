"use client";

import { useState } from "react";

import { AgentProposalCard } from "@/src/components/revenue-agent/AgentProposalCard";
import { agentLabel } from "@/src/components/command-center/command-center.config";
import { useOperatorInbox } from "@/src/hooks/operator-inbox.hooks";
import { useGenerateRevenueProposals } from "@/src/hooks/revenue-proposals.hooks";
import { cn } from "@/src/lib/utils";

import "@/src/components/revenue-agent/revenue-agent-motion.css";

import { AgentActionPanel } from "./AgentActionPanel";
import { INBOX_TABS, agentProducts, type InboxTabKey } from "./agent-actions.config";

/** Approvals inbox for every agent (Figma 10:220: tabs 10:289–10:304, list 10:309+, detail 10:379). */
export function AgentInbox() {
  const [tab, setTab] = useState<InboxTabKey>("awaiting_approval");
  const [agent, setAgent] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inbox = useOperatorInbox(tab);
  const generate = useGenerateRevenueProposals();
  const items = inbox.data?.items ?? [];
  const visible = agent === "all" ? items : items.filter((i) => i.provenance.agentProduct === agent);
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
        <button
          type="button"
          disabled={generate.isPending}
          onClick={() => generate.mutate({})}
          className="ml-auto rounded-[10px] border border-[#e6dccb] bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {generate.isPending ? "Finding…" : "Find new proposals"}
        </button>
      </div>
      {generate.data ? (
        <p className="text-sm text-[#5e6684]">
          {generate.data.created} new · {generate.data.existing} already waiting · {generate.data.skipped} skipped
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {inbox.isLoading ? <p className="text-sm text-[#5e6684]">Loading…</p> : null}
          {inbox.isError ? <p className="text-sm text-[#b42318]">Couldn’t load the inbox.</p> : null}
          {!inbox.isLoading && !inbox.isError && visible.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#e6dccb] bg-white p-6 text-sm text-[#5e6684]">Nothing here.</p>
          ) : null}
          {visible.map((item) => (
            <AgentProposalCard key={item.id} item={item} selected={item.id === selectedId} onSelect={setSelectedId} />
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
    </div>
  );
}
