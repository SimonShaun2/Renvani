"use client";

import type { ColumnMapping } from "@fsm/types";
import type { MigrateOnboardingFileRef, WizardImportEntityType } from "@fsm/types";
import { FileSpreadsheet, Loader2, Plus, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Step2Mapping } from "@/src/components/csv-import/Step2Mapping";
import type { ImportSessionRecord } from "@/src/hooks/imports.hooks";

export interface MigrateUploadedFile {
  ref: MigrateOnboardingFileRef;
  session: ImportSessionRecord;
  mappingOverrides: ColumnMapping;
}

const ENTITY_OPTIONS: Array<{ value: WizardImportEntityType; label: string }> = [
  { value: "customers", label: "Customers" },
  { value: "properties", label: "Properties / locations" },
  { value: "jobs", label: "Jobs" }
];

interface MigrateOnboardingStep2UploadMappingProps {
  sourceLabel: string;
  files: MigrateUploadedFile[];
  activeFileId: string | null;
  isUploading: boolean;
  isLinking: boolean;
  onSelectFile: (importSessionId: string) => void;
  onUpload: (file: File, entityType: WizardImportEntityType) => Promise<void>;
  onUpdateMapping: (importSessionId: string, header: string, fieldName: string | null) => void;
  onBack: () => void;
  onCompleteStep2: () => void;
}

export function MigrateOnboardingStep2UploadMapping({
  sourceLabel,
  files,
  activeFileId,
  isUploading,
  isLinking,
  onSelectFile,
  onUpload,
  onUpdateMapping,
  onBack,
  onCompleteStep2
}: MigrateOnboardingStep2UploadMappingProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [entityType, setEntityType] = useState<WizardImportEntityType>("customers");

  const activeFile = useMemo(
    () => files.find((file) => file.ref.importSessionId === activeFileId) ?? files[0] ?? null,
    [activeFileId, files]
  );

  const headers = useMemo(() => {
    if (!activeFile) {
      return [];
    }

    return Object.keys(activeFile.mappingOverrides);
  }, [activeFile]);

  const isMappingLoading =
    activeFile !== null &&
    (activeFile.session.status === "uploaded" || Object.keys(activeFile.session.columnMappings).length === 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 2</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Upload files & review AI column maps</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
          Source: <span className="font-medium text-neutral-800">{sourceLabel}</span>. Add one or more CSV/spreadsheet
          exports. Each file gets its own AI mapping review before preview and dedupe (steps 3–5).
        </p>
      </div>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700">Entity for next upload</span>
            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value as WizardImportEntityType)}
              className="rounded-xl border border-neutral-200 px-3 py-2"
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onUpload(file, entityType);
              }
              event.target.value = "";
            }}
          />
        </div>

        {files.length === 0 ? (
          <div className="mt-6 flex min-h-[200px] flex-col items-center justify-center rounded-[24px] border border-dashed border-neutral-200 bg-neutral-50/80 px-6 text-center">
            <UploadCloud className="h-8 w-8 text-brand-accent" />
            <p className="mt-3 text-sm text-neutral-500">Upload at least one export to continue.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {files.map((file) => {
              const isActive = file.ref.importSessionId === activeFile?.ref.importSessionId;
              return (
                <li key={file.ref.importSessionId}>
                  <button
                    type="button"
                    onClick={() => onSelectFile(file.ref.importSessionId)}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm",
                      isActive
                        ? "border-brand-accent bg-brand-accent-light/30"
                        : "border-neutral-200 hover:bg-neutral-50"
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-neutral-900">
                      <FileSpreadsheet className="h-4 w-4 text-brand-accent" />
                      {file.ref.fileName}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-neutral-400">
                      {file.ref.entityType} · {file.session.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeFile ? (
        <Step2Mapping
          headers={headers.length > 0 ? headers : Object.keys(activeFile.session.columnMappings)}
          sampleRows={[]}
          mappings={activeFile.mappingOverrides}
          isLoadingSuggestions={isMappingLoading}
          onUpdateMapping={(header, fieldName) =>
            onUpdateMapping(activeFile.ref.importSessionId, header, fieldName)
          }
          onBack={onBack}
          onContinue={onCompleteStep2}
        />
      ) : null}

      {isLinking ? (
        <p className="text-sm text-neutral-500">Saving mappings and linking files to your migration bundle…</p>
      ) : null}
    </div>
  );
}
