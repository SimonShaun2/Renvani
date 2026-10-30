"use client";

import "./migrate-onboarding-motion.css";
import type { ColumnMapping } from "@fsm/types";
import type { MigrateOnboardingFileRef, WizardImportEntityType } from "@fsm/types";
import { ArrowUp, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Step2Mapping } from "@/src/components/csv-import/Step2Mapping";
import type { ImportSessionRecord } from "@/src/hooks/imports.hooks";
import { downloadImportTemplateCsv } from "@/src/lib/csv-import";

import { MigrateImportAutomationPanel } from "./MigrateImportAutomationPanel";
import {
  ACCEPTED_FILE_TYPES,
  CHIP_TONE_CLASS,
  ENTITY_OPTIONS,
  FORMAT_TAGS,
  deriveAutomationSteps,
  entityLabel,
  formatRows,
  sessionStateChip
} from "./migrateStep2.config";

export interface MigrateUploadedFile {
  ref: MigrateOnboardingFileRef;
  session: ImportSessionRecord;
  mappingOverrides: ColumnMapping;
}

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

/** Wizard step 2, matched to Figma 12:4 "Operator / 14 Import data". */
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
  const [dragging, setDragging] = useState(false);

  const activeFile = useMemo(
    () => files.find((file) => file.ref.importSessionId === activeFileId) ?? files[0] ?? null,
    [activeFileId, files]
  );
  const headers = activeFile ? Object.keys(activeFile.mappingOverrides) : [];
  const isMappingLoading =
    activeFile !== null &&
    (activeFile.session.status === "uploaded" || Object.keys(activeFile.session.columnMappings).length === 0);

  const steps = deriveAutomationSteps({
    files: files.map((f) => ({ status: f.session.status, mappings: f.mappingOverrides })),
    isUploading
  });

  async function uploadAll(list: FileList | null) {
    for (const file of Array.from(list ?? [])) {
      await onUpload(file, entityType);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[32px] font-semibold tracking-tight text-[#0f1530]">
            Bring your business over <em className="font-serif font-medium">in minutes.</em>
          </h2>
          <p className="mt-1 text-sm text-[#5e6684]">
            One-time import — not a live connection. Renvani maps, cleans and dedupes it for you.
          </p>
          <p className="mt-1 text-xs text-[#5e6684]">
            Source: <span className="font-medium text-[#2a3360]">{sourceLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadImportTemplateCsv()}
          className="rounded-[10px] border border-[#e6dccb] bg-white px-[18px] py-2.5 text-sm font-semibold text-[#0f1530] hover:border-[#c3c8da]"
        >
          Download template
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <section
            aria-label="Drop zone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void uploadAll(e.dataTransfer.files);
            }}
            className={`migrate-dropzone flex flex-col items-center gap-3 rounded-[14px] border-2 border-dashed px-6 py-8 text-center ${
              dragging ? "border-[#f6b400] bg-[#fff4d6]" : "border-[#2a3360] bg-white"
            }`}
          >
            <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff4d6] text-[#0f1530]">
              <ArrowUp className="h-5 w-5" />
            </span>
            <p className="text-lg font-semibold text-[#0f1530]">Drop files here, or browse</p>
            <p className="text-sm text-[#5e6684]">
              Customers, addresses, visit history, price list, open invoices — any mix, any order.
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {FORMAT_TAGS.map((tag) => (
                <li key={tag} className="rounded-md bg-[#f3eadc] px-2 py-1 text-[11px] text-[#2a3360]">
                  {tag}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[#5e6684]">
                File contains
                <select
                  aria-label="File contains"
                  value={entityType}
                  onChange={(event) => setEntityType(event.target.value as WizardImportEntityType)}
                  className="rounded-lg border border-[#e6dccb] bg-white px-2 py-1.5 text-sm text-[#0f1530]"
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
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#f6b400] px-5 py-2.5 text-sm font-semibold text-[#0f1530] disabled:opacity-60"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                Choose files
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              data-testid="migrate-file-input"
              onChange={(event) => {
                void uploadAll(event.target.files);
                event.target.value = "";
              }}
            />
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0f1530]">Files</h3>
            {files.length === 0 ? (
              <p className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-6 text-center text-sm text-[#5e6684]">
                Upload at least one export to continue.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[14px] border border-[#e6dccb] bg-white">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#fbf6ef] font-mono text-[10px] uppercase tracking-[0.8px] text-[#5e6684]">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">File</th>
                      <th className="px-5 py-2.5 font-medium">Detected as</th>
                      <th className="px-5 py-2.5 font-medium">Rows</th>
                      <th className="px-5 py-2.5 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => {
                      const chip = sessionStateChip(file.session.status);
                      const isActive = file.ref.importSessionId === activeFile?.ref.importSessionId;
                      return (
                        <tr key={file.ref.importSessionId} className={`border-t border-[#e6dccb] ${isActive ? "bg-[#fff4d6]/50" : ""}`}>
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => onSelectFile(file.ref.importSessionId)}
                              className="font-semibold text-[#0f1530] hover:underline"
                            >
                              {file.ref.fileName}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-[#2a3360]">{entityLabel(file.ref.entityType)}</td>
                          <td className="px-5 py-3.5 text-[#2a3360]">{formatRows(file.session.totalRows)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${CHIP_TONE_CLASS[chip.tone]}`}>
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                              {chip.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <MigrateImportAutomationPanel steps={steps} running={isUploading || steps.some((s) => s.state === "active")} />
      </div>

      {activeFile ? (
        <Step2Mapping
          headers={headers.length > 0 ? headers : Object.keys(activeFile.session.columnMappings)}
          sampleRows={[]}
          mappings={activeFile.mappingOverrides}
          isLoadingSuggestions={isMappingLoading}
          onUpdateMapping={(header, fieldName) => onUpdateMapping(activeFile.ref.importSessionId, header, fieldName)}
          onBack={onBack}
          onContinue={onCompleteStep2}
        />
      ) : null}

      {isLinking ? <p className="text-sm text-[#5e6684]">Saving mappings and linking files to your migration bundle…</p> : null}
    </div>
  );
}
