"use client";

import { useState } from "react";

import type { OperatorInboxItem } from "@fsm/types";

import { ApiError } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { useApproveAgentAction, useEditOperatorInboxItem, useRejectAgentAction } from "@/src/hooks/operator-inbox.hooks";
import { useGenerateRevenueProposals, useRevenueProposalInbox } from "@/src/hooks/revenue-proposals.hooks";

import { AgentProposalCard } from "./AgentProposalCard";
import { ProposalDetail } from "./ProposalDetail";
import { countByCategory, type ProposalActionKey } from "./proposal.config";
import "./revenue-agent-motion.css";

function ProposalActions({ item, onDone }: { item: OperatorInboxItem; onDone: () => void }) {
  const approve = useApproveAgentAction(item.id);
  const reject = useRejectAgentAction(item.id);
  const edit = useEditOperatorInboxItem(item.id);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setError(null);
    try {
      await edit.mutateAsync({ body: draft, ...(item.proposedContent.channel ? { channel: item.proposedContent.channel } : {}) });
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    }
  }

  async function run(action: ProposalActionKey) {
    if (action === "edit") return setDraft(item.proposedContent.body);
    setError(null);
    try {
      await (action === "approve" ? approve : reject).mutateAsync();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  return (
    <>
      <AgentProposalCard item={item} selected busy={approve.isPending || reject.isPending} onAction={(_, a) => void run(a)} />
      {draft !== null ? (
        <div className="space-y-2">
          <textarea
            aria-label="Edit message"
            className="min-h-[120px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" disabled={edit.isPending} onClick={() => void save()} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium">
            Save edits
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </>
  );
}

/** Approvals inbox for Revenue Agent proposals (Figma 10:220 list, 10:379 detail). */
export function RevenueProposalsInbox() {
  const inbox = useRevenueProposalInbox();
  const generate = useGenerateRevenueProposals();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const counts = countByCategory(inbox.items);
  const visible = filter === "all" ? inbox.items : inbox.items.filter((i) => i.provenance.actionType === filter);
  const selected = inbox.items.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter proposals">
        {counts.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={filter === c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              filter === c.key ? "border-brand-accent text-brand-accent" : "border-neutral-200 text-neutral-600"
            )}
          >
            {c.label} · {inbox.isLoading ? "—" : c.count}
          </button>
        ))}
        <button
          type="button"
          disabled={generate.isPending}
          onClick={() => generate.mutate({})}
          className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {generate.isPending ? "Finding…" : "Find new proposals"}
        </button>
      </div>
      {generate.data ? (
        <p className="text-sm text-neutral-600">
          {generate.data.created} new · {generate.data.existing} already waiting · {generate.data.skipped} skipped
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          {inbox.isLoading ? <p className="text-sm text-neutral-600">Loading proposals…</p> : null}
          {!inbox.isLoading && visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              Nothing waiting for approval.
            </p>
          ) : null}
          {visible.map((item) => (
            <AgentProposalCard key={item.id} item={item} selected={item.id === selectedId} onSelect={setSelectedId} />
          ))}
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          {selected ? (
            <div className="space-y-5">
              <ProposalDetail item={selected} />
              <ProposalActions
                key={selected.id}
                item={selected}
                onDone={() => setSelectedId(null)}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-600">Select a proposal to see what happens if you approve it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
