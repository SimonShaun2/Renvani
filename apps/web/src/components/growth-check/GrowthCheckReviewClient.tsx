"use client";

import { useState } from "react";
import { ClipboardCheck, Lock, SearchCheck } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { SCAN_LIMIT, useGrowthCheckScans, useScanFindings } from "@/src/hooks/growth-check-review.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { FindingDetail } from "./FindingDetail";
import { STATUS_LABEL, formatDateTime, ownerValidationLabel, reviewStateLabel } from "./labels";

/** Mirrors the API's review roles for /growth-check/scans and findings. */
const REVIEW_ROLES = new Set(["owner", "admin"]);

function FindingsPanel({ scanId, isOwner }: { scanId: string; isOwner: boolean }) {
  const q = useScanFindings(scanId);
  const [findingId, setFindingId] = useState<string | null>(null);
  if (q.isLoading) return <SkeletonCard />;
  if (q.isError || !q.data) return <ErrorState compact title="Could not load findings" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />;
  if (q.data.findings.length === 0) return <EmptyState compact icon={SearchCheck} title="No findings in this check" subtitle="This check did not record any findings to review." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ul aria-label="Findings" className="divide-y divide-neutral-100 text-sm">
        {q.data.findings.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => setFindingId(f.id)} aria-current={findingId === f.id} className="w-full py-2 text-left hover:bg-neutral-50">
              <span className="font-medium">{f.checkLabel ?? f.checkId}</span>
              <span className="block text-xs text-neutral-500">
                {STATUS_LABEL[f.current.status] ?? f.current.status} · {reviewStateLabel(f.current.reviewState)} · {ownerValidationLabel(f.current.ownerValidation)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div>{findingId ? <FindingDetail findingId={findingId} isOwner={isOwner} /> : <p className="text-xs text-neutral-500">Pick a finding to review it and see its history.</p>}</div>
    </div>
  );
}

export function GrowthCheckReviewClient() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const allowed = role !== null && REVIEW_ROLES.has(role);
  const isOwner = role === "owner";
  const scans = useGrowthCheckScans(allowed);
  const [scanId, setScanId] = useState<string | null>(null);

  return (
    <PageLayout
      title="Growth Check findings"
      subtitle="Check what the Growth Check found on your shop's website, Google Business Profile, listings, reviews and service-area pages, and correct anything it got wrong."
    >
      {!allowed ? (
        <EmptyState icon={Lock} title="Owners and admins only" subtitle="Ask your shop owner for access to Growth Check findings." />
      ) : scans.isLoading ? (
        <SkeletonCard />
      ) : scans.isError || !scans.data ? (
        <ErrorState title="Could not load Growth Checks" onRetry={() => void scans.refetch()} isRetrying={scans.isFetching} />
      ) : scans.data.scans.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No Growth Checks yet" subtitle="Once your HVAC, plumbing or electrical shop's website is checked, findings show up here for review." />
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="gc-scans" className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 id="gc-scans" className="text-base font-semibold text-neutral-900">Prior checks</h2>
            <ul className="mt-2 divide-y divide-neutral-100 text-sm">
              {scans.data.scans.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setScanId(s.id)} aria-current={scanId === s.id} className="w-full py-2 text-left hover:bg-neutral-50">
                    <span className="font-medium">{s.targetUrl}</span>
                    <span className="block text-xs text-neutral-500">
                      {formatDateTime(s.createdAt)} · {s.reviewedFindingCount}/{s.findingCount} reviewed · {s.revisionCount} changes · {s.ownerValidationRequested} awaiting owner · {s.ownerConfirmed} owner-confirmed
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {scans.data.scans.length >= SCAN_LIMIT ? <p className="mt-2 text-xs text-neutral-500">Showing the latest {SCAN_LIMIT} checks.</p> : null}
          </section>
          {scanId ? (
            <section aria-labelledby="gc-findings" className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 id="gc-findings" className="mb-3 text-base font-semibold text-neutral-900">Findings</h2>
              <FindingsPanel key={scanId} scanId={scanId} isOwner={isOwner} />
            </section>
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}
