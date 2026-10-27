"use client";

import { useState } from "react";
import { SAVED_CARD_MIGRATION_APPLY_MAX_ROWS, type ApplySavedCardMigrationMappingsBody, type SavedCardMigration } from "@fsm/types";

import "./saved-card-consent-motion.css";
import { useApplySavedCardMappings, useSavedCardMigration } from "@/src/hooks/saved-card-migration.hooks";
import { ApiError } from "@/src/lib/api";
import { useAuthStore } from "@/src/stores/auth.store";
import { getStoredSession } from "@/src/lib/auth";

import {
  SAVED_CARD_CONSENT_CHECKBOX_LABEL,
  SAVED_CARD_CONSENT_DRAFT_MARKER,
  SAVED_CARD_CONSENT_VERSION_MISMATCH,
  isDraftConsent
} from "./saved-card-consent.copy";

export function buildApplyRows(migration: SavedCardMigration): ApplySavedCardMigrationMappingsBody["rows"] {
  return migration.customerMappings
    .filter((mapping) => mapping.status === "pending" && mapping.matchMethod !== "unmatched")
    .slice(0, SAVED_CARD_MIGRATION_APPLY_MAX_ROWS)
    .map((mapping) => ({
      stripeCustomerId: mapping.stripeCustomerId,
      stripePaymentMethodId: mapping.stripePaymentMethodId,
      ...(mapping.renvaniCustomerId ? { renvaniCustomerId: mapping.renvaniCustomerId } : {}),
      ...(mapping.email ? { email: mapping.email } : {})
    }));
}

function isVersionMismatch(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && /consent version/i.test(error.message);
}

export function SavedCardConsentPanel({ bundleId }: { bundleId: string }) {
  const authUser = useAuthStore((state) => state.user);
  const role = authUser?.role ?? getStoredSession()?.role ?? null;
  const allowed = role === "owner" || role === "admin";
  const query = useSavedCardMigration(bundleId, allowed);
  const apply = useApplySavedCardMappings(bundleId);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allowed) {
    return null;
  }
  if (query.isLoading) {
    return <p className="text-sm text-neutral-500">Loading saved-card migration…</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-neutral-500" role="status">
        Saved-card migration isn&apos;t available for this import yet.
      </p>
    );
  }
  const data = query.data;
  if (!data?.migration) {
    return null;
  }
  const { migration, consent } = data;
  const rows = buildApplyRows(migration);
  const summary = migration.mappingSummary;

  async function handleApply() {
    setError(null);
    try {
      await apply.mutateAsync({
        ownerOffSessionConsentAcknowledged: true,
        ownerOffSessionConsentVersion: consent.version,
        rows
      });
      setAcknowledged(false);
    } catch (caught) {
      setError(
        isVersionMismatch(caught)
          ? SAVED_CARD_CONSENT_VERSION_MISMATCH
          : caught instanceof Error
            ? caught.message
            : "Mappings could not be applied."
      );
    }
  }

  return (
    <section data-saved-card-consent-reveal className="surface-card space-y-4 px-5 py-5" aria-labelledby="saved-card-consent-title">
      <div>
        <p id="saved-card-consent-title" className="text-sm font-semibold text-neutral-900">
          Saved cards from {migration.priorProcessorName}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {summary.matched} matched · {summary.unmatched} unmatched · {summary.failed} failed of {summary.total}
        </p>
      </div>

      <div className="rounded-[20px] border border-neutral-200 bg-neutral-50 px-4 py-4">
        {isDraftConsent(consent) ? (
          <p className="mb-2 inline-block rounded-full bg-warning-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning">
            {SAVED_CARD_CONSENT_DRAFT_MARKER}
          </p>
        ) : null}
        <p data-testid="saved-card-consent-text" className="whitespace-pre-line text-sm leading-6 text-neutral-700">
          {consent.text}
        </p>
        <p className="mt-2 font-mono text-[11px] text-neutral-400">Version {consent.version}</p>
      </div>

      <label className="flex items-start gap-3 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-1"
        />
        <span>{SAVED_CARD_CONSENT_CHECKBOX_LABEL}</span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!acknowledged || rows.length === 0 || apply.isPending}
        onClick={() => void handleApply()}
        className="rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {apply.isPending ? "Applying…" : `Apply ${rows.length} mapping${rows.length === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
