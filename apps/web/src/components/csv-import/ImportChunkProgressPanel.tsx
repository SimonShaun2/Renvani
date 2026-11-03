"use client";

import type { ImportSessionChunkProgress } from "@fsm/types";

interface ImportChunkProgressPanelProps {
  entityType: string;
  chunkProgress: ImportSessionChunkProgress;
  priceBookLineSeeds: number | null;
}

export function ImportChunkProgressPanel({
  entityType,
  chunkProgress,
  priceBookLineSeeds
}: ImportChunkProgressPanelProps) {
  const chunkPercent =
    chunkProgress.chunksTotal > 0
      ? Math.round((chunkProgress.chunksDone / chunkProgress.chunksTotal) * 100)
      : 0;

  const historyLabel = entityType === "estimates" ? "estimate history" : "job history";

  return (
    <div className="mt-6 space-y-4 rounded-[28px] border border-brand-accent/20 bg-brand-accent-light/40 px-5 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
          Chunked {historyLabel}
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          Large history files commit in worker chunks. Progress below reflects committed chunks, not
          spreadsheet preview rows.
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-neutral-900">
            Chunk {chunkProgress.chunksDone} of {chunkProgress.chunksTotal}
          </span>
          <span className="font-semibold text-brand-accent">{chunkPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
          <div
            className="h-full rounded-full bg-brand-accent transition-[width] duration-500"
            style={{ width: `${chunkPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white px-4 py-3 text-sm">
          <p className="text-neutral-500">Rows committed</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{chunkProgress.rowsOk}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm">
          <p className="text-neutral-500">Row errors</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{chunkProgress.rowsFailed}</p>
        </div>
      </div>

      {priceBookLineSeeds !== null ? (
        <p className="text-sm text-neutral-700">
          <span className="font-semibold">{priceBookLineSeeds}</span> price-book line seeds are on
          file for invoice line matching during history commit.
        </p>
      ) : null}
    </div>
  );
}
