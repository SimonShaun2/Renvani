"use client";

import Link from "next/link";
import { History } from "lucide-react";

import { useCustomerHistoryTimeline } from "@/src/hooks/customers.hooks";
import { TimeAgo } from "../ui/TimeAgo";
import { SkeletonCard } from "../ui/SkeletonCard";

export function ImportedHistoryTimeline({ customerId }: { customerId: string }) {
  const historyQuery = useCustomerHistoryTimeline(customerId, {
    limit: 12,
    types: "job,estimate"
  });
  const items = historyQuery.data?.items ?? [];

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
        <h3 className="text-sm font-semibold text-neutral-900">Service history</h3>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Imported and native jobs and estimates with source lineage when available.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={`${item.type}-${item.id}`} className="flex gap-3 text-sm">
            <span className="mt-0.5 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold uppercase text-neutral-500">
              {item.type}
            </span>
            <div className="min-w-0">
              {item.href ? (
                <Link href={item.href} className="font-medium text-brand-accent hover:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="font-medium text-neutral-900">{item.title}</p>
              )}
              <p className="text-xs text-neutral-500">
                {item.status ?? item.subtitle}
                {item.lineage === "imported" && item.sourceSystem
                  ? ` · ${item.sourceSystem}`
                  : ""}
                {" · "}
                <TimeAgo value={item.occurredAt} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
