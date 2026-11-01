"use client";

import { useState } from "react";

import { useStartSavedCardMigration } from "@/src/hooks/saved-card-migration.hooks";

import { SAVED_CARD_START_FAILED } from "./saved-card-consent.copy";

export function StartSavedCardMigrationForm({ bundleId }: { bundleId: string }) {
  const start = useStartSavedCardMigration(bundleId);
  const [processor, setProcessor] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const priorProcessorName = processor.trim();
    if (!priorProcessorName) {
      setError("Enter the name of your previous payment processor.");
      return;
    }
    const stripeImportReference = reference.trim();
    try {
      await start.mutateAsync({ priorProcessorName, ...(stripeImportReference ? { stripeImportReference } : {}) });
    } catch {
      setError(SAVED_CARD_START_FAILED);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3" aria-label="Start saved-card migration">
      <label className="block text-sm text-neutral-700">
        Previous payment processor
        <input
          value={processor}
          onChange={(event) => setProcessor(event.target.value)}
          maxLength={120}
          className="mt-1 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm text-neutral-700">
        Stripe import reference (optional)
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          maxLength={255}
          className="mt-1 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={start.isPending}
        className="rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {start.isPending ? "Starting…" : "Start saved-card migration"}
      </button>
    </form>
  );
}
