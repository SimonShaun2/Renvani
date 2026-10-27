"use client";

import Link from "next/link";
import { CircleDot } from "lucide-react";

import { useCustomerActivity, useCustomerHistoryTimeline } from "@/src/hooks/customers.hooks";
import { ImportedHistoryTimeline } from "./ImportedHistoryTimeline";
import { TimeAgo } from "../ui/TimeAgo";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";

export function ActivityTimeline({ customerId }: { customerId: string }) {
  const activityQuery = useCustomerActivity(customerId);
  const financialQuery = useCustomerHistoryTimeline(customerId, {
    limit: 8,
    types: "invoice,payment,note,communication"
  });
  const activityItems = activityQuery.data?.data ?? [];
  const financialItems = financialQuery.data?.items ?? [];

  return (
    <section className="surface-card px-5 py-5">
      <h2 className="text-base font-semibold text-neutral-900">Activity Timeline</h2>
      <ImportedHistoryTimeline customerId={customerId} />
      {financialQuery.isLoading ? (
        <SkeletonCard className="mb-4 h-[80px]" />
      ) : financialItems.length > 0 ? (
        <div className="mb-6 rounded-[22px] border border-neutral-200 bg-white px-4 py-4">
          <h3 className="text-sm font-semibold text-neutral-900">Invoices, payments & comms</h3>
          <ul className="mt-3 space-y-2">
            {financialItems.map((item) => (
              <li key={`${item.type}-${item.id}`} className="text-sm text-neutral-700">
                <span className="mr-2 text-xs font-semibold uppercase text-neutral-400">{item.type}</span>
                {item.href ? (
                  <Link href={item.href} className="font-medium text-brand-accent hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <span className="font-medium text-neutral-900">{item.title}</span>
                )}
                <span className="text-xs text-neutral-400">
                  {" "}
                  · <TimeAgo value={item.occurredAt} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
        {activityQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonCard key={index} className="h-[88px]" />
            ))}
          </div>
        ) : activityQuery.isError ? (
          <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
            Activity could not be loaded.
          </p>
        ) : activityItems.length === 0 ? (
          <EmptyState
            icon={CircleDot}
            title="No activity yet"
            subtitle="Customer, property, asset, job, invoice, and AI actions will appear here as they happen."
            compact
          />
        ) : (
          <div className="space-y-4">
            {activityItems.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
                  <CircleDot className="h-4 w-4" />
                </div>
                <div className="min-w-0 rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-sm leading-6 text-neutral-700">{event.summary}</p>
                  <TimeAgo value={event.occurredAt} className="mt-2 block text-xs font-medium text-neutral-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
