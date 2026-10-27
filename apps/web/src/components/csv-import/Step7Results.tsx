"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, RotateCcw, SkipForward } from "lucide-react";

import type { ImportSessionReconciliationReport } from "@fsm/types";

import { ImportReconciliationSummary } from "@/src/components/csv-import/ImportReconciliationSummary";
import type { ImportErrorRecord } from "@/src/hooks/imports.hooks";
import type { ImportResults } from "@/src/stores/csv-import.store";

interface Step7ResultsProps {
  results: ImportResults;
  errorRecords: ImportErrorRecord[];
  reconciliationReport: ImportSessionReconciliationReport | null;
  skippedRowsDownloadUrl: string | null;
  onDownloadErrorReport: () => void;
  onImportAnother: () => void;
}

export function Step7Results({
  results,
  errorRecords,
  reconciliationReport,
  skippedRowsDownloadUrl,
  onDownloadErrorReport,
  onImportAnother
}: Step7ResultsProps) {
  const statusTitle =
    results.status === "completed" ? "Import complete" : "Import finished with errors";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className={[
              "flex h-14 w-14 items-center justify-center rounded-[22px]",
              results.status === "completed"
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning-dark"
            ].join(" ")}
          >
            {results.status === "completed" ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 7</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-900">{statusTitle}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Imported rows are now in Renvani. Nothing was sent to customers. Fix flagged rows below or import another file.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-success/20 bg-success/10 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">Imported</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{results.importedRows}</p>
          </div>
          <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Skipped</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{results.skippedRows}</p>
          </div>
          <div className="rounded-[24px] border border-warning/20 bg-warning/10 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning-dark">Errors</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{results.errorRows}</p>
          </div>
          <div className="rounded-[24px] border border-brand-accent/15 bg-brand-panel px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">Duplicates</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{results.duplicateRows}</p>
          </div>
        </div>

        {reconciliationReport ? (
          <ImportReconciliationSummary
            report={reconciliationReport}
            skippedRowsDownloadUrl={skippedRowsDownloadUrl}
          />
        ) : null}

        {errorRecords.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Rows that failed</p>
                <p className="mt-1 text-sm text-neutral-500">Download the error report and fix these rows before re-importing them.</p>
              </div>
              <button
                type="button"
                onClick={onDownloadErrorReport}
                className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
              >
                Download Error Report
              </button>
            </div>
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-[0.14em] text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Row</th>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {errorRecords.slice(0, 10).map((errorRecord) => (
                  <tr key={`${errorRecord.row}-${errorRecord.field}-${errorRecord.message}`}>
                    <td className="px-4 py-4 font-medium text-neutral-900">{errorRecord.row}</td>
                    <td className="px-4 py-4 text-neutral-600">{errorRecord.field}</td>
                    <td className="px-4 py-4 text-neutral-600">{errorRecord.message}</td>
                    <td className="px-4 py-4 text-neutral-500">{errorRecord.value || "Empty"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onImportAnother}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 px-5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
          >
            <RotateCcw className="h-4 w-4" />
            Import Another File
          </button>
          <Link
            href="/customers"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary"
          >
            <SkipForward className="h-4 w-4" />
            Go to Customers
          </Link>
        </div>
      </section>

      <aside className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Import summary</p>
        <dl className="mt-4 space-y-4 text-sm">
          <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
            <dt className="text-neutral-500">Completed at</dt>
            <dd className="mt-1 font-semibold text-neutral-900">
              {results.completedAt ? new Date(results.completedAt).toLocaleString() : "Still processing"}
            </dd>
          </div>
          <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
            <dt className="text-neutral-500">Total rows</dt>
            <dd className="mt-1 font-semibold text-neutral-900">{results.totalRows}</dd>
          </div>
          {results.errorMessage ? (
            <div className="rounded-[22px] border border-warning/30 bg-warning/10 px-4 py-4 text-warning-dark">
              <dt className="font-semibold">Worker message</dt>
              <dd className="mt-1">{results.errorMessage}</dd>
            </div>
          ) : null}
        </dl>
      </aside>

      <div className="xl:col-span-2 rounded-[14px] bg-[#e4f1e8] px-4 py-4 text-sm font-medium text-[#2f7d4f]">
        Consent from your old records was kept as-is. Imported customers get no marketing until they opt in.
      </div>
    </div>
  );
}
