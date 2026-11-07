"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";

import { CustomerEstimateSlotStep } from "@/src/components/estimates/CustomerEstimateSlotStep";
import { CustomerEstimateView } from "@/src/components/estimates/CustomerEstimateView";
import { canSubmitEstimateDecision, settleEstimateDecision, type EstimateDecision } from "@/src/components/estimates/estimate-decision";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { usePublicApproveEstimate, usePublicDeclineEstimate, usePublicEstimate } from "@/src/hooks/estimates.hooks";

type ApproveFlowStep = "estimate" | "schedule" | "requested";

export function PublicEstimateFlow({ token }: { token: string }) {
  const [decision, setDecision] = useState<EstimateDecision | null>(null);
  const [flowStep, setFlowStep] = useState<ApproveFlowStep>("estimate");
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [refreshUnavailable, setRefreshUnavailable] = useState(false);
  const [needsStatusCheck, setNeedsStatusCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const submissionLock = useRef(false);
  const refreshLock = useRef(false);
  const acknowledged = useRef<EstimateDecision | null>(null);
  const estimateQuery = usePublicEstimate(token);
  const approveEstimate = usePublicApproveEstimate(token);
  const declineEstimate = usePublicDeclineEstimate(token);

  const estimate = estimateQuery.data?.estimate;
  const scheduling = estimateQuery.data?.scheduling ?? null;
  const confirmedDecision = decision ?? (estimate?.status === "approved" || estimate?.status === "declined" ? estimate.status : null);
  const canSchedule = Boolean(scheduling?.property);

  useEffect(() => {
    if (estimate?.status === "approved" && canSchedule && !estimateQuery.isError && !estimateQuery.isFetching && !refreshUnavailable) {
      setFlowStep((current) => current === "requested" ? current : "schedule");
    }
  }, [canSchedule, estimate?.status, estimateQuery.isError, estimateQuery.isFetching, refreshUnavailable]);

  async function readLatest() {
    const refreshed = await estimateQuery.refetch({ throwOnError: true });
    if (refreshed.isError || !refreshed.data?.estimate) throw new Error("Estimate details unavailable");
    setRefreshUnavailable(false);
    setNeedsStatusCheck(false);
    return refreshed;
  }

  async function retryDetails() {
    if (refreshLock.current || submissionLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await readLatest();
      setSubmissionError(null);
    } catch {
      setRefreshUnavailable(true);
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }

  async function submitDecision(next: EstimateDecision, write: () => Promise<unknown>) {
    if (submissionLock.current || refreshLock.current || acknowledged.current || confirmedDecision || needsStatusCheck ||
        estimateQuery.isError || estimateQuery.isFetching || !estimate || !canSubmitEstimateDecision(estimate.status)) return;
    submissionLock.current = true;
    setSubmitting(true);
    setSubmissionError(null);
    try {
      const result = await settleEstimateDecision({
        write,
        acknowledge: () => {
          acknowledged.current = next;
          setDecision(next);
        },
        refresh: readLatest
      });
      if (result === "write-unconfirmed") {
        setNeedsStatusCheck(true);
        setSubmissionError(`We could not confirm your ${next === "approved" ? "approval" : "decline"}. Your entries are still here. Check the latest status before trying again.`);
      }
      setRefreshUnavailable(result === "saved-refresh-unavailable");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  const retryButton = (
    <button type="button" disabled={submitting || refreshing || estimateQuery.isFetching} onClick={() => void retryDetails()} className="mt-3 min-h-11 rounded-[10px] border border-[#e6dccb] bg-white px-4 text-sm font-semibold text-[#0f1530] disabled:opacity-60">
      {refreshing || estimateQuery.isFetching ? "Checking…" : "Check latest status"}
    </button>
  );

  if (flowStep === "requested") {
    return (
      <div className="min-h-screen bg-[#fbf6ef] px-4 py-12 md:px-8">
        <div className="mx-auto max-w-md rounded-[28px] border border-[#e6dccb] bg-white px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">Request received</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            {scheduling?.companyName ?? "The team"} has your preferred visit time
            {referenceNumber ? ` (reference ${referenceNumber})` : ""}. You will get a confirmation once the visit is
            scheduled — not before.
          </p>
        </div>
      </div>
    );
  }

  if (estimateQuery.isLoading && !confirmedDecision) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <SkeletonCard className="h-[160px]" />
          <SkeletonCard className="h-[720px]" />
        </div>
      </div>
    );
  }

  // An acknowledged write remains acknowledged even when the subsequent GET fails.
  if (confirmedDecision && (refreshUnavailable || estimateQuery.isError || !estimate || confirmedDecision === "declined")) {
    return (
      <div className="min-h-screen bg-[#fbf6ef] px-4 py-12 md:px-8">
        <section className="mx-auto max-w-md rounded-[14px] border border-[#e6dccb] bg-white p-6" aria-label="Estimate response">
          <h1 className="text-2xl font-semibold text-[#0f1530]">{confirmedDecision === "approved" ? "Approval recorded" : "Decline recorded"}</h1>
          <p role="status" className="mt-3 text-sm text-[#2a3360]">{confirmedDecision === "approved" ? "Your approval was recorded. A visit is not confirmed until the business schedules it." : "Your decline was recorded. Contact the business to discuss another option."}</p>
          {(refreshUnavailable || estimateQuery.isError || !estimate) ? <p role="alert" className="mt-3 text-sm text-[#b3261e]">We could not load the latest details. Checking status will not submit your response again.</p> : null}
          {retryButton}
        </section>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="min-h-screen bg-white px-4 py-12 md:px-8">
        <div className="mx-auto max-w-xl">
          <EmptyState icon={FileText} title="Estimate not available" subtitle="We could not load this estimate. Check again or contact the business that sent it." />
          {retryButton}
        </div>
      </div>
    );
  }

  if (!canSubmitEstimateDecision(estimate.status) && estimate.status !== "approved") {
    return (
      <div className="min-h-screen bg-[#fbf6ef] px-4 py-12 md:px-8">
        <section className="mx-auto max-w-md rounded-[14px] border border-[#e6dccb] bg-white p-6">
          <h1 className="text-2xl font-semibold text-[#0f1530]">{estimate.status === "converted" ? "Estimate already accepted" : "Estimate is not available for approval"}</h1>
          <p className="mt-3 text-sm text-[#2a3360]">Contact the business for the latest estimate and next steps.</p>
          {retryButton}
        </section>
      </div>
    );
  }

  if (flowStep === "schedule" && scheduling && !estimateQuery.isError && !refreshUnavailable && estimate.status === "approved") {
    return (
      <CustomerEstimateSlotStep estimate={estimate} scheduling={scheduling} onRequested={({ referenceNumber: ref }) => {
        setReferenceNumber(ref);
        setFlowStep("requested");
      }} />
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 md:px-8" aria-live="polite">
        {(submissionError || estimateQuery.isError || refreshUnavailable) ? (
          <div role="alert" className="mt-4 rounded-[10px] border border-[#e6dccb] bg-[#fde4df] p-4 text-sm text-[#b3261e]">
            <p>{submissionError ?? "The latest estimate details are unavailable. Check status before responding."}</p>
            {retryButton}
          </div>
        ) : null}
      </div>
      <CustomerEstimateView
        estimate={estimate}
        approvedState={confirmedDecision === "approved"}
        isSubmitting={needsStatusCheck || submitting || refreshing || estimateQuery.isFetching || estimateQuery.isError || refreshUnavailable || approveEstimate.isPending || declineEstimate.isPending}
        onApprove={(input) => submitDecision("approved", () => approveEstimate.mutateAsync(input))}
        onDecline={(reason) => submitDecision("declined", () => declineEstimate.mutateAsync(reason))}
      />
    </div>
  );
}
