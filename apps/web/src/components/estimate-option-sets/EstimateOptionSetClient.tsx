"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ESTIMATE_OPTION_SET_MAX_OPTIONS, ESTIMATE_OPTION_SET_MIN_OPTIONS, type EstimateOption, type EstimateOptionSet } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import {
  useAddEstimateOption,
  useEstimateOptionSet,
  useRemoveEstimateOption,
  useSendOptionSet,
  useUpdateOptionSet
} from "@/src/hooks/estimate-option-sets.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import {
  canAddOption,
  canManageOptionSets,
  canRemoveOption,
  describeOptionSetError,
  isDraftSet,
  newIdempotencyKey,
  optionPositionLabel,
  setStatusLabel,
  sortOptions,
  suggestedTierLabel,
  type OptionSetErrorView
} from "./estimate-option-sets.utils";

// Figma 10:604 "Operator / 05 Estimate builder" button styles (same as the builder header).
// Figma 362:4217: secondary buttons are 44px (tablet/mobile) / 40px (desktop), r10, 18px padding, 13px semibold.
const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-[13px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50 lg:h-10";
const disabledButton =
  "inline-flex h-11 items-center justify-center rounded-[10px] bg-[#eef0f5] px-[18px] text-[13px] font-semibold text-[#5e6684] disabled:cursor-not-allowed lg:h-10";
const textButton =
  "inline-flex h-11 items-center justify-center px-2 text-[13px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50 lg:h-10";
const primaryButton =
  "inline-flex items-center justify-center rounded-[10px] bg-[#f6b400] px-4 py-2 text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none focus:border-brand-accent";

interface Props {
  tierGroupId: string;
}

export function EstimateOptionSetClient({ tierGroupId }: Props) {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canManageOptionSets(role);
  const query = useEstimateOptionSet(tierGroupId, allowed);
  const update = useUpdateOptionSet(tierGroupId);
  const add = useAddEstimateOption(tierGroupId);
  const remove = useRemoveEstimateOption(tierGroupId);
  const send = useSendOptionSet(tierGroupId);
  const [error, setError] = useState<OptionSetErrorView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const pending = update.isPending || add.isPending || remove.isPending || send.isPending;

  if (!allowed) {
    return (
      <PageLayout title="Estimate options">
        <p data-testid="option-set-no-access" className="surface-card px-6 py-6 text-sm text-neutral-600">
          Only owners, admins and dispatchers can manage estimate options.
        </p>
      </PageLayout>
    );
  }
  if (query.isLoading) return <SkeletonCard />;
  if (query.isError || !query.data) {
    return (
      <PageLayout title="Estimate options">
        <ErrorState title="Couldn't load these estimate options" onRetry={() => void query.refetch()} />
      </PageLayout>
    );
  }

  const set: EstimateOptionSet = query.data.optionSet;
  const options = sortOptions(set.options);
  const draft = isDraftSet(set);
  const versioned = () => ({ expectedVersion: set.version, idempotencyKey: newIdempotencyKey() });

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(success);
      return true;
    } catch (err) {
      setError(describeOptionSetError(err));
      return false;
    }
  };

  const reload = async () => {
    setError(null);
    setNotice(null);
    await query.refetch();
  };

  const removable = canRemoveOption(set);
  const atLimit = draft && !canAddOption(set);
  const atMinimum = draft && !removable;
  const recommendedLabel = optionPositionLabel(options, set.recommendedEstimateId ?? options.find((o) => o.recommended)?.estimateId ?? null);

  return (
    <div className="space-y-6">
      {/* Figma 362:4217 header: eyebrow, title, subtitle, divider, status pill + context row. */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Estimate options</p>
          <Link href={options[0] ? `/estimates/${options[0].estimateId}` : "/estimates"} className="text-sm font-semibold text-[#2b4acb]">
            ← Back to estimate
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1530] md:text-[28px] lg:text-[30px]">Estimate options</h1>
        <p className="text-[15px] text-[#5e6684]">Good / Better / Best options the customer picks from. Each option is its own estimate.</p>
        <div className="!mt-4 border-t border-[#e6dccb]" />
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Pill className={draft ? "bg-[#eef0f5] text-[#2a3360]" : "bg-[#e5eafb] text-[#2b4acb]"}>
            {draft ? setStatusLabel(set.status) : `${setStatusLabel(set.status)} · Locked`}
          </Pill>
          <p className="text-[13px] text-[#2a3360]" data-testid="option-set-context">
            {[set.title, options[0]?.estimateNumber].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {!draft ? (
        <Alert testId="option-set-locked" tone="info" title="These options were sent, so they can no longer be changed." detail="The customer approves one option from their link." />
      ) : null}
      {error ? (
        <Alert
          testId="option-set-error"
          tone={error.reload ? "error" : "warn"}
          title={error.title ?? error.message}
          detail={error.detail}
          action={error.reload ? (
            <button type="button" className={secondaryButton} onClick={() => void reload()}>
              Reload
            </button>
          ) : undefined}
        />
      ) : null}
      {notice ? (
        <p role="status" className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-3 text-[13px] text-[#2a3360]">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4">
          <section className="grid gap-4 lg:grid-cols-3" data-testid="option-set-options">
            {options.map((option, index) => (
              <OptionCard
                key={option.estimateId}
                option={option}
                position={index + 1}
                draft={draft}
                pending={pending}
                canRemove={removable}
                onRecommend={() =>
                  void run(
                    () => update.mutateAsync({ ...versioned(), recommendedEstimateId: option.recommended ? null : option.estimateId }),
                    option.recommended ? "Recommendation removed." : `${option.tierLabel ?? "Option"} is now the recommended option.`
                  )
                }
                onRemove={() =>
                  void run(() => remove.mutateAsync({ ...versioned(), estimateId: option.estimateId }), `${option.tierLabel ?? "Option"} removed.`)
                }
              />
            ))}
          </section>
          {draft && adding && canAddOption(set) ? (
            <AddOptionForm
              defaultLabel={suggestedTierLabel(options)}
              pending={pending}
              onCancel={() => setAdding(false)}
              onSubmit={async (option) => {
                const ok = await run(() => add.mutateAsync({ ...versioned(), option }), `${option.tierLabel} added.`);
                if (ok) setAdding(false);
              }}
            />
          ) : null}
        </div>

        {/* Figma 362:4217 "Option set manager" panel (stacks under the cards on tablet 362:4409 / mobile 362:4558). */}
        <aside data-testid="option-set-manager" className="space-y-4 rounded-[14px] border border-[#e6dccb] bg-white p-5">
          <h2 className="text-[17px] font-semibold text-[#0f1530]">Option set</h2>
          <dl className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#5e6684]">Options</dt>
              <dd className="flex items-center gap-2 font-semibold text-[#0f1530]">
                {options.length} of {ESTIMATE_OPTION_SET_MAX_OPTIONS} · minimum {ESTIMATE_OPTION_SET_MIN_OPTIONS}
                {atLimit ? (
                  <span data-testid="option-set-at-limit">
                    <Pill className="bg-[#fff4d6] text-[#0f1530]">Limit</Pill>
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#5e6684]">Recommended</dt>
              <dd className="font-semibold text-[#0f1530]">{recommendedLabel ?? "None"}</dd>
            </div>
          </dl>
          {draft ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={atLimit ? disabledButton : secondaryButton}
                  disabled={pending || atLimit || adding}
                  onClick={() => setAdding(true)}
                >
                  Add option
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={pending || !recommendedLabel}
                  onClick={() => void run(() => update.mutateAsync({ ...versioned(), recommendedEstimateId: null }), "Recommendation removed.")}
                >
                  Clear recommended
                </button>
              </div>
              <p className="text-[12.5px] text-[#5e6684]">Up to 3 options. Remove one to add another. A set needs at least 2.</p>
              {atMinimum ? (
                <Alert testId="option-set-at-minimum" tone="warn" title="A set needs at least 2 options." detail="Add another option before removing this one." />
              ) : null}
              <div className="border-t border-[#e6dccb]" />
              <button
                type="button"
                className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#0f1530] text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:h-11"
                disabled={pending}
                onClick={() => void run(() => send.mutateAsync(versioned()), "Sent. The customer gets one email and picks one option.")}
              >
                Send to customer
              </button>
              <p className="text-[12.5px] text-[#5e6684]">The customer gets one email and picks one option. Each option is its own estimate.</p>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] ${className}`}>{children}</span>;
}

// Figma 362:4325 state alerts: warn (limit/minimum) #fff4d6, error (stale/conflict) #fbe3dc, info (sent · locked) #e5eafb.
const alertTones = {
  warn: "bg-[#fff4d6] text-[#0f1530]",
  error: "bg-[#fbe3dc] text-[#b42318]",
  info: "bg-[#e5eafb] text-[#0f1530]"
} as const;

function Alert({ testId, tone, title, detail, action }: { testId: string; tone: keyof typeof alertTones; title: string; detail?: string | undefined; action?: ReactNode }) {
  return (
    <div role={tone === "info" ? "status" : "alert"} data-testid={testId} className={`flex flex-wrap items-center justify-between gap-3 rounded-[10px] p-3.5 ${alertTones[tone]}`}>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {detail ? <p className="mt-0.5 text-[13px]">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function OptionCard({
  option,
  position,
  draft,
  pending,
  canRemove,
  onRecommend,
  onRemove
}: {
  option: EstimateOption;
  position: number;
  draft: boolean;
  pending: boolean;
  canRemove: boolean;
  onRecommend: () => void;
  onRemove: () => void;
}) {
  return (
    <article
      data-testid={`option-${option.estimateId}`}
      className={`flex flex-col gap-3.5 rounded-[14px] border bg-white p-5 ${option.recommended ? "border-[#0f1530]" : "border-[#e6dccb]"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#2a3360]">
          Option {position}{option.tierLabel ? ` · ${option.tierLabel}` : ""}
        </p>
        {option.recommended ? <Pill className="bg-[#fff4d6] text-[#0f1530]">Recommended</Pill> : null}
        {option.isSelectedTier ? <Pill className="bg-[#e4f1e8] text-[#2f7d4f]">Customer picked</Pill> : null}
      </div>
      <h3 className="text-lg font-semibold text-[#0f1530]">{option.title ?? option.estimateNumber}</h3>
      <ul className="space-y-1 text-[13.5px] text-[#2a3360]">
        {option.items.map((item) => (
          <li key={item.id}>•  {item.name}</li>
        ))}
      </ul>
      <div className="mt-auto border-t border-[#e6dccb] pt-3">
        <div className="flex items-center justify-between gap-3 text-[13.5px]">
          <span className="text-[#5e6684]">Total</span>
          <CurrencyDisplay value={option.total} className="font-semibold text-[#0f1530]" showCents />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {draft ? (
          <>
            <button type="button" className={secondaryButton} disabled={pending} onClick={onRecommend}>
              {option.recommended ? "Remove recommendation" : "Mark recommended"}
            </button>
            {canRemove ? (
              <button type="button" className={textButton} disabled={pending} onClick={onRemove}>
                Remove
              </button>
            ) : null}
          </>
        ) : null}
        <Link href={`/estimates/${option.estimateId}`} className={textButton}>
          Edit items
        </Link>
      </div>
    </article>
  );
}

function AddOptionForm({
  defaultLabel,
  pending,
  onCancel,
  onSubmit
}: {
  defaultLabel: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (option: { tierLabel: string; title?: string; items: { name: string; quantity: number; unitPrice: number }[] }) => Promise<void>;
}) {
  const [tierLabel, setTierLabel] = useState(defaultLabel);
  const [title, setTitle] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const qty = Number(quantity);
  const price = Number(unitPrice);
  const valid = tierLabel.trim().length > 0 && itemName.trim().length > 0 && qty > 0 && unitPrice !== "" && price >= 0;

  return (
    <form
      data-testid="add-option-form"
      className="surface-card grid gap-3 px-6 py-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void onSubmit({
          tierLabel: tierLabel.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
          items: [{ name: itemName.trim(), quantity: qty, unitPrice: price }]
        });
      }}
    >
      <label className="text-sm font-semibold text-neutral-700">
        Option name
        <input className={inputClass} value={tierLabel} maxLength={50} onChange={(e) => setTierLabel(e.target.value)} />
      </label>
      <label className="text-sm font-semibold text-neutral-700">
        Title (optional)
        <input className={inputClass} value={title} maxLength={255} placeholder="e.g. Repair and new filter" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="text-sm font-semibold text-neutral-700">
        First line item
        <input className={inputClass} value={itemName} maxLength={255} placeholder="e.g. Diagnostic visit" onChange={(e) => setItemName(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-neutral-700">
          Qty
          <input className={inputClass} type="number" min="0.001" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-neutral-700">
          Unit price
          <input className={inputClass} type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-neutral-500 md:col-span-2">Add more line items from the option&apos;s estimate after it&apos;s created.</p>
      <div className="flex gap-2 md:col-span-2">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={!valid || pending}>
          Add option
        </button>
      </div>
    </form>
  );
}
