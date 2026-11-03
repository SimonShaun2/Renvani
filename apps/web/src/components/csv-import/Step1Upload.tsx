"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Mail, UploadCloud } from "lucide-react";

interface Step1UploadProps {
  companyName: string;
  workEmail: string;
  fileName: string | null;
  isUploading: boolean;
  onSelectFile: (file: File) => void | Promise<void>;
  /** Settings import (Figma 12:4) — no onboarding chrome */
  presentation?: "onboarding" | "settings";
}

const DROPZONE_TEXT = "Drag and drop your CSV or spreadsheet here";

export function Step1Upload({
  companyName,
  workEmail,
  fileName,
  isUploading,
  onSelectFile,
  presentation = "onboarding"
}: Step1UploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const isSettings = presentation === "settings";

  const helperText = useMemo(() => {
    if (isUploading) {
      return "Uploading and preparing your file...";
    }

    if (fileName) {
      return `${fileName} is ready. We will move you to mapping as soon as the upload finishes.`;
    }

    return "Accepted formats: .csv, .xlsx, .xls up to 10MB.";
  }, [fileName, isUploading]);

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void onSelectFile(file);
    }
  }

  const dropzoneButton = (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      disabled={isUploading}
      className={[
        "flex w-full flex-col items-center justify-center rounded-[30px] border-2 border-dashed px-6 py-8 text-center transition",
        isSettings ? "min-h-[320px]" : "mt-6 min-h-[280px]",
        isDragActive
          ? "border-brand-accent bg-brand-accent-light/50"
          : "border-neutral-200 bg-neutral-50/70 hover:border-brand-accent/50 hover:bg-brand-accent-light/30",
        isUploading ? "cursor-wait opacity-75" : "cursor-pointer"
      ].join(" ")}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-brand-accent shadow-sm">
        {isUploading ? <UploadCloud className="h-7 w-7 animate-bounce" /> : <FileSpreadsheet className="h-7 w-7" />}
      </div>
      <h4 className="mt-5 text-lg font-semibold text-neutral-900">{DROPZONE_TEXT}</h4>
      <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">{helperText}</p>
      <span className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-white">
        {isUploading ? "Uploading..." : "Browse Files"}
      </span>
    </button>
  );

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,.xlsx,.xls"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          void onSelectFile(file);
        }
        event.currentTarget.value = "";
      }}
    />
  );

  if (isSettings) {
    return (
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        {dropzoneButton}
        {fileInput}
      </section>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <section className="space-y-6">
        <div className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Step 1</p>
              <h3 className="mt-2 text-xl font-semibold text-neutral-900">Upload your customer data</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                We will accept a spreadsheet export from your old system, convert it to CSV in the browser,
                and prepare it for AI-assisted mapping.
              </p>
            </div>
            <div className="rounded-full bg-brand-accent-light px-3 py-1 text-xs font-semibold text-brand-accent">
              New onboarding
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-[26px] border border-neutral-200 bg-neutral-50/80 px-5 py-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Company</p>
              <p className="mt-2 text-base font-semibold text-neutral-900">{companyName}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-2xl bg-white p-2 text-neutral-500 shadow-sm">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Work email</p>
                <p className="mt-2 text-base font-semibold text-neutral-900">{workEmail}</p>
              </div>
            </div>
          </div>

          {dropzoneButton}
          {fileInput}
        </div>
      </section>

      <aside className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Tips for best results</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-500">
          <li>Include customer names, contact details, and at least one address column where possible.</li>
          <li>
            Exports from Housecall Pro, Jobber, ServiceTitan, and QuickBooks (customers, products/services,
            invoices) work with this flow — upload one file per list, review the AI mapping, then import.
          </li>
          <li>We only import customer data in this release. Jobs, invoices, and payments remain read-only.</li>
        </ul>

        <div className="mt-6 rounded-[24px] bg-brand-panel px-4 py-4">
          <p className="text-sm font-semibold text-neutral-900">What gets imported</p>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-neutral-500 sm:grid-cols-2">
            <span className="rounded-full bg-white px-3 py-2 text-center">Customers</span>
            <span className="rounded-full bg-white px-3 py-2 text-center">Properties</span>
            <span className="rounded-full bg-white px-3 py-2 text-center">Phones</span>
            <span className="rounded-full bg-white px-3 py-2 text-center">Notes</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
