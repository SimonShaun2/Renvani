"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";

import { CustomerEstimateSlotStep } from "@/src/components/estimates/CustomerEstimateSlotStep";
import { CustomerEstimateView } from "@/src/components/estimates/CustomerEstimateView";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { usePublicApproveEstimate, usePublicDeclineEstimate, usePublicEstimate } from "@/src/hooks/estimates.hooks";

type ApproveFlowStep = "estimate" | "schedule" | "requested";

export default function PublicEstimatePage() {
  const params = useParams<{ token: string }>();
  const [approvedState, setApprovedState] = useState(false);
  const [flowStep, setFlowStep] = useState<ApproveFlowStep>("estimate");
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const estimateQuery = usePublicEstimate(params.token);
  const approveEstimate = usePublicApproveEstimate(params.token);
  const declineEstimate = usePublicDeclineEstimate(params.token);

  const estimate = estimateQuery.data?.estimate;
  const scheduling = estimateQuery.data?.scheduling ?? null;
  const canSchedule = Boolean(scheduling?.property);

  useEffect(() => {
    if (!estimate) {
      return;
    }

    if (estimate.status === "approved" && canSchedule) {
      setApprovedState(true);
      setFlowStep("schedule");
    }
  }, [canSchedule, estimate]);

  if (estimateQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <SkeletonCard className="h-[160px]" />
          <SkeletonCard className="h-[720px]" />
        </div>
      </div>
    );
  }

  if (estimateQuery.isError || !estimate) {
    return (
      <div className="min-h-screen bg-white px-4 py-12 md:px-8">
        <div className="mx-auto max-w-xl">
          <EmptyState
            icon={FileText}
            title="Estimate not available"
            subtitle="This approval link may have expired or already been used. Contact Renvani for help."
          />
        </div>
      </div>
    );
  }

  if (flowStep === "schedule" && scheduling) {
    return (
      <CustomerEstimateSlotStep
        estimate={estimate}
        scheduling={scheduling}
        onRequested={({ referenceNumber: ref }) => {
          setReferenceNumber(ref);
          setFlowStep("requested");
        }}
      />
    );
  }

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

  return (
    <CustomerEstimateView
      estimate={estimate}
      approvedState={approvedState}
      isSubmitting={approveEstimate.isPending || declineEstimate.isPending}
      onApprove={async (input) => {
        await approveEstimate.mutateAsync(input);
        const refreshed = await estimateQuery.refetch();
        setApprovedState(true);
        if (refreshed.data?.scheduling?.property) {
          setFlowStep("schedule");
        }
      }}
      onDecline={async (reason) => {
        await declineEstimate.mutateAsync(reason);
        await estimateQuery.refetch();
      }}
    />
  );
}
