"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useJob, useJobAttachments, useJobTasks, useMobileJobVersion, useReportMobileIssue, useTransitionJob, useUploadAttachment } from "@/src/hooks/jobs.hooks";
import { ApiError } from "@/src/lib/api";
import { showToast } from "@/src/stores/toast.store";

import { CrewChecklist, isTaskDone } from "./CrewChecklist";

export const ISSUE_CATEGORIES = ["Damage", "Access", "Safety", "Customer dispute", "Ran long"] as const;
const REPORTABLE_ISSUES = { Access: "access", Safety: "safety" } as const;
type ReportableIssue = keyof typeof REPORTABLE_ISSUES;

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
  const [selectedIssue, setSelectedIssue] = useState<ReportableIssue | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [issueError, setIssueError] = useState<string | null>(null);
  const mobileJob = useMobileJobVersion(jobId, selectedIssue !== null);
  const reportIssue = useReportMobileIssue(jobId);

  async function submitIssue() {
    if (!selectedIssue || !mobileJob.data?.job.recordVersion || !issueDescription.trim()) return;
    setIssueError(null);
    try {
      await reportIssue.mutateAsync({
        category: REPORTABLE_ISSUES[selectedIssue],
        description: issueDescription.trim(),
        recordVersion: mobileJob.data.job.recordVersion
      });
      setSelectedIssue(null);
      setIssueDescription("");
      showToast({ tone: "success", title: "Issue reported", description: "The office can see it now." });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        void mobileJob.refetch();
        setIssueError("This job changed. Check the latest details, then report the issue again.");
      } else {
        setIssueError(error instanceof Error ? error.message : "Could not report the issue. Try again.");
      }
    }
  }

  if (jobQuery.isLoading || tasksQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <SkeletonCard className="h-[220px]" />
        <SkeletonCard className="h-[120px]" />
      </div>
    );
  }

  if (jobQuery.isError) {
    return (
      <div className="min-h-[100svh] bg-[#fbf6ef] px-6 py-6">
        <div role="alert" className="mx-auto w-full max-w-[390px] rounded-[14px] border border-[#e6dccb] bg-white p-5">
          <p className="text-[15px] font-semibold text-[#0f1530]">Could not load this job.</p>
          <p className="mt-2 text-sm text-[#5e6684]">Check your connection and try again.</p>
          <button type="button" onClick={() => void jobQuery.refetch()} className="mt-4 min-h-11 rounded-[10px] bg-[#0f1530] px-5 text-sm font-semibold text-white">
            Retry job
          </button>
        </div>
      </div>
    );
  }

  const job = jobQuery.data?.job;
  if (!job) {
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

  if (tasksQuery.isError) {
    return (
      <div className="min-h-[100svh] bg-[#fbf6ef] px-6 py-6">
        <div role="alert" className="mx-auto w-full max-w-[390px] rounded-[14px] border border-[#e6dccb] bg-white p-5">
          <p className="text-[15px] font-semibold text-[#0f1530]">Could not load the checklist.</p>
          <p className="mt-2 text-sm text-[#5e6684]">The checklist must load before you can complete this job.</p>
          <button type="button" onClick={() => void tasksQuery.refetch()} className="mt-4 min-h-11 rounded-[10px] bg-[#0f1530] px-5 text-sm font-semibold text-white">
            Retry checklist
          </button>
        </div>
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
            {ISSUE_CATEGORIES.map((category) => {
              const available = category === "Access" || category === "Safety";
              return (
                <button
                  key={category}
                  type="button"
                  disabled={!available || reportIssue.isPending}
                  aria-pressed={available ? selectedIssue === category : undefined}
                  aria-describedby={!available ? "unavailable-issue-categories" : undefined}
                  onClick={available ? () => { setSelectedIssue(category); setIssueError(null); } : undefined}
                  className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#0f1530] aria-pressed:bg-[#f6b400] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {category}
                </button>
              );
            })}
          </div>
          <p id="unavailable-issue-categories" className="mt-3 text-xs text-[#5e6684]">Damage, Customer dispute, and Ran long can&apos;t be reported in the app yet. Call the office for those issues.</p>
          {selectedIssue ? (
            <div className="mt-4 space-y-3">
              <label htmlFor="mobile-issue-note" className="block text-sm font-semibold text-[#0f1530]">Describe the {selectedIssue.toLowerCase()} issue</label>
              <textarea
                id="mobile-issue-note"
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                maxLength={5000}
                rows={3}
                required
                className="w-full rounded-[10px] border border-[#e6dccb] bg-white p-3 text-sm text-[#0f1530] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b4acb]"
              />
              {mobileJob.isLoading ? <p role="status" className="text-sm text-[#5e6684]">Checking the latest job version…</p> : null}
              {mobileJob.isError ? (
                <div role="alert" className="text-sm text-[#b3261e]">
                  <p>Could not check the latest job details.</p>
                  <button type="button" onClick={() => void mobileJob.refetch()} className="mt-2 min-h-11 rounded-[10px] bg-white px-4 font-semibold text-[#0f1530]">Retry job details</button>
                </div>
              ) : null}
              {issueError ? <p role="alert" className="text-sm text-[#b3261e]">{issueError}</p> : null}
              <button
                type="button"
                disabled={!issueDescription.trim() || !mobileJob.data?.job.recordVersion || mobileJob.isFetching || reportIssue.isPending}
                onClick={() => void submitIssue()}
                className="min-h-11 rounded-[10px] bg-[#0f1530] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reportIssue.isPending ? "Reporting…" : "Report issue"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-[#fbf6ef] px-6 pb-4 pt-3 md:bottom-0">
        <div className="mx-auto w-full max-w-[390px]">
          <button
            type="button"
            disabled={requiredOpen || !canComplete || tasksQuery.isFetching || jobQuery.isFetching || transitionJob.isPending}
            onClick={() => {
              transitionJob.mutate(
                { status: "completed" },
                {
                  onSuccess: () => {
                    showToast({ tone: "success", title: "Job marked complete", description: "The office can see it now." });
                    router.push(`/mobile/jobs/${jobId}`);
                  },
                  onError: (error) => {
                    if (error instanceof Error && "status" in error && error.status === 409) {
                      void Promise.all([jobQuery.refetch(), tasksQuery.refetch()]);
                      showToast({
                        tone: "error",
                        title: "Checklist changed",
                        description: error.message
                      });
                      return;
                    }
                    showToast({
                      tone: "error",
                      title: "Could not complete job",
                      description: error instanceof Error ? error.message : "Try again."
                    });
                  }
                }
              );
            }}
            className="min-h-[52px] w-full rounded-[12px] bg-[#f6b400] text-[15px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {transitionJob.isPending ? "Completing..." : "Mark complete"}
          </button>
          <p className="mt-3 text-xs text-[#5e6684]">
            {tasksQuery.isFetching ? "Checking checklist..." : completionHint(job.status, requiredOpen)}
          </p>
        </div>
      </div>
    </div>
  );
}
