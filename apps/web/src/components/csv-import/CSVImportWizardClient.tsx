"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, LifeBuoy, RefreshCw, Upload } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useCompany } from "@/src/hooks/company.hooks";
import {
  type ImportErrorsResponse,
  type ImportSessionResponse,
  type ImportErrorRecord,
  useConfirmImportMapping,
  useCreateImportSession,
  useImportErrors,
  useImportReconciliation,
  useImportMatchCustomers,
  useImportSession,
  useStartImport
} from "@/src/hooks/imports.hooks";
import { getStoredSession } from "@/src/lib/auth";
import {
  buildDuplicateActionsPayload,
  buildDuplicateMatches,
  buildEstimatedTimeRemaining,
  buildInitialMappings,
  buildPreviewRows,
  coerceColumnMappingForApi,
  coerceImportResults,
  downloadCsvFile,
  downloadImportTemplateCsv,
  mergeServerMappings
} from "@/src/lib/csv-import";
import { sanitizeSpreadsheetCell } from "@fsm/types";
import { coerceImportSessionChunkProgress } from "@/src/lib/import-chunk-progress";

import { ApiError } from "@/src/lib/api";
import { useCSVImportStore } from "@/src/stores/csv-import.store";
import { showToast } from "@/src/stores/toast.store";
import { useUnsavedChanges } from "@/src/hooks/useUnsavedChanges";

import { Step1Upload } from "./Step1Upload";
import { Step2Mapping } from "./Step2Mapping";
import { Step3Preview } from "./Step3Preview";
import { Step4Duplicates } from "./Step4Duplicates";
import { Step5Confirm } from "./Step5Confirm";
import { Step6Progress } from "./Step6Progress";
import { Step7Results } from "./Step7Results";

const WIZARD_STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "AI mapping" },
  { id: 3, label: "Preview" },
  { id: 4, label: "Duplicates" },
  { id: 5, label: "Confirm" },
  { id: 6, label: "Progress" },
  { id: 7, label: "Results" }
] as const;

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

function buildErrorCsvRows(errors: ImportErrorRecord[]) {
  return errors.map((errorRecord) => ({
    row: errorRecord.row,
    field: errorRecord.field,
    message: errorRecord.message,
    value: sanitizeSpreadsheetCell(errorRecord.value)
  }));
}

interface CSVImportWizardClientProps {
  /** FS-11 settings surface (Figma 12:4) vs legacy onboarding route */
  presentation?: "onboarding" | "settings";
}

