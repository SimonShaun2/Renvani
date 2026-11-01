"use client";

import type { GrowthCheckFindingRevision } from "@fsm/types";
import { GROWTH_CHECK_REVIEW_ACTION_REGISTRY } from "@fsm/types";

import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useFindingDetail } from "@/src/hooks/growth-check-review.hooks";

import { STATUS_LABEL, formatDateTime, ownerValidationLabel, reviewStateLabel } from "./labels";
import { ReviewActions } from "./ReviewActions";
import { Pill, findingKind } from "./ui";

const actionLabel = (key: string) => GROWTH_CHECK_REVIEW_ACTION_REGISTRY.find((a) => a.key === key)?.label ?? key;
const show = (field: string, value: unknown) =>
  field === "status" ? (STATUS_LABEL[String(value)] ?? String(value)) : field === "reviewState" ? reviewStateLabel(String(value)) : field === "ownerValidation" ? ownerValidationLabel(String(value)) : String(value ?? "—");

function HistoryItem({ rev }: { rev: GrowthCheckFindingRevision }) {
  return (
    <li className="border-l-2 border-[#e6dccb] pl-3">
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
  const kind = findingKind(finding.current);
  return (
    <div className="space-y-3.5" aria-label="Finding detail">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={kind.tone}>{kind.label}</Pill>
        {finding.current.reviewState === "machine" && !finding.current.ownerConfirmedFact ? <Pill tone="warn">Needs review</Pill> : null}
      </div>
      <div>
        <h3 className="text-[19px] font-semibold text-[#0f1530]">{finding.checkLabel ?? finding.checkId}</h3>
        <p className="text-[12.5px] text-[#5e6684]">
          {finding.current.ownerConfirmedFact ? "Owner-confirmed fact" : "Hypothesis — not confirmed by the owner"} · {ownerValidationLabel(finding.current.ownerValidation)}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 rounded-[10px] bg-[#eef0f5] p-3.5 text-[13px] text-[#2a3360]">
          <dt className="text-[11px] font-medium uppercase tracking-[0.06em]">Machine observation (kept as found)</dt>
          <dd className="text-sm">{finding.machine.summary}</dd>
          <dd>{STATUS_LABEL[finding.machine.status] ?? finding.machine.status} · {finding.machine.confidence} confidence</dd>
          <dd className="text-[#5e6684]">Seen on {finding.sourceUrl} · {formatDateTime(finding.observedAt)}</dd>
        </div>
        <div className="space-y-1.5 rounded-[10px] border border-[#e6dccb] p-3.5 text-[13px] text-[#2a3360]">
          <dt className="text-[11px] font-medium uppercase tracking-[0.06em]">Current ({reviewStateLabel(finding.current.reviewState)})</dt>
          <dd className="text-sm">{finding.current.summary}</dd>
          <dd>{STATUS_LABEL[finding.current.status] ?? finding.current.status}</dd>
          {finding.current.lastNote ? <dd className="text-[#5e6684]">Last note: {finding.current.lastNote}</dd> : null}
        </div>
      </dl>
      <ReviewActions finding={finding} isOwner={isOwner} onReload={() => void q.refetch()} />
      <div className="border-t border-[#e6dccb]" />
      <section aria-labelledby="gc-history">
        <h3 id="gc-history" className="text-[15px] font-semibold text-[#0f1530]">Change history</h3>
        {history.length === 0 ? (
          <p className="mt-1 text-[13px] text-[#5e6684]">No changes yet. This is the original machine observation.</p>
        ) : (
          <ol className="mt-2 space-y-2">{history.map((rev) => <HistoryItem key={rev.id} rev={rev} />)}</ol>
        )}
      </section>
    </div>
  );
}
