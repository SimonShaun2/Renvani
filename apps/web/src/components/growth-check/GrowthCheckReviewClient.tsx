"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { SCAN_LIMIT, useGrowthCheckScans, useScanFindings } from "@/src/hooks/growth-check-review.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { FindingDetail } from "./FindingDetail";
import { ReportEditor } from "./ReportEditor";
import { STATUS_LABEL, formatDate, formatDateTime, ownerValidationLabel, reviewStateLabel } from "./labels";
import { Alert, Pill, cardClass, cardTitle, findingKind } from "./ui";

/** Mirrors the API's review roles for /growth-check/scans and findings. */
const REVIEW_ROLES = new Set(["owner", "admin"]);

function FindingsPanel({ scanId, isOwner }: { scanId: string; isOwner: boolean }) {
  const q = useScanFindings(scanId);
  const [findingId, setFindingId] = useState<string | null>(null);
  if (q.isLoading) return <SkeletonCard />;
  if (q.isError || !q.data) return <ErrorState compact title="Could not load findings" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />;
  if (q.data.findings.length === 0) {
    return <Alert tone="neutral" title="No findings in this check" detail="This check did not record any findings to review." />;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="gc-findings" className={`${cardClass} space-y-3.5`}>
        <h2 id="gc-findings" className={cardTitle}>Findings</h2>
        <ul aria-label="Findings" className="space-y-0.5">
          {q.data.findings.map((f) => {
            const kind = findingKind(f.current);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFindingId(f.id)}
                  aria-current={findingId === f.id}
                  className={`w-full space-y-1.5 rounded-[10px] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] ${findingId === f.id ? "bg-[#f3eadc]" : "hover:bg-[#f3eadc]/50"}`}
                >
                  <span className="block text-sm font-medium text-[#0f1530]">{f.checkLabel ?? f.checkId}</span>
                  <Pill tone={kind.tone}>{kind.label}</Pill>
                  <span className="block text-[12.5px] text-[#5e6684]">
                    {STATUS_LABEL[f.current.status] ?? f.current.status} · {reviewStateLabel(f.current.reviewState)} · {ownerValidationLabel(f.current.ownerValidation)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!findingId ? <p className="text-[12.5px] text-[#5e6684]">Pick a finding to review it and see its history.</p> : null}
      </section>
      {findingId ? (
        <section className={cardClass}>
          <FindingDetail findingId={findingId} isOwner={isOwner} />
        </section>
      ) : null}
    </div>
  );
}

export function GrowthCheckReviewClient() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const allowed = role !== null && REVIEW_ROLES.has(role);
  const isOwner = role === "owner";
  const scans = useGrowthCheckScans(allowed);
  const [scanId, setScanId] = useState<string | null>(null);
  const selected = scans.data?.scans.find((s) => s.id === scanId) ?? null;

  return (
    <div className="space-y-6">
      {/* Figma 366:4217 page header + context row. */}
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Growth Check</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1530] md:text-[28px] lg:text-[30px]">Growth Check findings</h1>
        <p className="text-[15px] text-[#5e6684]">Check what the Growth Check found on your shop. Confirm, reject or keep each finding.</p>
        <div className="!mt-4 border-t border-[#e6dccb]" />
        {selected ? (
          <p data-testid="gc-context" className="pt-2 text-[13px] text-[#2a3360]">
            {selected.targetUrl} · Growth Check {formatDate(selected.createdAt)}
          </p>
        ) : null}
      </header>
      {!allowed ? (
        <Alert tone="neutral" title="Owners and admins only" detail="Ask your shop owner for access to Growth Check findings." />
      ) : scans.isLoading ? (
        <SkeletonCard />
      ) : scans.isError || !scans.data ? (
        <ErrorState title="Could not load Growth Checks" onRetry={() => void scans.refetch()} isRetrying={scans.isFetching} />
      ) : scans.data.scans.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No Growth Checks yet" subtitle="Once your HVAC, plumbing or electrical shop's website is checked, findings show up here for review." />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="gc-scans" className={`${cardClass} space-y-3.5`}>
            <h2 id="gc-scans" className={cardTitle}>Prior checks</h2>
            <ul className="space-y-0.5">
              {scans.data.scans.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setScanId(s.id)}
                    aria-current={scanId === s.id}
                    className={`w-full rounded-[10px] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] ${scanId === s.id ? "bg-[#f3eadc]" : "hover:bg-[#f3eadc]/50"}`}
                  >
                    <span className="block text-sm font-medium text-[#0f1530]">{s.targetUrl}</span>
                    <span className="block text-[12.5px] text-[#5e6684]">
                      {formatDateTime(s.createdAt)} · {s.reviewedFindingCount}/{s.findingCount} reviewed · {s.revisionCount} changes · {s.ownerValidationRequested} awaiting owner · {s.ownerConfirmed} owner-confirmed
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {scans.data.scans.length >= SCAN_LIMIT ? <p className="text-[12.5px] text-[#5e6684]">Showing the latest {SCAN_LIMIT} checks.</p> : null}
          </section>
          {scanId ? <FindingsPanel key={scanId} scanId={scanId} isOwner={isOwner} /> : null}
          {scanId ? (
            <section aria-labelledby="gc-report" className={cardClass}>
              <h2 id="gc-report" className={`mb-3 ${cardTitle}`}>Owner report</h2>
              <ReportEditor key={scanId} scanId={scanId} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
