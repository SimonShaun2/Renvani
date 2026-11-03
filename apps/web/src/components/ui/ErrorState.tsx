"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  title: string;
  subtitle?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}

/** Load-failure state with a Retry (refetch) button. Distinct from EmptyState so failures never read as "no data". */
export function ErrorState({
  title,
  subtitle = "Something went wrong while loading. Check your connection and try again.",
  onRetry,
  isRetrying = false,
  compact = false
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={[
        "flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/70 text-center",
        compact ? "px-5 py-8" : "px-6 py-12"
      ].join(" ")}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600">{subtitle}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
