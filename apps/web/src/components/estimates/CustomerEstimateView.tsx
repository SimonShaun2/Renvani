"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
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

// Figma 363:121 / 363:198 / 363:273 "Customer / 05b Estimate options · Pick one" option card.
function TierCard({
  tier,
  position,
  selected,
  onSelect
}: {
  tier: PublicEstimateTierRecord;
  position: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-3.5 rounded-[14px] border bg-white p-5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2",
        selected ? "border-[#0f1530]" : "border-[#e6dccb] hover:border-[#0f1530]/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-[#0f1530] bg-[#0f1530]" : "border-[#5e6684] bg-white"
          )}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
        </span>
        <span className="text-[13px] font-medium text-[#2a3360]">{tierPositionLabel(tier, position)}</span>
        {tier.recommended ? <TierPill className="bg-[#fff4d6] text-[#0f1530]">Recommended</TierPill> : null}
      </div>
      <h3 className="text-lg font-semibold text-[#0f1530]">{tier.title ?? "Option"}</h3>
      <ul className="space-y-1 text-[13.5px] text-[#2a3360]">
        {tier.items.slice(0, 4).map((item) => (
          <li key={`${tier.estimateNumber}-${item.name}`}>•  {item.name}</li>
        ))}
      </ul>
      <div className="mt-auto flex w-full items-center justify-between gap-3 border-t border-[#e6dccb] pt-3 text-[13.5px]">
        <span className="text-[#5e6684]">Total</span>
        <CurrencyDisplay value={tier.total} className="font-semibold text-[#0f1530]" showCents />
      </div>
      {selected ? <TierPill className="self-start bg-[#0f1530] text-white">Selected option</TierPill> : null}
    </button>
  );
}

function TierPill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em]", className)}>{children}</span>;
}

/** Figma 363:121: "Option 2 · Better". */
export function tierPositionLabel(tier: Pick<PublicEstimateTierRecord, "tierLabel">, position: number): string {
  return tier.tierLabel ? `Option ${position} · ${tier.tierLabel}` : `Option ${position}`;
}

/** FS-212: preselect the business's recommended option; otherwise the middle option as before. */
export function defaultTierNumber(tiers: PublicEstimateTierRecord[]): string | undefined {
  return tiers.find((tier) => tier.recommended)?.estimateNumber ?? tiers[1]?.estimateNumber ?? tiers[0]?.estimateNumber;
}

