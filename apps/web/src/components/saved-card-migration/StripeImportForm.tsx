"use client";

import { useState } from "react";

import { useConfirmStripeImport } from "@/src/hooks/saved-card-migration.hooks";

import { SAVED_CARD_IMPORT_FAILED } from "./saved-card-consent.copy";
import { parseStripeImportCsv, type StripeImportRowError } from "./stripe-import-rows";

export function StripeImportForm({ bundleId, defaultReference }: { bundleId: string; defaultReference?: string | null }) {
  const confirm = useConfirmStripeImport(bundleId);
  const [reference, setReference] = useState(defaultReference ?? "");
  const [csv, setCsv] = useState("");
  const [rowErrors, setRowErrors] = useState<StripeImportRowError[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setCsv(await file.text());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    const parsed = parseStripeImportCsv(csv);
    setRowErrors(parsed.errors);
    if (!reference.trim()) {
      setError("Enter the Stripe import reference.");
      return;
    }
    if (parsed.errors.length > 0 || parsed.rows.length === 0) return;
    try {
      await confirm.mutateAsync({ stripeImportReference: reference.trim(), importedPaymentMethods: parsed.rows });
      setSaved(parsed.rows.length);
      setCsv("");
    } catch {
      setError(SAVED_CARD_IMPORT_FAILED);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3" aria-label="Stripe import result">
      <p className="text-sm text-neutral-700">
        Add the Stripe import result (customer and payment method ids only, Stripe test mode).
      </p>
      <label className="block text-sm text-neutral-700">
        Stripe import reference
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          maxLength={255}
          className="mt-1 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm text-neutral-700">
        Import result CSV
        <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0])} className="mt-1 block text-sm" />
      </label>
      <textarea
        aria-label="Import result rows"
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        rows={4}
        placeholder="stripeCustomerId,stripePaymentMethodId,renvaniCustomerId,email"
        className="block w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
      />
      {rowErrors.length > 0 ? (
        <ul role="alert" aria-label="Row errors" className="space-y-1 text-sm text-red-600">
          {rowErrors.map((rowError) => (
            <li key={`${rowError.line}-${rowError.message}`}>
              {rowError.line > 0 ? `Row ${rowError.line}: ` : ""}
              {rowError.message}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {saved !== null ? (
        <p role="status" className="text-sm text-neutral-600">
          {saved} card{saved === 1 ? "" : "s"} added for review.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={confirm.isPending || csv.trim().length === 0}
        className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-40"
      >
        {confirm.isPending ? "Saving…" : "Save import result"}
      </button>
    </form>
  );
}
