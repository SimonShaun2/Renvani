"use client";

import type { ImportSessionReconciliationReport } from "@fsm/types";

interface ImportReconciliationSummaryProps {
  report: ImportSessionReconciliationReport;
  skippedRowsDownloadUrl: string | null;
}

export function ImportReconciliationSummary({
  report,
  skippedRowsDownloadUrl
}: ImportReconciliationSummaryProps) {
  return (
    <div className="mt-6 rounded-[24px] border border-neutral-200 bg-neutral-50 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Reconciliation report</p>
          <p className="mt-1 text-sm text-neutral-500">
            Source rows compared with what was committed or skipped for this file.
          </p>
        </div>
        {skippedRowsDownloadUrl ? (
          <a
            href={skippedRowsDownloadUrl}
            className="inline-flex min-h-10 items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300"
          >
            Download skipped rows CSV
          </a>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[18px] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Source rows</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{report.sourceRowCount}</p>
        </div>
        <div className="rounded-[18px] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Committed</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{report.committedRowCount}</p>
        </div>
        <div className="rounded-[18px] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Skipped</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{report.skippedRowCount}</p>
        </div>
      </div>

      {report.reasonSummaries.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
          {report.reasonSummaries.map((reason) => (
            <li key={reason.code} className="rounded-[14px] bg-white px-3 py-2">
              <span className="font-semibold text-neutral-900">{reason.count}</span>{" "}
              {reason.label.toLowerCase()}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
