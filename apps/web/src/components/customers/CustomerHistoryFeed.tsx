"use client";

import Link from "next/link";
import { History } from "lucide-react";

import { useCustomerHistoryFeed } from "@/src/hooks/customer-crm.hooks";

import { SkeletonCard } from "../ui/SkeletonCard";
import { TimeAgo } from "../ui/TimeAgo";

/** Unified history timeline (paged via nextCursor) from GET /customers/:id/history-timeline. */
export function CustomerHistoryFeed({ customerId }: { customerId: string }) {
  const feed = useCustomerHistoryFeed(customerId);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  if (feed.isLoading) {
    return <SkeletonCard className="mt-4 h-[120px]" />;
  }

  if (feed.isError) {
    return (
      <p className="mt-4 rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
        History could not be loaded.
      </p>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 mt-4 rounded-[22px] border border-neutral-200 bg-neutral-50/80 px-4 py-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-brand-accent" />
        <h3 className="text-sm font-semibold text-neutral-900">Service history</h3>
      </div>
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
                {item.status ?? item.subtitle ?? ""}
                {item.amount ? ` · ${item.amount}` : ""}
                {item.lineage === "imported" && item.sourceSystem ? ` · ${item.sourceSystem}` : ""}
                {" · "}
                <TimeAgo value={item.occurredAt} />
              </p>
            </div>
          </li>
        ))}
      </ul>
      {feed.hasNextPage ? (
        <button
          type="button"
          onClick={() => void feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-accent disabled:opacity-50"
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
