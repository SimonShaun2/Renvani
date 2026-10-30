"use client";

import { Eye, Table2 } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import type { ImportPreviewRow } from "@/src/stores/csv-import.store";

interface Step3PreviewProps {
  previewRows: ImportPreviewRow[];
  onBack: () => void;
  onContinue: () => void;
  isLoadingValidation: boolean;
}

export function Step3Preview({
  previewRows,
  onBack,
  onContinue,
  isLoadingValidation
}: Step3PreviewProps) {
  const columns = Object.keys(previewRows[0]?.mappedValues ?? {});

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 3</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-900">Preview the first five rows</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              This is how the mapped data will look when it lands in ServiceRev. Double-check the names,
              contacts, and addresses before we look for duplicates.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
            <Eye className="h-3.5 w-3.5" />
            {isLoadingValidation ? "Validation in progress" : "Preview ready"}
          </div>
        </div>

        {previewRows.length === 0 || columns.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No preview rows yet"
              subtitle="Finish mapping the file first, then we will show the imported customer rows here."
              icon={Table2}
              compact
            />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-[24px] border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.14em] text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Row</th>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {previewRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-4 py-4 font-medium text-neutral-900">{row.rowNumber}</td>
                    {columns.map((column) => (
                      <td key={`${row.rowNumber}-${column}`} className="px-4 py-4 text-neutral-600">
                        {row.mappedValues[column] || "Empty"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            Go back and fix
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex min-h-11 items-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary"
          >
            Looks good
          </button>
        </div>
      </section>

      <aside className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Next up</p>
        <p className="mt-4 text-sm leading-6 text-neutral-500">
          In the next step we scan the file against your existing customer list and show any rows that
          look like duplicates by email, phone, or name.
        </p>
      </aside>
    </div>
  );
}
