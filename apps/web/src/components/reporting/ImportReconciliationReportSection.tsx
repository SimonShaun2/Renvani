"use client";

import { useState } from "react";

import { ImportReconciliationSummary } from "@/src/components/csv-import/ImportReconciliationSummary";
import { useImportReconciliation, useImportSessions } from "@/src/hooks/imports.hooks";
import { formatDate } from "@/src/lib/utils";

export function ImportReconciliationReportSection() {
  const sessionsQuery = useImportSessions(20);
  const sessions = sessionsQuery.data?.data ?? [];
  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = selectedId || sessions[0]?.id || null;
  const reconciliationQuery = useImportReconciliation(activeId, Boolean(activeId));

  return (
    <section className="surface-card space-y-5 px-5 py-5" aria-labelledby="import-reconciliation-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p id="import-reconciliation-heading" className="text-sm font-semibold text-neutral-900">
            Import reconciliation
          </p>
          <p className="mt-1 text-sm text-neutral-500">What came across from each data import, and what was skipped.</p>
        </div>
        {sessions.length > 0 ? (
          <label className="flex items-center gap-3 text-sm text-neutral-600">
            <span>Import</span>
            <select
              aria-label="Import"
              value={activeId ?? ""}
              onChange={(event) => setSelectedId(event.target.value)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-700"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.fileName} · {formatDate(session.createdAt)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {sessionsQuery.isLoading ? (
        <p className="text-sm text-neutral-500">Loading imports…</p>
      ) : sessionsQuery.isError ? (
        <p className="text-sm text-red-600">Unable to load imports.</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-neutral-500">No imports yet. Reconciliation appears here after your first data import.</p>
      ) : reconciliationQuery.isLoading ? (
        <p className="text-sm text-neutral-500">Loading reconciliation…</p>
      ) : reconciliationQuery.isError || !reconciliationQuery.data?.report ? (
        <p className="text-sm text-neutral-500">No reconciliation report for this import yet.</p>
      ) : (
        <ImportReconciliationSummary
          report={reconciliationQuery.data.report}
          skippedRowsDownloadUrl={reconciliationQuery.data.skippedRowsDownloadUrl ?? null}
        />
      )}
    </section>
  );
}
