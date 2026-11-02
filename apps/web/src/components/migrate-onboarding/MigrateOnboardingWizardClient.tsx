"use client";

import { useEffect, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import type { ImportDuplicateAction, MigrateOnboardingWizardStep } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { ApiError } from "@/src/lib/api";
import { toPlainLanguageImportIssue } from "@/src/lib/migrate-onboarding-plain-language";
import { formatHistoryDepthSummary } from "@/src/lib/migrate-relational-preview-summary";
import {
  useAcknowledgeMigratePreview,
  useApplyMigrateDedupeDecisions,
  useCommitMigrateBundle,
  useConfirmMigrateMappings,
  useMigrateDedupePreview,
  useMigrateOnboardingBundle,
  useMigrateRelationalPreview,
  useResumeMigrateOnboardingSession
} from "@/src/hooks/migrate-onboarding.hooks";
import { useImportErrors } from "@/src/hooks/imports.hooks";
import { useMigrateOnboardingWizardStore } from "@/src/stores/migrate-onboarding-wizard.store";
import { showToast } from "@/src/stores/toast.store";

import { SavedCardConsentPanel } from "@/src/components/saved-card-migration/SavedCardConsentPanel";

import { MigrateAiIssuesPanel } from "./MigrateAiIssuesPanel";
import { MigrateOnboardingStepsOneTwo } from "./MigrateOnboardingStepsOneTwo";

const WIZARD_STEPS: { id: MigrateOnboardingWizardStep; label: string }[] = [
  { id: 1, label: "Source" },
  { id: 2, label: "Upload" },
  { id: 3, label: "Mappings" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Commit" }
];

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

export function MigrateOnboardingWizardClient() {
  const { bundleId, setBundle } = useMigrateOnboardingWizardStore();
  const resumeQuery = useResumeMigrateOnboardingSession();
  const bundleQuery = useMigrateOnboardingBundle(bundleId);
  const bundle = bundleQuery.data ?? resumeQuery.data ?? null;
  const activeStep = bundle?.wizardStep ?? 1;
  const resolvedBundleId = bundle?.id ?? null;

  useEffect(() => {
    if (bundle) {
      setBundle(bundle.id, bundle.wizardStep);
    }
  }, [bundle, setBundle]);

  const confirmMappings = useConfirmMigrateMappings(resolvedBundleId);
  const acknowledgePreview = useAcknowledgeMigratePreview(resolvedBundleId);
  const commitBundle = useCommitMigrateBundle(resolvedBundleId);
  const applyDedupe = useApplyMigrateDedupeDecisions(resolvedBundleId);

  const relationalPreview = useMigrateRelationalPreview(resolvedBundleId, activeStep >= 4);
  const dedupePreview = useMigrateDedupePreview(resolvedBundleId, activeStep >= 4);

  const firstSessionId = bundle?.stepState.files[0]?.importSessionId ?? null;
  const importErrors = useImportErrors(firstSessionId, activeStep === 3 && Boolean(firstSessionId));

  const plainIssues = useMemo(
    () => (importErrors.data?.errors ?? []).map(toPlainLanguageImportIssue),
    [importErrors.data?.errors]
  );

  const refresh = () => {
    void resumeQuery.refetch();
    void bundleQuery.refetch();
  };

  if (resumeQuery.isLoading) {
    return (
      <PageLayout title="Migration wizard" subtitle="Resuming your session…">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Migration wizard"
      subtitle="Import multi-year history with relational preview, dedupe controls, and resumable commit."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-2 text-sm">
          {WIZARD_STEPS.map((step) => (
            <li
              key={step.id}
              className={`rounded-full px-3 py-1 ${
                step.id === activeStep ? "bg-brand-primary text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {step.id}. {step.label}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
          onClick={refresh}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh session
        </button>
      </div>

      {bundle && bundle.id ? (
        <p className="mb-4 font-mono text-xs text-neutral-500">Bundle {bundle.id} · step {bundle.wizardStep}</p>
      ) : null}

      {activeStep < 3 ? <MigrateOnboardingStepsOneTwo bundle={bundle} onRefresh={refresh} /> : null}

      {activeStep === 3 && bundle ? (
        <div className="space-y-4">
          <MigrateAiIssuesPanel issues={plainIssues} isLoading={importErrors.isLoading} />
          <ul className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
            {bundle.stepState.files.map((file) => (
              <li key={file.importSessionId} className="py-1">
                {file.fileName} ({file.entityType})
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={confirmMappings.isPending}
            onClick={() =>
              confirmMappings.mutate(undefined, {
                onSuccess: () => showToast({ tone: "success", title: "Mappings confirmed" }),
                onError: (error) =>
                  showToast({ tone: "error", title: "Could not confirm", description: formatError(error) })
              })
            }
          >
            Confirm mappings &amp; continue
          </button>
        </div>
      ) : null}

      {activeStep === 4 && bundle ? (
        <div className="space-y-4">
          {relationalPreview.isLoading ? <p className="text-sm text-neutral-600">Loading relational preview…</p> : null}
          {relationalPreview.data ? (
            <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <h3 className="font-semibold text-neutral-900">Customer → property → job graph</h3>
              <p className="mt-2 text-neutral-700">
                {relationalPreview.data.graph.stats.customerCount} customers ·{" "}
                {relationalPreview.data.graph.stats.propertyCount} properties ·{" "}
                {relationalPreview.data.graph.stats.jobCount} jobs ·{" "}
                {relationalPreview.data.graph.stats.estimateCount} estimates
              </p>
              <p className="mt-2 text-neutral-600">
                {formatHistoryDepthSummary(relationalPreview.data.graph.historyDepth)}
              </p>
              {relationalPreview.data.graph.joinIssues.length > 0 ? (
                <ul className="mt-3 list-disc pl-5 text-amber-800">
                  {relationalPreview.data.graph.joinIssues.slice(0, 5).map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-green-700">No join issues detected in this preview.</p>
              )}
            </section>
          ) : null}

          {dedupePreview.data && dedupePreview.data.collisions.length > 0 ? (
            <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <h3 className="font-semibold">Duplicate customers</h3>
              <ul className="mt-2 space-y-2">
                {dedupePreview.data.collisions.map((collision) => (
                  <li key={collision.collisionKey} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Row {collision.rowNumber}: {collision.rowLabel} ↔ {collision.matchedCustomerName}
                    </span>
                    <select
                      className="rounded border border-neutral-300 px-2 py-1 text-xs"
                      defaultValue={collision.action}
                      onChange={(event) =>
                        applyDedupe.mutate({
                          decisions: [
                            {
                              collisionKey: collision.collisionKey,
                              action: event.target.value as ImportDuplicateAction
                            }
                          ]
                        })
                      }
                    >
                      <option value="skip">Skip row</option>
                      <option value="update_existing">Update existing</option>
                      <option value="import_new">Import as new</option>
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <button
            type="button"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white"
            disabled={acknowledgePreview.isPending}
            onClick={() =>
              acknowledgePreview.mutate(undefined, {
                onSuccess: () => showToast({ tone: "success", title: "Preview reviewed" }),
                onError: (error) =>
                  showToast({ tone: "error", title: "Could not continue", description: formatError(error) })
              })
            }
          >
            Continue to commit
          </button>
        </div>
      ) : null}

      {activeStep === 5 && bundle ? (
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Commit is resumable: refresh the page and we restore bundle <span className="font-mono">{bundle.id}</span> from
            your browser session.
          </p>
          <p className="text-sm text-neutral-600">Status: {bundle.status}</p>
          <button
            type="button"
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={commitBundle.isPending || bundle.status === "committing"}
            onClick={() =>
              commitBundle.mutate(undefined, {
                onSuccess: () => {
                  showToast({ tone: "success", title: "Import commit started" });
                  void bundleQuery.refetch();
                },
                onError: (error) =>
                  showToast({ tone: "error", title: "Commit failed", description: formatError(error) })
              })
            }
          >
            {bundle.status === "committing" ? "Commit in progress…" : "Start resumable commit"}
          </button>
          <SavedCardConsentPanel bundleId={bundle.id} />
        </div>
      ) : null}
    </PageLayout>
  );
}
