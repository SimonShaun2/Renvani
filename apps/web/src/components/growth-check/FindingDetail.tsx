"use client";

import type { GrowthCheckFindingRevision } from "@fsm/types";
import { GROWTH_CHECK_REVIEW_ACTION_REGISTRY } from "@fsm/types";

import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useFindingDetail } from "@/src/hooks/growth-check-review.hooks";

import { STATUS_LABEL, formatDateTime, ownerValidationLabel, reviewStateLabel } from "./labels";
import { ReviewActions } from "./ReviewActions";

const actionLabel = (key: string) => GROWTH_CHECK_REVIEW_ACTION_REGISTRY.find((a) => a.key === key)?.label ?? key;
const show = (field: string, value: unknown) =>
  field === "status" ? (STATUS_LABEL[String(value)] ?? String(value)) : field === "reviewState" ? reviewStateLabel(String(value)) : field === "ownerValidation" ? ownerValidationLabel(String(value)) : String(value ?? "—");

function HistoryItem({ rev }: { rev: GrowthCheckFindingRevision }) {
  return (
    <li className="border-l-2 border-neutral-200 pl-3">
      <p className="text-xs font-medium text-neutral-800">
        {actionLabel(rev.action)} · <time dateTime={rev.createdAt}>{formatDateTime(rev.createdAt)}</time>
      </p>
      {rev.reason ? <p className="text-xs text-neutral-600">Reason: {rev.reason}</p> : null}
      {rev.note ? <p className="text-xs text-neutral-600">Note: {rev.note}</p> : null}
      {rev.changedFields.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs">
          {rev.changedFields.map((f) => (
            <li key={f}>
              <span className="text-neutral-500">{f}: </span>
              <del className="text-red-700">{show(f, (rev.previous as unknown as Record<string, unknown>)[f])}</del>{" → "}
              <ins className="text-emerald-700 no-underline">{show(f, (rev.next as unknown as Record<string, unknown>)[f])}</ins>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FindingDetail({ findingId, isOwner }: { findingId: string; isOwner: boolean }) {
  const q = useFindingDetail(findingId);
  if (q.isLoading) return <SkeletonCard />;
  if (q.isError || !q.data) return <ErrorState compact title="Could not load this finding" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />;
  const { finding, history } = q.data;
  return (
    <div className="space-y-4" aria-label="Finding detail">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{finding.checkLabel ?? finding.checkId}</h3>
        <p className="text-xs text-neutral-500">
          {finding.current.ownerConfirmedFact ? "Owner-confirmed fact" : "Hypothesis — not confirmed by the owner"} · {ownerValidationLabel(finding.current.ownerValidation)}
        </p>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium text-neutral-700">Machine observation (kept as found)</dt>
          <dd>{STATUS_LABEL[finding.machine.status] ?? finding.machine.status} · {finding.machine.confidence} confidence</dd>
          <dd className="text-neutral-600">{finding.machine.summary}</dd>
          <dd className="text-neutral-500">Seen on {finding.sourceUrl} · {formatDateTime(finding.observedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-700">Current ({reviewStateLabel(finding.current.reviewState)})</dt>
          <dd>{STATUS_LABEL[finding.current.status] ?? finding.current.status}</dd>
          <dd className="text-neutral-600">{finding.current.summary}</dd>
          {finding.current.lastNote ? <dd className="text-neutral-500">Last note: {finding.current.lastNote}</dd> : null}
        </div>
      </dl>
      <ReviewActions finding={finding} isOwner={isOwner} />
      <section aria-labelledby="gc-history">
        <h3 id="gc-history" className="text-sm font-semibold text-neutral-900">Change history</h3>
        {history.length === 0 ? (
          <p className="text-xs text-neutral-500">No changes yet. This is the original machine observation.</p>
        ) : (
          <ol className="mt-2 space-y-2">{history.map((rev) => <HistoryItem key={rev.id} rev={rev} />)}</ol>
        )}
      </section>
    </div>
  );
}
