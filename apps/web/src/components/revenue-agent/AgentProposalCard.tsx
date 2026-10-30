import type { OperatorInboxItem } from "@fsm/types";

import { cn } from "@/src/lib/utils";

import { availableActions, proposalStateLabel, proposalTypeConfig, type ProposalActionKey } from "./proposal.config";

const toneClass = {
  primary: "bg-brand-accent text-white hover:bg-brand-primary",
  secondary: "border border-neutral-300 text-neutral-800 hover:border-neutral-400",
  danger: "border border-red-200 text-red-700 hover:border-red-300"
} as const;

export interface AgentProposalCardProps {
  item: OperatorInboxItem;
  selected?: boolean;
  busy?: boolean;
  onSelect?: (id: string) => void;
  onAction?: (id: string, action: ProposalActionKey) => void;
}

/** Reusable, config-driven proposal card (Figma 10:309). No hooks: works anywhere a proposal is listed. */
export function AgentProposalCard({ item, selected = false, busy = false, onSelect, onAction }: AgentProposalCardProps) {
  const type = proposalTypeConfig(item.provenance.actionType);
  const actions = availableActions(item);

  return (
    <article
      data-proposal-card
      data-proposal-reveal
      data-testid="agent-proposal-card"
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm",
        selected ? "border-brand-accent" : "border-neutral-200 hover:border-neutral-300"
      )}
    >
      <button type="button" className="block w-full text-left" onClick={() => onSelect?.(item.id)}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{proposalStateLabel(item.state)}</span>
          <span className="text-neutral-500">{type.label}</span>
        </div>
        <p className="mt-2 font-semibold text-neutral-900">{item.recipient.displayName}</p>
        {item.provenance.reason ? <p className="mt-1 text-sm text-neutral-600">{item.provenance.reason}</p> : null}
        <blockquote className="mt-3 line-clamp-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-800">
          “{item.proposedContent.body}”
        </blockquote>
      </button>
      {actions.length > 0 && onAction ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={busy}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50", toneClass[action.tone])}
              onClick={() => onAction(item.id, action.key)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
