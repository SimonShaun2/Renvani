"use client";

import { CircleDot } from "lucide-react";

import { useCustomerActivity } from "@/src/hooks/customers.hooks";
import { CustomerHistoryFeed } from "./CustomerHistoryFeed";
import { TimeAgo } from "../ui/TimeAgo";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";

export function ActivityTimeline({ customerId }: { customerId: string }) {
  const activityQuery = useCustomerActivity(customerId);
  const activityItems = activityQuery.data?.data ?? [];

  return (
    <section className="surface-card px-5 py-5">
      <h2 className="text-base font-semibold text-neutral-900">Activity Timeline</h2>
      <CustomerHistoryFeed customerId={customerId} />
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
