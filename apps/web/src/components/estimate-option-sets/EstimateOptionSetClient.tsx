"use client";

import { useState } from "react";
import Link from "next/link";
import type { EstimateOption, EstimateOptionSet } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import {
  useAddEstimateOption,
  useEstimateOptionSet,
  useRemoveEstimateOption,
  useSendOptionSet,
  useUpdateOptionSet
} from "@/src/hooks/estimate-option-sets.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { getEstimateStatusTone } from "../estimates/estimates.utils";
import {
  canAddOption,
  canManageOptionSets,
  canRemoveOption,
  describeOptionSetError,
  isDraftSet,
  newIdempotencyKey,
  setStatusLabel,
  sortOptions,
  suggestedTierLabel,
  type OptionSetErrorView
} from "./estimate-option-sets.utils";

// Figma 10:604 "Operator / 05 Estimate builder" button styles (same as the builder header).
const secondaryButton =
  "inline-flex items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2 text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50";
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

  return (
    <PageLayout
      title={set.title ?? "Estimate options"}
      subtitle="Good / Better / Best options the customer picks from. Each option is its own estimate."
      actions={(
        <div className="flex flex-wrap items-center gap-2">
          <Link href={options[0] ? `/estimates/${options[0].estimateId}` : "/estimates"} className="text-sm font-semibold text-brand-accent">
            ← Back to estimate
          </Link>
          <StatBadge label={setStatusLabel(set.status)} tone={set.status === "mixed" ? "gray" : getEstimateStatusTone(set.status)} />
          {draft ? (
            <button
              type="button"
              className={primaryButton}
              disabled={pending}
              onClick={() => void run(() => send.mutateAsync(versioned()), "Sent. The customer gets one email and picks one option.")}
            >
              Send options
            </button>
          ) : null}
        </div>
      )}
    >
      <div className="space-y-6">
        {!draft ? (
          <p data-testid="option-set-locked" className="surface-card px-6 py-4 text-sm text-neutral-600">
            These options were sent, so they can no longer be changed. The customer approves one option from their link.
          </p>
        ) : null}

        {error ? (
          <div role="alert" data-testid="option-set-error" className="surface-card flex flex-wrap items-center justify-between gap-3 border-error/30 px-6 py-4 text-sm text-error">
            <span>{error.message}</span>
            {error.reload ? (
              <button type="button" className={secondaryButton} onClick={() => void reload()}>
                Reload
              </button>
            ) : null}
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="surface-card px-6 py-4 text-sm text-neutral-700">
            {notice}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3" data-testid="option-set-options">
          {options.map((option) => (
            <OptionCard
              key={option.estimateId}
              option={option}
              draft={draft}
              pending={pending}
              canRemove={canRemoveOption(set)}
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

        {draft ? (
          canAddOption(set) ? (
            adding ? (
              <AddOptionForm
                defaultLabel={suggestedTierLabel(options)}
                pending={pending}
                onCancel={() => setAdding(false)}
                onSubmit={async (option) => {
                  const ok = await run(() => add.mutateAsync({ ...versioned(), option }), `${option.tierLabel} added.`);
                  if (ok) setAdding(false);
                }}
              />
            ) : (
              <button type="button" className={secondaryButton} disabled={pending} onClick={() => setAdding(true)}>
                Add option
              </button>
            )
          ) : (
            <p data-testid="option-set-at-limit" className="text-sm text-neutral-500">
              This estimate already shows the maximum of 3 options.
            </p>
          )
        ) : null}
      </div>
    </PageLayout>
  );
}

function OptionCard({
  option,
  draft,
  pending,
  canRemove,
  onRecommend,
  onRemove
}: {
  option: EstimateOption;
  draft: boolean;
  pending: boolean;
  canRemove: boolean;
  onRecommend: () => void;
  onRemove: () => void;
}) {
  return (
    <article data-testid={`option-${option.estimateId}`} className="surface-card flex flex-col gap-3 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{option.tierLabel ?? "Option"}</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">{option.title ?? option.estimateNumber}</h3>
          <p className="text-xs text-neutral-500">{option.estimateNumber}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {option.recommended ? <StatBadge label="Recommended" tone="purple" className="px-3 py-1.5 text-xs" /> : null}
          {option.isSelectedTier ? <StatBadge label="Customer picked" tone="green" className="px-3 py-1.5 text-xs" /> : null}
        </div>
      </div>
      <CurrencyDisplay value={option.total} className="text-2xl font-semibold tracking-tight text-neutral-900" showCents />
      <ul className="space-y-1 text-sm text-neutral-600">
        {option.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span>{item.name}</span>
            <span className="shrink-0 text-neutral-500">× {item.quantity}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Link href={`/estimates/${option.estimateId}`} className={secondaryButton}>
          Edit items
        </Link>
        {draft ? (
          <>
            <button type="button" className={secondaryButton} disabled={pending} onClick={onRecommend}>
              {option.recommended ? "Remove recommendation" : "Mark recommended"}
            </button>
            {canRemove ? (
              <button type="button" className={secondaryButton} disabled={pending} onClick={onRemove}>
                Remove
              </button>
            ) : null}
          </>
        ) : null}
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
