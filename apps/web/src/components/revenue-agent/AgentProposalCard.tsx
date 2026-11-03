import type { OperatorInboxItem } from "@fsm/types";

import { cn } from "@/src/lib/utils";

import { availableActions, consentBlockedCopy, proposalStateLabel, proposalTypeConfig, type ProposalActionKey } from "./proposal.config";

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
  /** When set, the card shows the consent-blocked state (Figma 10:363) instead of approve/edit. */
  consentBlocked?: { channel: "sms" | "email"; reason?: string } | null;
  /** Request consent. Omitted when no API exists: the button renders disabled. */
  onRequestConsent?: ((id: string) => void) | undefined;
  onDismiss?: ((id: string) => void) | undefined;
}

/** Reusable, config-driven proposal card (Figma 10:309). No hooks: works anywhere a proposal is listed. */
export function AgentProposalCard({
  item,
  selected = false,
  busy = false,
  onSelect,
  onAction,
  consentBlocked = null,
  onRequestConsent,
  onDismiss
}: AgentProposalCardProps) {
  const type = proposalTypeConfig(item.provenance.actionType);
  const actions = availableActions(item);
  const blocked = consentBlocked ? consentBlockedCopy(item.recipient.displayName, consentBlocked.channel) : null;

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
          <span className={cn("rounded-full px-2 py-0.5", blocked ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>
            {blocked ? blocked.status : proposalStateLabel(item.state)}
          </span>
          <span className="text-neutral-500">{type.label}</span>
        </div>
        <p className="mt-2 font-semibold text-neutral-900">{item.recipient.displayName}</p>
        {item.provenance.reason ? <p className="mt-1 text-sm text-neutral-600">{item.provenance.reason}</p> : null}
        <blockquote className="mt-3 line-clamp-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-800">
          “{item.proposedContent.body}”
        </blockquote>
      </button>
      {blocked ? (
        <div className="mt-3 space-y-2">
          <p role="alert" className="text-sm text-red-800" title={consentBlocked?.reason}>
            {blocked.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !onRequestConsent}
              title={onRequestConsent ? undefined : "Consent requests aren’t available yet. Ask the customer to opt in."}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50", toneClass.secondary)}
              onClick={() => onRequestConsent?.(item.id)}
            >
              {blocked.request}
            </button>
            {onDismiss ? (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                onClick={() => onDismiss(item.id)}
              >
                {blocked.dismiss}
              </button>
            ) : null}
          </div>
        </div>
      ) : actions.length > 0 && onAction ? (
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
