"use client";

import { useMemo, useState } from "react";

import {
  useCommitMigratePhotoLinks,
  useMigratePhotoLinkPreview,
  useMigratePhotoUploadStatus,
  useUploadMigratePhotoBatch
} from "@/src/hooks/migrate-photo-link.hooks";

interface MigratePhotoLinkPreviewClientProps {
  bundleId: string;
}

export function MigratePhotoLinkPreviewClient({ bundleId }: MigratePhotoLinkPreviewClientProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [clientBatchId, setClientBatchId] = useState(() => `batch-${String(Date.now())}`);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  const uploadStatus = useMigratePhotoUploadStatus(bundleId);
  const previewQuery = useMigratePhotoLinkPreview(bundleId);
  const uploadBatch = useUploadMigratePhotoBatch(bundleId);
  const commitLinks = useCommitMigratePhotoLinks(bundleId);

  const suggestions = previewQuery.data?.suggestions ?? [];
  const highConfidenceCount = useMemo(
    () => suggestions.filter((row) => row.confidence >= 0.35).length,
    [suggestions]
  );

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      return;
    }

    await uploadBatch.mutateAsync({ clientBatchId, files: selectedFiles });
    setSelectedFiles([]);
    setClientBatchId(`batch-${String(Date.now())}`);
    await previewQuery.refetch();
  }

  async function handleCommit() {
    const result = await commitLinks.mutateAsync();
    setCommitMessage(
      `Committed ${String(result.enqueuedBatches)} migrate-file-batch job(s) on fsm:imports.`
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-950">Photo migration link preview</h1>
        <p className="text-sm text-neutral-600">
          Upload photos or folders in resumable batches, review AI-suggested customer/job/asset links, then commit to
          enqueue <code className="rounded bg-neutral-100 px-1">migrate-file-batch</code> on{" "}
          <code className="rounded bg-neutral-100 px-1">fsm:imports</code>.
        </p>
        <p className="text-xs text-neutral-500">Bundle ID: {bundleId}</p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-neutral-900">1. Resumable batch upload</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Uploaded objects: {uploadStatus.data?.objectCount ?? 0} · Client batches:{" "}
          {uploadStatus.data?.clientBatchCount ?? 0}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            multiple
            className="text-sm"
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              setSelectedFiles(files);
            }}
          />
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={uploadBatch.isPending || selectedFiles.length === 0}
            onClick={() => {
              void handleUpload();
            }}
          >
            {uploadBatch.isPending ? "Uploading…" : "Upload batch"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-neutral-900">2. Link preview</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {suggestions.length} file(s); {highConfidenceCount} with heuristic matches (confirm before commit).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="py-2 pr-4 font-medium">File</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Job</th>
                <th className="py-2 pr-4 font-medium">Asset</th>
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((row) => (
                <tr key={row.vendorFileId} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{row.relativePath}</td>
                  <td className="py-2 pr-4">{row.suggestedCustomerLabel ?? "—"}</td>
                  <td className="py-2 pr-4">{row.suggestedJobLabel ?? "—"}</td>
                  <td className="py-2 pr-4">{row.suggestedAssetLabel ?? "—"}</td>
                  <td className="py-2">{Math.round(row.confidence * 100)}%</td>
                </tr>
              ))}
              {suggestions.length === 0 ? (
                <tr>
                  <td className="py-4 text-neutral-500" colSpan={5}>
                    Upload at least one photo to generate link suggestions.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-neutral-900">3. Commit links</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Confirms operator-reviewed links and schedules R2 file-batch processing via the imports queue.
        </p>
        <button
          type="button"
          className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={commitLinks.isPending || suggestions.length === 0}
          onClick={() => {
            void handleCommit();
          }}
        >
          {commitLinks.isPending ? "Committing…" : "Commit photo links"}
        </button>
        {commitMessage ? <p className="mt-3 text-sm text-emerald-800">{commitMessage}</p> : null}
      </section>
    </div>
  );
}
