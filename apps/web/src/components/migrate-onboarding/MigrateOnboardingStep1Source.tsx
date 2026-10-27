"use client";

import type { MigrateOnboardingSourceCatalogEntry } from "@fsm/types";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

interface MigrateOnboardingStep1SourceProps {
  sources: MigrateOnboardingSourceCatalogEntry[];
  selectedSourceId: string | null;
  isSubmitting: boolean;
  onSelectSource: (sourceId: MigrateOnboardingSourceCatalogEntry["id"]) => void;
}

function SourceCard({
  entry,
  isSelected,
  disabled,
  onSelect
}: {
  entry: MigrateOnboardingSourceCatalogEntry;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={[
        "w-full rounded-[24px] border px-5 py-4 text-left transition",
        isSelected
          ? "border-brand-accent bg-brand-accent-light/40 shadow-sm"
          : "border-neutral-200 bg-white hover:border-brand-accent/40 hover:bg-brand-accent-light/20",
        disabled ? "cursor-not-allowed opacity-60" : ""
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-neutral-900">{entry.label}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">{entry.description}</p>
          <p className="mt-3 text-xs text-neutral-400">
            Suggested files: {entry.recommendedExports.join(", ")}
          </p>
        </div>
        {isSelected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-accent" /> : null}
      </div>
    </button>
  );
}

export function MigrateOnboardingStep1Source({
  sources,
  selectedSourceId,
  isSubmitting,
  onSelectSource
}: MigrateOnboardingStep1SourceProps) {
  const [showOptional, setShowOptional] = useState(false);

  const grouped = useMemo(() => {
    const generic = sources.filter((entry) => entry.id === "manual_csv");
    const quickbooks = sources.filter((entry) => entry.importPath === "quickbooks_file_export");
    const legacy = sources.filter((entry) => entry.catalogTier === "export_tips");
    return { generic, quickbooks, legacy };
  }, [sources]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 1</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Where is your data coming from?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Start with a generic CSV upload. QuickBooks and legacy system presets are optional — you are not
          blocked on a specific vendor export.
        </p>
      </div>

      <div className="grid gap-3">
        {grouped.generic.map((entry) => (
          <SourceCard
            key={entry.id}
            entry={entry}
            isSelected={selectedSourceId === entry.id}
            disabled={isSubmitting}
            onSelect={() => onSelectSource(entry.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowOptional((value) => !value)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent"
      >
        <ChevronDown className={`h-4 w-4 transition ${showOptional ? "rotate-180" : ""}`} />
        {showOptional ? "Hide optional sources" : "Show QuickBooks & legacy presets (optional)"}
      </button>

      {showOptional ? (
        <div className="grid gap-6">
          {grouped.quickbooks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                QuickBooks (optional)
              </p>
              <div className="grid gap-3">
                {grouped.quickbooks.map((entry) => (
                  <SourceCard
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedSourceId === entry.id}
                    disabled={isSubmitting}
                    onSelect={() => onSelectSource(entry.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {grouped.legacy.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Legacy systems (optional)
              </p>
              <div className="grid gap-3">
                {grouped.legacy.map((entry) => (
                  <SourceCard
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedSourceId === entry.id}
                    disabled={isSubmitting}
                    onSelect={() => onSelectSource(entry.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
