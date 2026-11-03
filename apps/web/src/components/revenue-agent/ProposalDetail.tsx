import type { OperatorInboxItem } from "@fsm/types";

import { EMPTY_VALUE, proposalStateLabel, proposalTypeConfig } from "./proposal.config";

function Rows({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-neutral-500">{label}</dt>
          <dd className="text-neutral-900">{value || EMPTY_VALUE}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Proposal detail (Figma 10:379). Fields with no API yet render "—". */
export function ProposalDetail({ item }: { item: OperatorInboxItem }) {
  const type = proposalTypeConfig(item.provenance.actionType);
  const sections: { title: string; rows: [string, string | null | undefined][] }[] = [
    {
      title: "What happens if you approve",
      rows: [
        ["Action", `${type.verb} by ${item.proposedContent.channel ?? EMPTY_VALUE}`],
        ["Target", item.recipient.displayName],
        ["Then", item.consequences.join(" · ")]
      ]
    },
    {
      title: "Why the agent proposed it",
      rows: [
        ["Source", item.provenance.reason],
        ["Price rule", null],
        ["Discount", null]
      ]
    },
    {
      title: "Checks",
      rows: [
        ["Service area", null],
        [item.proposedContent.channel === "sms" ? "SMS opt-in" : "Email opt-in", null],
        ["Policy", item.provenance.policyVersion],
        ["Expires", new Date(item.expiresAt).toLocaleString()]
      ]
    }
  ];

  return (
    <div data-proposal-reveal className="space-y-5" data-testid="proposal-detail">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Proposal {item.id.slice(0, 8)} · {proposalStateLabel(item.state)}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">{type.label}</h2>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-900">{section.title}</h3>
          <Rows rows={section.rows} />
        </section>
      ))}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Audit trail</h3>
        {item.provenance.sourceEvents.length ? (
          <ul className="space-y-1 text-sm text-neutral-700">
            {item.provenance.sourceEvents.map((event) => (
              <li key={event.id}>
                {event.eventType} — {event.summary}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">{EMPTY_VALUE}</p>
        )}
      </section>
    </div>
  );
}
