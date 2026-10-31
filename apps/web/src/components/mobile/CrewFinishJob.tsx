"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useJob, useJobAttachments, useJobTasks, useTransitionJob, useUploadAttachment } from "@/src/hooks/jobs.hooks";
import { showToast } from "@/src/stores/toast.store";

import { CrewChecklist, isTaskDone } from "./CrewChecklist";

export const ISSUE_CATEGORIES = ["Damage", "Access", "Safety", "Customer dispute", "Ran long"] as const;

export function completionHint(status: string, requiredOpen: boolean): string {
  if (status !== "in_progress") return "Only a job in progress can be marked complete.";
  if (requiredOpen) return "Finish the required checklist items first.";
  return "The office sees the job as completed right away.";
}

/** Figma 10:1917 "Crew / 04 Complete or report issue". */
export function CrewFinishJob({ jobId }: { jobId: string }) {
  const jobQuery = useJob(jobId);
  const tasksQuery = useJobTasks(jobId);
  const attachmentsQuery = useJobAttachments(jobId);
  const upload = useUploadAttachment(jobId);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const transitionJob = useTransitionJob(jobId);

  if (jobQuery.isLoading || tasksQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <SkeletonCard className="h-[220px]" />
        <SkeletonCard className="h-[120px]" />
      </div>
    );
  }

  const job = jobQuery.data?.job;
  if (jobQuery.isError || !job) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          icon={CarFront}
          title="Job not found"
          subtitle="This job may have been removed or may not belong to the current technician."
          compact
        />
      </div>
    );
  }

  const tasks = tasksQuery.data?.tasks ?? [];
  const photos = (attachmentsQuery.data?.data ?? []).filter((file) => file.fileType === "photo");
  const canComplete = job.status === "in_progress";
  const requiredOpen = tasks.some((task) => task.isRequired && !isTaskDone(task));

  return (
    <div className="min-h-[100svh] bg-[#fbf6ef] px-6 py-6 pb-32">
      <div className="mx-auto w-full max-w-[390px] space-y-5">
        <Link href={`/mobile/jobs/${job.id}`} className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5e6684]">
          Job {job.jobNumber} · {job.property?.addressLine1 ?? "Address pending"}
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#0f1530]">Finish this job</h1>

        <CrewChecklist jobId={job.id} tasks={tasks} emptyText="No checklist items on this job." />

        <section>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">Photos</p>
          <div className="grid grid-cols-4 gap-2">
            {photos.slice(0, 3).map((photo) => (
              <img
                key={photo.id}
                src={photo.thumbnailUrl ?? photo.fileUrl}
                alt={photo.caption ?? photo.fileName}
                className="aspect-square w-full rounded-[10px] bg-[#f1e7d8] object-cover"
              />
            ))}
            <button
              type="button"
              aria-label="Add photo"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
              className="flex aspect-square w-full items-center justify-center rounded-[10px] border border-[#e6dccb] text-2xl text-[#5e6684] disabled:opacity-60"
            >
              +
            </button>
          </div>
          {photos.length > 3 ? <p className="mt-2 text-xs text-[#5e6684]">+{photos.length - 3} more in Files</p> : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              upload.mutate(
                { file, photoType: "after" },
                {
                  onError: (error) =>
                    showToast({
                      tone: "error",
                      title: "Photo could not upload",
                      description: error instanceof Error ? error.message : "Try again."
                    })
                }
              );
            }}
          />
        </section>

        <section className="rounded-[14px] bg-[#fde4df] px-4 py-4" aria-label="Report an issue">
          <p className="text-[15px] font-semibold text-[#b3261e]">Report an issue</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ISSUE_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                disabled
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {category}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#5e6684]">Issue reporting isn&apos;t available yet. Call the office for now.</p>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-[#fbf6ef] px-6 pb-4 pt-3 md:bottom-0">
        <div className="mx-auto w-full max-w-[390px]">
          <button
            type="button"
            disabled={requiredOpen || !canComplete || transitionJob.isPending}
            onClick={() => {
              transitionJob.mutate(
                { status: "completed" },
                {
                  onSuccess: () => {
                    showToast({ tone: "success", title: "Job marked complete", description: "The office can see it now." });
                    router.push(`/mobile/jobs/${jobId}`);
                  },
                  onError: (error) =>
                    showToast({
                      tone: "error",
                      title: "Could not complete job",
                      description: error instanceof Error ? error.message : "Try again."
                    })
                }
              );
            }}
            className="min-h-[52px] w-full rounded-[12px] bg-[#f6b400] text-[15px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {transitionJob.isPending ? "Completing..." : "Mark complete"}
          </button>
          <p className="mt-3 text-xs text-[#5e6684]">
            {completionHint(job.status, requiredOpen)}
          </p>
        </div>
      </div>
    </div>
  );
}
