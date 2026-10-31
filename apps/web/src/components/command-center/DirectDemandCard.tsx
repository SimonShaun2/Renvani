"use client";

import { useMemo } from "react";

import { useCompany } from "@/src/hooks/company.hooks";
import { useDirectDemandSummary } from "@/src/hooks/direct-demand.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { canViewDirectDemand, formatUsdFromDecimal, jobsLabel, last30DaysRange } from "./direct-demand.utils";

const card = "rounded-[14px] border border-[#e6dccb] bg-white";
const mono = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#5e6684]";

/** No Figma frame: reuses the Key numbers tile style (10:74). Hidden for roles the API doesn't allow. */
export function DirectDemandCard({ now }: { now?: Date }) {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canViewDirectDemand(role);
  const company = useCompany();
  const timeZone = company.data?.company.timezone || undefined;
  const range = useMemo(() => last30DaysRange(now ?? new Date(), timeZone), [now, timeZone]);
  const query = useDirectDemandSummary(range, allowed);

  if (!allowed) return null;

  const totals = query.data?.totals;
  const zero = totals ? totals.jobCount === 0 : false;

  return (
    <section className={`${card} space-y-1.5 p-5 sm:max-w-[calc(50%-0.5rem)] xl:max-w-[calc(25%-0.75rem)]`} aria-label="Direct demand" data-testid="cc-direct-demand">
      <p className={mono}>Direct demand</p>
      {query.isLoading ? (
        <div data-testid="cc-direct-demand-loading" aria-busy="true" className="space-y-2 py-1">
          <div className="h-9 w-40 animate-pulse rounded-[8px] bg-[#f3eadc]" />
          <div className="h-3 w-24 animate-pulse rounded bg-[#f3eadc]" />
        </div>
      ) : query.isError || !totals ? (
        <p className="text-[13px] text-[#5e6684]" role="status">
          Direct demand isn’t available right now.
        </p>
      ) : (
        <>
          <p className="text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">
            {jobsLabel(totals.jobCount)}, {formatUsdFromDecimal(totals.paidRevenue)}
          </p>
          {zero ? <p className="text-[13px] font-medium text-[#5e6684]">No direct-demand jobs yet</p> : null}
        </>
      )}
      <p className="text-xs text-[#5e6684]">Last 30 days, from online booking and lead sources</p>
    </section>
  );
}