export function CSVImportWizardClient({ presentation = "onboarding" }: CSVImportWizardClientProps) {
  const companyQuery = useCompany();
  const authSession = useMemo(() => getStoredSession(), []);
  const createImportSession = useCreateImportSession();
  const {
    currentStep,
    fileName,
    uploadId,
    headers,
    sampleRows,
    rawRows,
    mappings,
    previewRows,
    duplicateMatches,
    importStartedAt,
    validationErrorsCount,
    results,
    setStep,
    setParsedFile,
    setUploadSession,
    setMappings,
    setPreviewRows,
    setDuplicateMatches,
    setDuplicateAction,
    setValidationErrorsCount,
    setImportStarted,
    setResults,
    reset
  } = useCSVImportStore();
  const [isBuildingDuplicates, startBuildingDuplicates] = useTransition();
  const [isCancelling, setIsCancelling] = useState(false);

  const importSessionQuery = useImportSession(uploadId, {
    enabled: Boolean(uploadId),
    refetchInterval:
      uploadId && currentStep >= 2 && currentStep <= 6 ? (currentStep === 6 ? 2000 : 1500) : false
  });
  const importSessionData = importSessionQuery.data as ImportSessionResponse | undefined;
  const importSession = importSessionData?.importSession ?? null;
  const importErrorsQuery = useImportErrors(uploadId, currentStep === 7 && Boolean(uploadId));
  const importReconciliationQuery = useImportReconciliation(
    uploadId,
    currentStep === 7 && Boolean(uploadId) && importSession?.status === "completed"
  );
  const importErrorsData = importErrorsQuery.data as ImportErrorsResponse | undefined;
  const confirmMapping = useConfirmImportMapping(uploadId);
  const startImport = useStartImport(uploadId);
  const customerMatchQuery = useImportMatchCustomers(currentStep >= 3 && rawRows.length > 0);

  const isValidationReady = (importSession?.totalRows ?? 0) > 0;
  const duplicateSkipCount = duplicateMatches.filter((match) => match.action === "skip").length;
  const duplicateUpdateCount = duplicateMatches.filter((match) => match.action === "update_existing").length;
  const ingest = importSessionData?.ingest ?? null;
  const chunkProgress = coerceImportSessionChunkProgress(ingest?.chunkProgress);
  const processedRows =
    chunkProgress !== null
      ? chunkProgress.rowsOk + chunkProgress.rowsFailed
      : (importSession?.importedRows ?? 0) + (importSession?.skippedRows ?? 0);
  const estimatedTimeRemaining = buildEstimatedTimeRemaining(
    importStartedAt,
    processedRows,
    importSession?.totalRows ?? 0
  );
  const isImportRunning = currentStep === 6 && importSession?.status === "importing";
  const companyName = companyQuery.data?.company.name ?? authSession?.company.name ?? "Renvani";
  const workEmail = authSession?.user.email ?? "owner@example.com";

  useUnsavedChanges({
    isDirty: isImportRunning,
    message: "Your import is still running. Leaving now will close the live progress screen."
  });

  useEffect(() => {
    if (currentStep > 1 && !uploadId && headers.length === 0) {
      setStep(1);
    }
  }, [currentStep, headers.length, setStep, uploadId]);

  useEffect(() => {
    if (!uploadId || headers.length === 0 || !importSession) {
      return;
    }

    if (currentStep !== 2) {
      return;
    }

    const mergedMappings = mergeServerMappings(headers, mappings, importSession.columnMappings);
    if (JSON.stringify(mergedMappings) !== JSON.stringify(mappings)) {
      setMappings(mergedMappings);
    }
  }, [currentStep, headers, importSession, mappings, setMappings, uploadId]);

  useEffect(() => {
    if (!importSession || !uploadId) {
      return;
    }

    setValidationErrorsCount(importSession.errorRows ?? 0);

    if (importSession.status !== "completed" && importSession.status !== "failed") {
      return;
    }

    setResults(
      coerceImportResults({
        status: importSession.status,
        importedRows: importSession.importedRows,
        skippedRows: importSession.skippedRows,
        errorRows: importSession.errorRows,
        duplicateRows: importSession.duplicateRows,
        totalRows: importSession.totalRows,
        completedAt: importSession.completedAt,
        errorMessage: importSession.errorMessage ?? null
      })
    );

    if (currentStep === 6) {
      setStep(7);
    }
  }, [currentStep, importSession, setResults, setStep, setValidationErrorsCount, uploadId]);

  async function handleSelectFile(file: File) {
    try {
      const { parseImportFile } = await import("@/src/lib/csv-import");
      const parsedFile = await parseImportFile(file);

      setParsedFile({
        file: parsedFile.uploadFile,
        fileName: parsedFile.fileName,
        headers: parsedFile.headers,
        rawRows: parsedFile.rows,
        sampleRows: parsedFile.sampleRows
      });

      const response = await createImportSession.mutateAsync(parsedFile.uploadFile);
      const nextMappings = buildInitialMappings(parsedFile.headers, response.importSession.columnMappings);

      setUploadSession(response.importSession.id, nextMappings, parsedFile.fileName);
      setPreviewRows(buildPreviewRows(parsedFile.rows, nextMappings));
      setStep(2);

      showToast({
        tone: "success",
        title: "File uploaded",
        description: "We are mapping your columns now."
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Upload failed",
        description: formatApiError(error)
      });
    }
  }

  function handleUpdateMapping(header: string, fieldName: string | null) {
    const nextMappings = {
      ...mappings
    };

    if (fieldName && fieldName !== "__skip__") {
      for (const [existingHeader, existingValue] of Object.entries(nextMappings)) {
        if (existingHeader !== header && existingValue === fieldName) {
          nextMappings[existingHeader] = null;
        }
      }
    }

    nextMappings[header] = fieldName;
    setMappings(nextMappings);
    setPreviewRows(buildPreviewRows(rawRows, nextMappings));
    setDuplicateMatches([]);
  }

  async function handleConfirmMappings() {
    if (!uploadId) {
      return;
    }

    try {
      await confirmMapping.mutateAsync(coerceColumnMappingForApi(mappings));
      setPreviewRows(buildPreviewRows(rawRows, mappings));
      setStep(3);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Mapping failed",
        description: formatApiError(error)
      });
    }
  }

  async function handlePreviewContinue() {
    try {
      const customerResponse = customerMatchQuery.data
        ? { data: customerMatchQuery.data }
        : await customerMatchQuery.refetch();

      const customers = customerResponse.data ?? [];

      startBuildingDuplicates(() => {
        setDuplicateMatches(buildDuplicateMatches(rawRows, mappings, customers));
      });
      setStep(4);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Duplicate scan failed",
        description: formatApiError(error)
      });
    }
  }

  async function handleStartImport() {
    if (!uploadId) {
      return;
    }

    try {
      await startImport.mutateAsync(buildDuplicateActionsPayload(duplicateMatches));
      setImportStarted(uploadId, new Date().toISOString());
      setStep(6);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Import could not start",
        description: formatApiError(error)
      });
    }
  }

  function handleCancelImport() {
    if (currentStep === 6 || currentStep === 7) {
      return;
    }

    setIsCancelling(true);
    const shouldReset =
      currentStep === 1
        ? true
        : window.confirm("Cancel this import setup and clear the file from the wizard?");

    if (shouldReset) {
      reset();
      showToast({
        tone: "info",
        title: "Import canceled",
        description: "The wizard has been reset."
      });
    }

    setIsCancelling(false);
  }

  function handleImportAnother() {
    reset();
  }

  function handleDownloadErrorReport() {
    const errors = importErrorsData?.errors ?? [];

    if (errors.length === 0) {
      showToast({
        tone: "info",
        title: "No error report available",
        description: "There were no row-level errors to download."
      });
      return;
    }

    downloadCsvFile("import-errors.csv", buildErrorCsvRows(errors));
  }

  if (companyQuery.isLoading && !authSession) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[120px]" />
        <SkeletonCard className="h-[560px]" />
      </div>
    );
  }

  const isSettingsImport = presentation === "settings";
  const pageTitle = isSettingsImport
    ? "Bring your business over"
    : "CSV Import Wizard";
  const pageSubtitle = isSettingsImport
    ? "One-time import — not a live connection. Renvani maps, cleans and dedupes it for you."
    : "Bring customers over from your old system, map the columns with AI help, and launch your onboarding import.";

  return (
    <PageLayout
      title={pageTitle}
      subtitle={pageSubtitle}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {isSettingsImport && currentStep === 1 ? (
            <button
              type="button"
              onClick={() => downloadImportTemplateCsv()}
              className="inline-flex min-h-11 items-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm font-semibold text-[#0f1530] transition hover:border-neutral-300"
            >
              Download template
            </button>
          ) : null}
          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleCancelImport}
              disabled={isCancelling}
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-60"
            >
              Cancel Import
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-7">
            {WIZARD_STEPS.map((step, index) => {
              const isComplete = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="relative">
                  {index < WIZARD_STEPS.length - 1 ? (
                    <div className="absolute left-[calc(50%+22px)] top-5 hidden h-[2px] w-[calc(100%-8px)] bg-neutral-200 md:block" />
                  ) : null}
                  <div className="flex items-center gap-3 md:flex-col md:items-start">
                    <div
                      className={[
                        "relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition",
                        isComplete
                          ? "bg-success text-white"
                          : isCurrent
                            ? "bg-brand-accent text-white"
                            : "bg-neutral-100 text-neutral-500"
                      ].join(" ")}
                    >
                      {step.id}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{step.label}</p>
                      <p className="text-xs text-neutral-400">Step {step.id}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {currentStep === 1 ? (
          <Step1Upload
            companyName={companyName}
            workEmail={workEmail}
            fileName={fileName}
            isUploading={createImportSession.isPending}
            onSelectFile={handleSelectFile}
            presentation={presentation}
          />
        ) : null}

        {currentStep === 2 ? (
          <Step2Mapping
            headers={headers}
            sampleRows={sampleRows}
            mappings={mappings}
            isLoadingSuggestions={
              Boolean(uploadId) &&
              (importSessionQuery.isFetching || importSession?.status === "uploaded")
            }
            onUpdateMapping={handleUpdateMapping}
            onBack={() => setStep(1)}
            onContinue={() => {
              void handleConfirmMappings();
            }}
          />
        ) : null}

        {currentStep === 3 ? (
          <Step3Preview
            previewRows={previewRows}
            isLoadingValidation={!isValidationReady}
            onBack={() => setStep(2)}
            onContinue={() => {
              void handlePreviewContinue();
            }}
          />
        ) : null}

        {currentStep === 4 ? (
          <Step4Duplicates
            duplicateMatches={duplicateMatches}
            isLoading={isBuildingDuplicates || customerMatchQuery.isFetching}
            onBack={() => setStep(3)}
            onContinue={() => setStep(5)}
            onBulkSkip={() => {
              for (const match of duplicateMatches) {
                setDuplicateAction(match.rowNumber, "skip");
              }
            }}
            onUpdateAction={setDuplicateAction}
          />
        ) : null}

        {currentStep === 5 ? (
          <Step5Confirm
            totalRows={importSession?.totalRows ?? rawRows.length}
            duplicateCount={duplicateMatches.length}
            duplicateSkipCount={duplicateSkipCount}
            duplicateUpdateCount={duplicateUpdateCount}
            validationErrorsCount={validationErrorsCount}
            validationReady={isValidationReady}
            isStartingImport={startImport.isPending}
            onBack={() => setStep(4)}
            onCancel={handleCancelImport}
            onStartImport={() => {
              void handleStartImport();
            }}
          />
        ) : null}

        {currentStep === 6 ? (
          <Step6Progress
            fileName={fileName}
            entityType={importSession?.entityType ?? null}
            totalRows={importSession?.totalRows ?? rawRows.length}
            processedRows={processedRows}
            importedRows={importSession?.importedRows ?? 0}
            skippedRows={importSession?.skippedRows ?? 0}
            duplicateRows={importSession?.duplicateRows ?? 0}
            estimatedTimeRemaining={estimatedTimeRemaining}
            chunkProgress={chunkProgress}
            priceBookLineSeeds={ingest?.priceBookLineSeeds ?? null}
          />
        ) : null}

        {currentStep === 7 && results ? (
          <Step7Results
            results={results}
            errorRecords={importErrorsData?.errors ?? []}
            reconciliationReport={importReconciliationQuery.data?.report ?? null}
            skippedRowsDownloadUrl={importReconciliationQuery.data?.skippedRowsDownloadUrl ?? null}
            onDownloadErrorReport={handleDownloadErrorReport}
            onImportAnother={handleImportAnother}
          />
        ) : null}

        <section className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-[20px] bg-brand-panel p-3 text-brand-accent">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Need help?</p>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Large imports can stay open in this screen while the worker processes them. If your office
                  needs to resume later, the step bar state will stay in place for the current browser session.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-neutral-600">
                <Upload className="h-4 w-4" />
                10MB max upload
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-neutral-600">
                <RefreshCw className="h-4 w-4" />
                Polls every 2s during import
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-neutral-600">
                <AlertCircle className="h-4 w-4" />
                Customer data only in v1
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
