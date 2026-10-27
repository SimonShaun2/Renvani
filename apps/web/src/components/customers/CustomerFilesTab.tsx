"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Paperclip, Upload } from "lucide-react";
import type { FileAttachment } from "@fsm/types";

import { useCustomerAttachments } from "@/src/hooks/attachments.hooks";
import { getAttachmentDownloadUrl, useUploadCustomerAttachment } from "@/src/hooks/customer-crm.hooks";
import { formatDateTime } from "@/src/components/jobs/jobs.utils";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";

type FilesFilter = "all" | "photos" | "documents";

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return "—";
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPhotoBadgeTone(photoType: FileAttachment["photoType"]): "blue" | "green" | "orange" {
  switch (photoType) {
    case "before":
      return "orange";
    case "after":
      return "green";
    default:
      return "blue";
  }
}

export function CustomerFilesTab({ customerId }: { customerId: string }) {
  const attachmentsQuery = useCustomerAttachments(customerId);
  const [filter, setFilter] = useState<FilesFilter>("all");
  const uploadAttachment = useUploadCustomerAttachment(customerId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function openSigned(attachmentId: string) {
    setFileError(null);
    // Open synchronously so popup blockers allow it, then point it at the freshly minted URL.
    const tab = window.open("", "_blank");
    try {
      const url = await getAttachmentDownloadUrl(attachmentId);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch {
      tab?.close();
      setFileError("That file couldn't be opened. Try again.");
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    setFileError(null);
    try {
      for (const file of Array.from(files)) {
        setUploadProgress(0);
        await uploadAttachment.mutateAsync({ file, onProgress: setUploadProgress });
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const attachments = attachmentsQuery.data?.data ?? [];
  const filteredAttachments = useMemo(() => {
    switch (filter) {
      case "photos":
        return attachments.filter((attachment) => attachment.fileType === "photo");
      case "documents":
        return attachments.filter((attachment) => attachment.fileType !== "photo");
      default:
        return attachments;
    }
  }, [attachments, filter]);

  const photos = filteredAttachments.filter((attachment) => attachment.fileType === "photo");
  const documents = filteredAttachments.filter((attachment) => attachment.fileType !== "photo");

  if (attachmentsQuery.isLoading) {
    return <SkeletonCard className="h-[320px]" />;
  }

  if (attachmentsQuery.isError) {
    return (
      <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
        Files could not be loaded.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          Imported and uploaded files for this customer ({attachments.length})
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            aria-label="Upload files"
            onChange={(event) => void handleUpload(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f1530] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {uploadProgress !== null ? `Uploading ${Math.round(uploadProgress)}%` : "Upload"}
          </button>
          {[
            { key: "all" as const, label: `All (${attachments.length})` },
            {
              key: "photos" as const,
              label: `Photos (${attachments.filter((item) => item.fileType === "photo").length})`
            },
            {
              key: "documents" as const,
              label: `Documents (${attachments.filter((item) => item.fileType !== "photo").length})`
            }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={
                filter === tab.key
                  ? "rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {fileError ? (
        <p role="alert" className="rounded-3xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
          {fileError}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {photos.map((attachment) => (
            <div key={attachment.id} className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-neutral-100">
                {attachment.fileUrl ? (
                  <img
                    src={attachment.thumbnailUrl ?? attachment.fileUrl}
                    alt={attachment.caption ?? attachment.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute left-3 top-3">
                  <StatBadge
                    label={attachment.photoType ?? "general"}
                    tone={getPhotoBadgeTone(attachment.photoType)}
                  />
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium text-neutral-900">{attachment.caption ?? attachment.fileName}</p>
                <p className="mt-1 text-xs text-neutral-400">{formatDateTime(attachment.createdAt)}</p>
                <button type="button" onClick={() => void openSigned(attachment.id)} className="mt-2 inline-block text-xs font-semibold text-brand-accent">Open full size</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-light text-error">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{attachment.fileName}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatFileSize(attachment.fileSizeBytes)} • {formatDateTime(attachment.createdAt)}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => void openSigned(attachment.id)} className="text-sm font-semibold text-brand-accent">Download</button>
            </div>
          ))}
        </div>
      ) : null}

      {filteredAttachments.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="No files yet"
          subtitle="Photos and documents imported from your legacy system or attached to jobs will appear here."
          compact
        />
      ) : null}
    </div>
  );
}
