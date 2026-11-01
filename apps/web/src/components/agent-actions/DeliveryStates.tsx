"use client";

import { useState } from "react";

import type { OperatorInboxItem } from "@fsm/types";

import { useOperatorInboxTimeline } from "@/src/hooks/operator-inbox.hooks";
import { cn } from "@/src/lib/utils";

import { deliveryBadge, deliveryEvidence, deliverySteps, deliveryToken, isEstimateFollowUp, receiptErrorMessage, type DeliveryBadge, type StepStatus } from "./delivery-states.config";

const BADGE_TONE: Record<DeliveryBadge["tone"], string> = {
  amber: "bg-[#fff4d6] text-[#0f1530]",
  blue: "bg-[#e5eafb] text-[#2b4acb]",
  green: "bg-[#e4f1e8] text-[#2f7d4f]",
  red: "bg-[#fbe3dc] text-[#b42318]",
  muted: "bg-[#f3eadc] text-[#5e6684]"
};

const STEP_TONE: Record<StepStatus, string> = {
  done: "bg-[#e4f1e8] text-[#2f7d4f]",
  current: "bg-[#e5eafb] text-[#0f1530]",
  pending: "bg-[#fbf6ef] text-[#0f1530]"
};

const CARD = "rounded-[13px] border border-[#e6dccb] bg-white p-[16px] md:p-[23px]";

/**
 * Receipt / delivery states for one action (Figma 331:4230 desktop: card 331:4250 w707, evidence 331:4282 w361,
 * failure 331:4292 w361; mobile 341:4255 stacked). Side-by-side only from 1440px, where both fixed widths fit.
 */
export function DeliveryStates({ item }: { item: OperatorInboxItem }) {
  const [trailOpen, setTrailOpen] = useState(false);
  const trail = useOperatorInboxTimeline(item.id, trailOpen);
  const steps = deliverySteps(item);
  const badge = deliveryBadge(item);
  const evidence = deliveryEvidence(item);
  const failed = deliveryToken(item) === "failed";
  const failureMessage = failed ? receiptErrorMessage(item.executionReceipt) : null;
  const title = isEstimateFollowUp(item) ? "Estimate follow-up" : item.provenance.actionType.replace(/^[a-z_]+\./, "").replace(/\.propose$/, "").replace(/[._]/g, " ");

  return (
    <section data-testid="delivery-states" aria-label="Delivery states" className="flex w-full max-w-full flex-col gap-[16px] min-[1440px]:flex-row min-[1440px]:gap-[22px]">
      <div className={cn(CARD, "w-full min-[1440px]:w-[707px] min-[1440px]:shrink-0")} data-node-id="331:4250">
        <div className="flex flex-wrap items-start justify-between gap-[12px]">
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold first-letter:uppercase text-[#0f1530] [overflow-wrap:anywhere]">{title}{item.proposalNumber ? ` · ${item.proposalNumber}` : ""}</h3>
            <p className="mt-[8px] text-[13px] text-[#5e6684]">{badge.note}</p>
          </div>
          <span data-testid="delivery-badge" data-tone={badge.tone} className={cn("inline-flex h-[27px] shrink-0 items-center rounded-[14px] px-[11px] text-[11px] font-semibold uppercase", BADGE_TONE[badge.tone])}>
            {badge.label}
          </span>
        </div>
        <p className="mt-[20px] font-mono text-[12px] font-medium text-[#5e6684]">Customer</p>
        <p className="mt-[8px] text-[17px] font-semibold text-[#0f1530] [overflow-wrap:anywhere]">{item.recipient.displayName}</p>
        <div className="mt-[24px] h-px w-full bg-[#e6dccb]" />
        <ol className="mt-[20px] flex flex-col gap-[12px] md:gap-[20px]" aria-label="Execution timeline">
          {steps.map((step, index) => (
            <li key={step.key} data-step={step.key} data-status={step.status} className="flex items-start gap-[17px] rounded-[12px] border border-[#e6dccb] p-[12px] md:border-0 md:p-0">
              <span className={cn("hidden size-[27px] shrink-0 items-center justify-center rounded-[14px] text-[11px] font-semibold md:inline-flex", STEP_TONE[step.status])}>{index + 1}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#0f1530]">
                  <span className="md:hidden">{String(index + 1).padStart(2, "0")} / </span>
                  {step.label}
                </p>
                <p className="mt-[6px] text-[12px] text-[#5e6684]">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex w-full flex-col gap-[16px] min-[1440px]:w-[361px] min-[1440px]:shrink-0 min-[1440px]:gap-[23px]">
        <div className={CARD} data-node-id="331:4282">
          <h3 className="text-[17px] font-semibold text-[#0f1530]">Delivery evidence</h3>
          <p className="mt-[8px] text-[13px] text-[#5e6684]">The source of truth for the action</p>
          <dl className="mt-[20px] space-y-[16px] text-[12px]">
            {[
              ["Action ID", evidence.actionId],
              ["Policy version", evidence.policyVersion],
              ["Provider receipt", evidence.providerReceipt]
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-[16px]">
                <dt className="shrink-0 text-[#5e6684]">{k}</dt>
                <dd className="min-w-0 text-right font-mono text-[#0f1530] [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className={cn("mt-[20px] text-[13px]", evidence.delivered ? "text-[#2f7d4f]" : "text-[#b42318]")}>
            {evidence.delivered ? "Provider confirmed delivery." : "No evidence of delivery yet."}
          </p>
        </div>

        <div className={CARD} data-node-id="331:4292">
          <h3 className="text-[17px] font-semibold text-[#0f1530]">Failure &amp; recovery</h3>
          <p className="mt-[8px] text-[13px] text-[#5e6684]">Keep exceptions visible to the owner</p>
          {failed ? (
            <>
              <span data-testid="failure-badge" className="mt-[12px] inline-flex h-[27px] items-center rounded-[14px] bg-[#fbe3dc] px-[11px] text-[11px] font-semibold uppercase text-[#b42318]">
                Delivery failure
              </span>
              <p data-testid="failure-message" className="mt-[8px] text-[13px] text-[#b42318] [overflow-wrap:anywhere]">
                {failureMessage ?? "Execution failed."}
              </p>
            </>
          ) : null}
          <p className="mt-[16px] text-[14px] text-[#0f1530]" data-testid="failure-copy">
            A failed delivery stays in Failed with its error and event trail. Approval never turns into success on its own, and
            nothing is retried automatically.
          </p>
          <button
            type="button"
            aria-expanded={trailOpen}
            onClick={() => setTrailOpen((open) => !open)}
            className="mt-[20px] h-[44px] w-full rounded-[6px] bg-[#0f1530] px-[14px] text-left text-[13px] font-semibold text-white hover:bg-[#2a3360]"
          >
            {trailOpen ? "Hide event trail" : "Inspect event trail"}
          </button>
          {trailOpen ? (
            <div className="mt-[12px] text-[12px] text-[#5e6684]" data-testid="event-trail">
              {trail.isLoading ? <p>Loading…</p> : null}
              {trail.isError ? <p role="alert" className="text-[#b42318]">Couldn’t load the event trail.</p> : null}
              {trail.data && trail.data.length === 0 ? <p>No events yet.</p> : null}
              {trail.data && trail.data.length > 0 ? (
                <ul className="space-y-[6px]">
                  {trail.data.map((entry) => (
                    <li key={entry.id} className="[overflow-wrap:anywhere]">
                      <span className="font-mono">{new Date(entry.at).toLocaleString()}</span> · {entry.summary}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