/** FS-212: financing is disabled, so the teaser only shows once the API reports a ready provider. */
export function showFinancingTeaser(estimate: Pick<PublicEstimateRecord, "financing">): boolean {
  return Boolean(estimate.financing?.offered && estimate.financing.providerReady);
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
  const tiered = tiers.length > 0;
  const [approvedByName, setApprovedByName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [selectedEstimateNumber, setSelectedEstimateNumber] = useState<string | undefined>(
    defaultTierNumber(tiers)
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
    <div className={cn("min-h-screen text-neutral-900", tiered ? "bg-[#fbf6ef]" : "bg-white")}>
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

        <div className={cn("mt-8 grid gap-8", tiered ? "xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start" : "xl:grid-cols-[minmax(0,1fr)_360px]")}>
          <div className="space-y-6">
            {tiered ? (
              <div data-testid="tier-intro">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Your estimate</p>
                <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[#0f1530] md:text-[32px]">Choose one option</h1>
                <p className="mt-2 text-[15px] text-[#5e6684]">
                  {estimate.title ? `${estimate.title.replace(/\.$/, "")}. ` : ""}Each option is its own estimate.
                </p>
                {estimate.messageToCustomer ? <p className="mt-3 max-w-3xl text-[15px] text-[#2a3360]">{estimate.messageToCustomer}</p> : null}
              </div>
            ) : (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-accent">{estimate.estimateNumber}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
                {estimate.title ?? "Your Estimate"}
              </h1>
              {estimate.messageToCustomer ? (
                <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-600">{estimate.messageToCustomer}</p>
              ) : null}
            </div>
            )}

            {tiered ? (
              <div role="radiogroup" aria-label="Estimate options" className="grid gap-4 xl:grid-cols-3">
                {tiers.map((tier, index) => (
                  <TierCard
                    key={tier.estimateNumber}
                    tier={tier}
                    position={index + 1}
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

          <aside className={cn("space-y-5", tiered ? "" : "rounded-[32px] border border-neutral-200 bg-neutral-50 px-5 py-5")}>
            {approvedState ? (
              <div className="rounded-[28px] border border-success/20 bg-success-light px-5 py-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">Approved</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  The selection has been recorded. Renvani will follow up with the next step shortly.
                </p>
              </div>
            ) : tiered ? (
              <>
                <div data-testid="tier-approve-panel" className="space-y-4 rounded-[14px] border border-[#e6dccb] bg-white p-5">
                  <h2 className="text-[17px] font-semibold text-[#0f1530]">Approve your choice</h2>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#5e6684]">Selected option</span>
                      <span className="font-semibold text-[#0f1530]">
                        {activeTier ? tierPositionLabel(activeTier, tiers.indexOf(activeTier) + 1) : "None"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[#5e6684]">
                      <span>Subtotal</span>
                      <CurrencyDisplay value={selectedSummary.subtotal} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[#5e6684]">
                      <span>Tax</span>
                      <CurrencyDisplay value={selectedSummary.taxAmount} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[#5e6684]">
                      <span>Discount</span>
                      <CurrencyDisplay value={selectedSummary.discountAmount} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#5e6684]">Total</span>
                      <CurrencyDisplay value={selectedSummary.total} className="font-semibold text-[#0f1530]" showCents />
                    </div>
                  </div>
                  <label className="block text-[13px] font-semibold text-[#0f1530]">
                    Your name
                    <input
                      value={approvedByName}
                      onChange={(event) => setApprovedByName(event.target.value)}
                      placeholder="Enter your name"
                      className="mt-1.5 h-11 w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 text-sm font-normal text-[#0f1530] outline-none focus:border-[#0f1530]"
                    />
                  </label>
                  {onDecline ? (
                    <label className="block text-[13px] font-semibold text-[#0f1530]">
                      Decline note (optional)
                      <textarea
                        value={declineReason}
                        onChange={(event) => setDeclineReason(event.target.value)}
                        placeholder="Let us know why this isn’t the right fit."
                        className="mt-1.5 h-[88px] w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 py-2 text-sm font-normal text-[#2a3360] outline-none focus:border-[#0f1530]"
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    disabled={isSubmitting || approvedByName.trim().length === 0}
                    onClick={() => {
                      void onApprove({
                        approvedByName: approvedByName.trim(),
                        ...(selectedEstimateNumber ? { selectedEstimateNumber } : {})
                      });
                    }}
                    className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#0f1530] text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Saving..." : "Approve Estimate"}
                  </button>
                  {onDecline ? (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        void onDecline(declineReason.trim() || undefined);
                      }}
                      className="inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white text-[13px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Decline
                    </button>
                  ) : null}
                  <p className="text-[12.5px] text-[#5e6684]">You pick one option. We&apos;ll confirm timing with you.</p>
                </div>
                {showFinancingTeaser(estimate) ? (
                  <div className="rounded-[28px] border border-ai/20 bg-ai-light px-5 py-5 text-sm leading-6 text-neutral-700">
                    <div className="flex items-center gap-2 text-ai">
                      <ShieldCheck className="h-4 w-4" />
                      Financing is available for this option.
                    </div>
                  </div>
                ) : null}
              </>
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

                {showFinancingTeaser(estimate) ? (
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
        {tiered ? (
          <footer className="flex justify-center pb-4 pt-10">
            <p className="font-mono text-[11px] font-medium text-[#5e6684]">Powered by Renvani</p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
