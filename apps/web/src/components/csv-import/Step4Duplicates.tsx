"use client";

import { CopyCheck, SearchCheck, Users } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import type { DuplicateAction, DuplicateMatchRecord } from "@/src/stores/csv-import.store";

interface Step4DuplicatesProps {
  duplicateMatches: DuplicateMatchRecord[];
  isLoading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onBulkSkip: () => void;
  onUpdateAction: (rowNumber: number, action: DuplicateAction) => void;
}

function formatMatchReason(matchReason: DuplicateMatchRecord["matchReason"]) {
  switch (matchReason) {
    case "email":
      return "Matched on email";
    case "phone":
      return "Matched on phone";
    default:
      return "Matched on name";
  }
}

export function Step4Duplicates({
  duplicateMatches,
  isLoading,
  onBack,
  onContinue,
  onBulkSkip,
  onUpdateAction
}: Step4DuplicatesProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 4</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-900">Review duplicate matches</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              We compare the file against customers already in your account so you can decide which rows
              to skip, update, or import as new.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-accent">
            <SearchCheck className="h-3.5 w-3.5" />
            {isLoading ? "Checking duplicates..." : `${duplicateMatches.length} duplicate matches`}
          </div>
        </div>

        {duplicateMatches.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={isLoading ? "Scanning for duplicates" : "No duplicates detected"}
              subtitle={
                isLoading
                  ? "We are finishing the duplicate scan across your current customers."
                  : "Every row in this file looks unique, so you can continue to import."
              }
              icon={Users}
              compact
            />
          </div>
        ) : (
          <>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onBulkSkip}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
              >
                <CopyCheck className="h-4 w-4" />
                Select all: Skip duplicates
              </button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-[24px] border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.14em] text-neutral-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">CSV row</th>
                    <th className="px-4 py-3 font-semibold">Matched customer</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {duplicateMatches.map((match) => (
                    <tr key={match.rowNumber}>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-neutral-900">{match.rowLabel}</div>
                        <div className="mt-1 text-xs text-neutral-400">Row {match.rowNumber}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-neutral-900">{match.matchedCustomerName}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {[match.matchedCustomerEmail, match.matchedCustomerPhone].filter(Boolean).join(" • ") || "No stored contact"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-neutral-500">{formatMatchReason(match.matchReason)}</td>
                      <td className="px-4 py-4">
                        <select
                          value={match.action}
                          onChange={(event) =>
                            onUpdateAction(match.rowNumber, event.target.value as DuplicateAction)
                          }
                          className="min-h-11 w-full rounded-[18px] border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
                        >
                          <option value="skip">Skip</option>
                          <option value="update_existing">Update existing</option>
                          <option value="import_new">Import as new</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

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
            className="inline-flex min-h-11 items-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary"
          >
            Continue to confirmation
          </button>
        </div>
      </section>

      <aside className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Recommended default</p>
        <p className="mt-4 text-sm leading-6 text-neutral-500">
          Skip is the safest action when a customer is already in Renvani. Use update existing when
          the file fills in missing details, and import as new only when the match is a false positive.
        </p>
      </aside>
    </div>
  );
}
