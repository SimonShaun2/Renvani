"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { cn, formatDate } from "@/src/lib/utils";
import type {
  PublicEstimateRecord,
  PublicEstimateTierRecord
} from "@/src/hooks/estimates.hooks";

interface CustomerEstimateViewProps {
  estimate: PublicEstimateRecord;
  backLabel?: string;
  approvedState?: boolean;
  isSubmitting?: boolean;
  onBack?: () => void;
  onApprove: (input: { approvedByName: string; selectedEstimateNumber?: string }) => Promise<void>;
  onDecline?: (reason?: string) => Promise<void>;
}

function TierCard({
  tier,
  selected,
  onSelect
}: {
  tier: PublicEstimateTierRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[28px] border px-5 py-5 text-left transition",
        selected
          ? "border-brand-accent bg-brand-accent-light shadow-[0_18px_45px_rgba(37,122,250,0.16)]"
          : "border-neutral-200 bg-white hover:border-brand-accent/35"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{tier.tierLabel ?? "Quote"}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">{tier.title ?? "Option"}</h3>
        </div>
        {(tier.tierLabel ?? "").trim().toLowerCase() === "better" ? (
          <StatBadge label="Recommended" tone="purple" className="px-3 py-1.5 text-xs" />
        ) : null}
      </div>
      <CurrencyDisplay value={tier.total} className="mt-4 block text-3xl font-semibold tracking-tight text-neutral-900" showCents />
      <ul className="mt-4 space-y-2 text-sm text-neutral-600">
        {tier.items.slice(0, 4).map((item) => (
          <li key={`${tier.estimateNumber}-${item.name}`} className="flex items-start justify-between gap-3">
            <span>{item.name}</span>
            <span className="shrink-0 font-medium text-neutral-500">{item.quantity}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

export function CustomerEstimateView({
  estimate,
  backLabel = "Back",
  approvedState = false,
  isSubmitting = false,
  onBack,
  onApprove,
  onDecline
}: CustomerEstimateViewProps) {
  const tiers = estimate.tiers ?? [];
  const [approvedByName, setApprovedByName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [selectedEstimateNumber, setSelectedEstimateNumber] = useState<string | undefined>(
    tiers[1]?.estimateNumber ?? tiers[0]?.estimateNumber
  );
  const activeTier = useMemo(
    () => tiers.find((tier) => tier.estimateNumber === selectedEstimateNumber) ?? null,
    [selectedEstimateNumber, tiers]
  );

  const selectedSummary = activeTier
    ? {
        subtotal: activeTier.subtotal,
        taxAmount: activeTier.taxAmount,
        discountAmount: activeTier.discountAmount,
        total: activeTier.total
      }
    : {
        subtotal: estimate.subtotal,
        taxAmount: estimate.taxAmount,
        discountAmount: estimate.discountAmount,
        total: estimate.total
      };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </button>
            ) : null}
          </div>
          {estimate.expiresAt ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-500">
              <Clock3 className="h-4 w-4" />
              Expires {formatDate(estimate.expiresAt)}
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-accent">{estimate.estimateNumber}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
                {estimate.title ?? "Your Estimate"}
              </h1>
              {estimate.messageToCustomer ? (
                <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-600">{estimate.messageToCustomer}</p>
              ) : null}
            </div>

            {tiers.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-3">
                {tiers.map((tier) => (
                  <TierCard
                    key={tier.estimateNumber}
                    tier={tier}
                    selected={selectedEstimateNumber === tier.estimateNumber}
                    onSelect={() => setSelectedEstimateNumber(tier.estimateNumber)}
                  />
                ))}
              </div>
            ) : (
              <section className="rounded-[28px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{estimate.tierLabel ?? "Estimate"}</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                      {estimate.title ?? "Recommended scope"}
                    </h2>
                  </div>
                  <CurrencyDisplay value={estimate.total} className="text-3xl font-semibold tracking-tight text-neutral-900" showCents />
                </div>
                <div className="mt-5 space-y-3 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                  {estimate.items.map((item) => (
                    <div key={`${estimate.estimateNumber}-${item.name}`} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-neutral-900">{item.name}</p>
                        {item.description ? <p className="mt-1 text-sm text-neutral-500">{item.description}</p> : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-neutral-700">
                        <CurrencyDisplay value={item.total} showCents />
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-5 rounded-[32px] border border-neutral-200 bg-neutral-50 px-5 py-5">
            {approvedState ? (
              <div className="rounded-[28px] border border-success/20 bg-success-light px-5 py-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">Approved</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  The selection has been recorded. Renvani will follow up with the next step shortly.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Selected option</p>
                  <p className="mt-2 text-lg font-semibold text-neutral-900">
                    {activeTier?.tierLabel ?? estimate.tierLabel ?? "Estimate"}
                  </p>
                  <CurrencyDisplay value={selectedSummary.total} className="mt-4 block text-4xl font-semibold tracking-tight text-neutral-900" showCents />
                  <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 text-sm">
                    <div className="flex items-center justify-between gap-3 text-neutral-500">
                      <span>Subtotal</span>
                      <CurrencyDisplay value={selectedSummary.subtotal} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-neutral-500">
                      <span>Tax</span>
                      <CurrencyDisplay value={selectedSummary.taxAmount} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-neutral-500">
                      <span>Discount</span>
                      <CurrencyDisplay value={selectedSummary.discountAmount} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5">
                  <label className="text-sm font-semibold text-neutral-700">Approved by</label>
                  <input
                    value={approvedByName}
                    onChange={(event) => setApprovedByName(event.target.value)}
                    placeholder="Enter your name"
                    className="mt-3 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
                  />

                  <button
                    type="button"
                    disabled={isSubmitting || approvedByName.trim().length === 0}
                    onClick={() => {
                      void onApprove({
                        approvedByName: approvedByName.trim(),
                        ...(selectedEstimateNumber ? { selectedEstimateNumber } : {})
                      });
                    }}
                    className="mt-5 w-full rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Saving..." : "Approve Estimate"}
                  </button>

                  {onDecline ? (
                    <>
                      <label className="mt-5 block text-sm font-semibold text-neutral-700">Decline note (optional)</label>
                      <textarea
                        value={declineReason}
                        onChange={(event) => setDeclineReason(event.target.value)}
                        rows={3}
                        placeholder="Let us know why this isn't the right fit."
                        className="mt-3 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
                      />
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          void onDecline(declineReason.trim() || undefined);
                        }}
                        className="mt-3 w-full rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-600 transition hover:border-error/30 hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Decline
                      </button>
                    </>
                  ) : null}
                </div>

                {estimate.financingOffered ? (
                  <div className="rounded-[28px] border border-ai/20 bg-ai-light px-5 py-5 text-sm leading-6 text-neutral-700">
                    <div className="flex items-center gap-2 text-ai">
                      <ShieldCheck className="h-4 w-4" />
                      Financing is available for this option.
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
