"use client";

import type { ImportSessionChunkProgress } from "@fsm/types";
import { Clock3, DatabaseZap, LoaderCircle, ShieldCheck } from "lucide-react";

import { ImportChunkProgressPanel } from "./ImportChunkProgressPanel";

interface Step6ProgressProps {
  fileName: string | null;
  entityType: string | null;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  estimatedTimeRemaining: string | null;
  chunkProgress: ImportSessionChunkProgress | null;
  priceBookLineSeeds: number | null;
}

export function Step6Progress({
  fileName,
  entityType,
  totalRows,
  processedRows,
  importedRows,
  skippedRows,
  duplicateRows,
  estimatedTimeRemaining,
  chunkProgress,
  priceBookLineSeeds
}: Step6ProgressProps) {
  const progressPercent =
    totalRows > 0 ? Math.max(0, Math.min(100, Math.round((processedRows / totalRows) * 100))) : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-brand-accent-light text-brand-accent">
            <LoaderCircle className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 6</p>
            <h3 className="mt-2 text-xl font-semibold text-neutral-900">Importing and analyzing your data</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              We are processing <span className="font-semibold text-neutral-700">{fileName ?? "your file"}</span> now.
              Keep this tab open if you want live progress updates.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-neutral-200 bg-neutral-50/70 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {processedRows} of {totalRows || "?"} rows processed
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {estimatedTimeRemaining ?? "Preparing an estimated time remaining..."}
              </p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-accent shadow-sm">
              {progressPercent}%
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2f7cf6_0%,#6aa4ff_100%)] transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {chunkProgress && entityType ? (
          <ImportChunkProgressPanel
            entityType={entityType}
            chunkProgress={chunkProgress}
            priceBookLineSeeds={priceBookLineSeeds}
          />
        ) : null}

        {priceBookLineSeeds !== null && !chunkProgress ? (
          <div className="mt-6 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700">
            <span className="font-semibold">{priceBookLineSeeds}</span> price-book line seeds loaded —
            invoice lines from history imports will resolve against this catalog.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Imported</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{importedRows}</p>
          </div>
          <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Skipped</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{skippedRows}</p>
          </div>
          <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Duplicates detected</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-900">{duplicateRows}</p>
          </div>
        </div>
      </section>

      <aside className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Current stages</p>
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3 rounded-[20px] bg-neutral-50 px-4 py-4">
            <DatabaseZap className="mt-0.5 h-4 w-4 text-brand-accent" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Importing rows</p>
              <p className="mt-1 text-sm text-neutral-500">Customers are written in batches of 100.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[20px] bg-neutral-50 px-4 py-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Tracking skipped rows</p>
              <p className="mt-1 text-sm text-neutral-500">Any invalid records will be saved into the error report.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[20px] bg-neutral-50 px-4 py-4">
            <Clock3 className="mt-0.5 h-4 w-4 text-warning-dark" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Do not close this page</p>
              <p className="mt-1 text-sm text-neutral-500">Leaving now will not stop the worker, but you will lose the live progress screen.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
