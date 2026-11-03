"use client";

import type { ColumnMapping } from "@fsm/types";
import { Bot, Sparkles } from "lucide-react";

import {
  CSV_IMPORT_FIELD_OPTIONS,
  getMissingMappingMessage,
  getSampleValueForHeader,
  getImportFieldLabel
} from "@/src/lib/csv-import";
import type { ParsedImportRow } from "@/src/stores/csv-import.store";

interface Step2MappingProps {
  headers: string[];
  sampleRows: ParsedImportRow[];
  mappings: ColumnMapping;
  isLoadingSuggestions: boolean;
  onUpdateMapping: (header: string, fieldName: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Step2Mapping({
  headers,
  sampleRows,
  mappings,
  isLoadingSuggestions,
  onUpdateMapping,
  onBack,
  onContinue
}: Step2MappingProps) {
  const missingMappingMessage = getMissingMappingMessage(mappings);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 2</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-900">Review your column mapping</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              AI suggestions are pre-filled, but you can change any column before we preview the data.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-accent">
            <Bot className="h-3.5 w-3.5" />
            {isLoadingSuggestions ? "AI is still mapping columns..." : "AI suggestions ready"}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[24px] border border-neutral-200">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.14em] text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-semibold">CSV column</th>
                <th className="px-4 py-3 font-semibold">Sample data</th>
                <th className="px-4 py-3 font-semibold">Map to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {headers.map((header) => {
                const selectedValue = mappings[header] ?? "";
                const mappedLabel = getImportFieldLabel(selectedValue);

                return (
                  <tr key={header}>
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-neutral-900">{header}</div>
                      {selectedValue && selectedValue !== "__skip__" ? (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-accent-light px-2.5 py-1 text-[11px] font-semibold text-brand-accent">
                          <Sparkles className="h-3 w-3" />
                          AI matched to {mappedLabel}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-neutral-500">{getSampleValueForHeader(header, sampleRows)}</td>
                    <td className="px-4 py-4">
                      <select
                        value={selectedValue}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          onUpdateMapping(header, nextValue.length > 0 ? nextValue : null);
                        }}
                        className="min-h-11 w-full rounded-[18px] border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
                      >
                        <option value="">Select a field</option>
                        {CSV_IMPORT_FIELD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {missingMappingMessage ? (
          <div className="mt-4 rounded-[20px] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-dark">
            {missingMappingMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={Boolean(missingMappingMessage)}
            className="inline-flex min-h-11 items-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to preview
          </button>
        </div>
      </section>

      <aside className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">How mapping works</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-500">
          <li>The AI looks at your headers and sample rows, then suggests the best field match.</li>
          <li>You can skip any column that is not useful for onboarding.</li>
          <li>We require either a company name or a first and last name pair before continuing.</li>
        </ul>
      </aside>
    </div>
  );
}
