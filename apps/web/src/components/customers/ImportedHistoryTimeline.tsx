"use client";

import Link from "next/link";
import { History } from "lucide-react";

import { useCustomerImportedHistory } from "@/src/hooks/customers.hooks";
import { TimeAgo } from "../ui/TimeAgo";
import { SkeletonCard } from "../ui/SkeletonCard";

export function ImportedHistoryTimeline({ customerId }: { customerId: string }) {
  const historyQuery = useCustomerImportedHistory(customerId);
  const jobs = historyQuery.data?.jobs ?? [];
  const estimates = historyQuery.data?.estimates ?? [];
  const items = [
    ...jobs.map((job) => ({
      id: job.id,
      kind: "job" as const,
      label: `${job.jobNumber} · ${job.title}`,
      status: job.status,
      occurredAt: job.occurredAt,
      href: `/jobs/${job.id}`
    })),
    ...estimates.map((estimate) => ({
      id: estimate.id,
      kind: "estimate" as const,
      label: `${estimate.estimateNumber}${estimate.title ? ` · ${estimate.title}` : ""}`,
      status: estimate.status,
      occurredAt: estimate.occurredAt,
      href: `/estimates/${estimate.id}`
    }))
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  if (historyQuery.isLoading) {
    return <SkeletonCard className="mt-4 h-[120px]" />;
  }

  if (historyQuery.isError || items.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-[22px] border border-neutral-200 bg-neutral-50/80 px-4 py-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-brand-accent" />
        <h3 className="text-sm font-semibold text-neutral-900">Imported service history</h3>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Jobs and estimates brought in via chunked history import (original dates preserved).
      </p>
      <ul className="mt-4 space-y-3">
        {items.slice(0, 12).map((item) => (
          <li key={`${item.kind}-${item.id}`} className="flex gap-3 text-sm">
            <span className="mt-0.5 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold uppercase text-neutral-500">
              {item.kind}
            </span>
            <div className="min-w-0">
              <Link href={item.href} className="font-medium text-brand-accent hover:underline">
                {item.label}
              </Link>
              <p className="text-xs text-neutral-500">
                {item.status} · <TimeAgo value={item.occurredAt} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
