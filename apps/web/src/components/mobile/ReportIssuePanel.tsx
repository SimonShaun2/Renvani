"use client";

import { useState } from "react";
import { MOBILE_ISSUE_CATEGORIES } from "@fsm/types";

import { isMobileRouteMissing, isVersionConflict, useMobileJob, useReportJobIssue } from "@/src/hooks/technician-mobile.hooks";
import { showToast } from "@/src/stores/toast.store";

import "./mobile-tech-actions-motion.css";

type IssueCategory = (typeof MOBILE_ISSUE_CATEGORIES)[number];
type Severity = "low" | "medium" | "high";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  access: "Can't access property",
  customer_not_home: "Customer not home",
  safety: "Safety concern",
  parts_needed: "Parts needed",
  equipment: "Equipment problem",
  scope_change: "Scope change",
  other: "Other"
};

interface ReportIssuePanelProps {
  jobId: string;
  onClose: () => void;
}

export function ReportIssuePanel({ jobId, onClose }: ReportIssuePanelProps) {
  const mobileJob = useMobileJob(jobId);
  const reportIssue = useReportJobIssue(jobId);
  const [category, setCategory] = useState<IssueCategory>("access");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [description, setDescription] = useState("");
  const [putOnHold, setPutOnHold] = useState(false);

  const unavailable = isMobileRouteMissing(mobileJob.error) || isMobileRouteMissing(reportIssue.error);

  async function handleSubmit() {
    const recordVersion = mobileJob.data?.job.recordVersion;
    try {
      await reportIssue.mutateAsync({
        category,
        severity,
        description: description.trim(),
        ...(putOnHold ? { putOnHold: true } : {}),
        ...(recordVersion ? { recordVersion } : {})
      });
      showToast({ tone: "success", title: "Issue reported", description: "Dispatch can see it on the job now." });
      onClose();
    } catch (error) {
      if (isMobileRouteMissing(error)) {
        return;
      }
      showToast({
        tone: "error",
        title: isVersionConflict(error) ? "Job changed on another device" : "Could not report issue",
        description: isVersionConflict(error)
          ? "We refreshed the job. Check it and send the report again."
          : error instanceof Error
            ? error.message
            : "Try again in a moment."
      });
    }
  }

  return (
    <section
      data-tech-actions-reveal
      aria-label="Report an issue"
      className="mx-auto mb-3 w-full max-w-[390px] space-y-3 rounded-[22px] border border-neutral-200 bg-white px-4 py-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-950">Report an issue</h2>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-semibold text-neutral-500">
          Close
        </button>
      </div>
      {unavailable ? (
        <p role="status" className="text-sm text-neutral-500">
          Issue reporting isn&apos;t available yet. Call dispatch or add a job note instead.
        </p>
      ) : (
        <>
          <label className="block text-sm font-medium text-neutral-700">
            What happened?
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as IssueCategory)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm"
            >
              {MOBILE_ISSUE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-neutral-700">
            Severity
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as Severity)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-neutral-700">
            Details
            <textarea
              value={description}
              maxLength={5000}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 min-h-24 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={putOnHold} onChange={(event) => setPutOnHold(event.target.checked)} />
            Put job on hold
          </label>
          <button
            type="button"
            disabled={reportIssue.isPending || description.trim().length === 0}
            onClick={() => {
              void handleSubmit();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-brand-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {reportIssue.isPending ? "Sending..." : "Send report"}
          </button>
        </>
      )}
    </section>
  );
}
