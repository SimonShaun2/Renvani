"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import {
  useQboCatalog,
  useQboMappingBoard,
  useQboSyncStatus,
  useRetryQboSyncIssue,
  useSaveQboMappings
} from "@/src/hooks/qbo-sync.hooks";
import type { QboEntityMappingV1, QboMappingKind } from "@fsm/types";
import { showToast } from "@/src/stores/toast.store";
import { ApiError } from "@/src/lib/api";

const SECTIONS: Array<{ kind: QboMappingKind; title: string }> = [
  { kind: "price_book_item", title: "Price book items" },
  { kind: "tax_code", title: "Tax codes" },
  { kind: "payment_method", title: "Payment methods" }
];

function connectionLabel(phase: string) {
  if (phase === "connected_sandbox") {
    return "Connected (sandbox)";
  }

  if (phase === "connected_production") {
    return "Connected";
  }

  return "Not connected";
}

export default function SettingsQuickBooksPage() {
  const statusQuery = useQboSyncStatus();
  const boardQuery = useQboMappingBoard();
  const saveMappings = useSaveQboMappings();
  const retryIssue = useRetryQboSyncIssue();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const catalogKind = "price_book_item";
  const catalogQuery = useQboCatalog(catalogKind, statusQuery.data?.connection.phase === "connected_sandbox");

  const mappingsByKind = useMemo(() => {
    const map = new Map<QboMappingKind, QboEntityMappingV1[]>();

    for (const section of SECTIONS) {
      map.set(section.kind, []);
    }

    for (const row of boardQuery.data?.mappings ?? []) {
      map.get(row.kind)?.push(row);
    }

    return map;
  }, [boardQuery.data?.mappings]);

  function mappingKey(row: QboEntityMappingV1) {
    return `${row.kind}:${row.localKey}`;
  }

  function resolveQboId(row: QboEntityMappingV1) {
    const key = mappingKey(row);
    if (draft[key] !== undefined) {
      return draft[key];
    }

    return row.qbo?.qboId ?? "";
  }

  async function handleSave() {
    if (!boardQuery.data) {
      return;
    }

    const updates = boardQuery.data.mappings
      .map((row) => {
        const key = mappingKey(row);
        const nextId = draft[key];

        if (nextId === undefined) {
          return null;
        }

        const trimmed = nextId.trim();

        if (!trimmed) {
          return { kind: row.kind, localKey: row.localKey, qbo: null };
        }

        const catalogName =
          catalogQuery.data?.items.find((item) => item.qboId === trimmed)?.name ??
          row.qbo?.qboName ??
          trimmed;

        return {
          kind: row.kind,
          localKey: row.localKey,
          qbo: { qboId: trimmed, qboName: catalogName }
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (updates.length === 0) {
      showToast({ tone: "info", title: "No mapping changes", description: "Edit a QBO item id before saving." });
      return;
    }

    try {
      await saveMappings.mutateAsync({ mappings: updates });
      setDraft({});
      showToast({ tone: "success", title: "Mappings saved", description: "Sync engine will pick up the new map." });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Save failed",
        description: error instanceof ApiError ? error.message : "Could not save QuickBooks mappings."
      });
    }
  }

  if (statusQuery.isLoading || boardQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[120px]" />
        <SkeletonCard className="h-[360px]" />
      </div>
    );
  }

  if (statusQuery.isError || boardQuery.isError || !statusQuery.data || !boardQuery.data) {
    return (
      <PageLayout title="QuickBooks Online" subtitle="Sandbox-only ongoing sync between field and office.">
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">QuickBooks sync unavailable</h2>
          <p className="mt-3 text-sm text-neutral-500">Refresh to load connection and mapping status.</p>
        </section>
      </PageLayout>
    );
  }

  const status = statusQuery.data;

  return (
    <PageLayout
      title="QuickBooks Online"
      subtitle="Map catalog, tax, and payment fields for sandbox sync — production stays gated until founder approval."
      actions={
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={saveMappings.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-accent/90 disabled:opacity-60"
        >
          {saveMappings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save mappings
        </button>
      }
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <StatBadge label={connectionLabel(status.connection.phase)} tone={status.connection.phase === "connected_sandbox" ? "green" : "orange"} />
            <StatBadge label={`Sync: ${status.sync.status}`} tone={status.sync.status === "error" ? "red" : "blue"} />
            <StatBadge label="Sandbox only" tone="purple" />
            <StatBadge
              label={`${status.sync.mappedCounts.priceBookItem + status.sync.mappedCounts.taxCode + status.sync.mappedCounts.paymentMethod} mapped`}
              tone="neutral"
            />
          </div>
          <p className="mt-4 text-sm text-neutral-600">
            {status.connection.realmId
              ? `Realm ${status.connection.realmId} · last success ${status.sync.lastSuccessfulAt ?? "—"}`
              : "OAuth connection is owned by the sync engine — connect in onboarding when Kai’s PR lands."}
          </p>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.kind} className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-950">{section.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">Choose the QuickBooks sandbox item that matches each Renvani field.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-500">
                    <th className="py-2 pr-4 font-medium">Renvani</th>
                    <th className="py-2 font-medium">QBO item id</th>
                  </tr>
                </thead>
                <tbody>
                  {(mappingsByKind.get(section.kind) ?? []).map((row) => (
                    <tr key={mappingKey(row)} className="border-b border-neutral-50">
                      <td className="py-3 pr-4 font-medium text-neutral-900">{row.localLabel}</td>
                      <td className="py-3">
                        <input
                          className="w-full max-w-md rounded-xl border border-neutral-200 px-3 py-2 text-neutral-900"
                          value={resolveQboId(row)}
                          placeholder="Sandbox QBO id"
                          onChange={(event) => {
                            setDraft((current) => ({
                              ...current,
                              [mappingKey(row)]: event.target.value
                            }));
                          }}
                          list={section.kind === "price_book_item" ? "qbo-catalog-items" : undefined}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {catalogQuery.data && catalogQuery.data.items.length > 0 ? (
          <datalist id="qbo-catalog-items">
            {catalogQuery.data.items.map((item) => (
              <option key={item.qboId} value={item.qboId}>{item.name}</option>
            ))}
          </datalist>
        ) : null}

        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">Recent sync issues</h2>
          {status.recentIssues.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No open issues — retries enqueue operator-queue jobs and Sentry alerts fire on retry.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {status.recentIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{issue.code}</p>
                    <p className="text-sm text-neutral-600">{issue.message}</p>
                  </div>
                  <button
                    type="button"
                    disabled={retryIssue.isPending}
                    onClick={() => {
                      void retryIssue.mutateAsync(issue.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
