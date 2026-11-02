"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CommandCenterBrief, CommandCenterKpi, CommandCenterNeedsYouItem, CommandCenterSource } from "@fsm/types";

import { useCompany } from "@/src/hooks/company.hooks";
import { commandCenterKeys, isForbidden, useCommandCenterBrief } from "@/src/hooks/command-center.hooks";
import { agentActionErrorMessage, useApproveAgentAction } from "@/src/hooks/operator-inbox.hooks";
import { useAuthStore } from "@/src/stores/auth.store";
import { cn } from "@/src/lib/utils";

import { EMPTY, KPIS, LOOP_STAGES, agentLabel, itemStatus, plural } from "./command-center.config";
import { CREW_STATUS, canViewBrief, formatKpiValue, formatTimeIn, kpiDelta, monthName, ratioLabel, safeRoute } from "./daily-brief.utils";

const card = "rounded-[14px] border border-[#e6dccb] bg-white";
const mono = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#5e6684]";
const linkCls = "inline-flex min-h-11 min-w-11 items-center justify-center text-[12px] font-medium text-[#2b4acb] hover:underline";
const MAX_LINKS = 3;

/** One query for every brief region (shared cache). Hidden for roles the API rejects, and on a 403. */
function useBrief() {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canViewBrief(role);
  const company = useCompany();
  const timeZone = company.data?.company.timezone || undefined;
  // Wait for the company time zone so the brief is fetched once, in the shop's zone.
  const query = useCommandCenterBrief(allowed && !company.isLoading, timeZone);
  const hidden = !allowed || isForbidden(query.error);
  return { query, hidden, brief: query.data };
}

export function SourceLinks({ sources, truncated = false, label = "Records" }: { sources: CommandCenterSource[]; truncated?: boolean; label?: string }) {
  if (sources.length === 0) return null;
  const shown = sources.slice(0, MAX_LINKS);
  const more = sources.length - shown.length;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-[#5e6684]" data-testid="cc-sources">
      <span>{label}:</span>
      {shown.map((s) => {
        const href = safeRoute(s);
        return href ? (
          <Link key={`${s.kind}-${s.id}`} href={href} className={linkCls}>
            {s.label}
          </Link>
        ) : (
          <span key={`${s.kind}-${s.id}`}>{s.label}</span>
        );
      })}
      {more > 0 || truncated ? <span>{truncated ? "+ more" : `+${more} more`}</span> : null}
    </p>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-[8px] bg-[#f3eadc]", className)} />;
}

function KpiTile({ kpi, previousMonth, fallback }: { kpi: CommandCenterKpi | undefined; previousMonth: string; fallback: (typeof KPIS)[number] }) {
  const value = kpi ? formatKpiValue(kpi) : EMPTY;
  const delta = kpi ? kpiDelta(kpi, previousMonth) : null;
  const ratio = kpi ? ratioLabel(kpi) : null;
  return (
    <div className={`${card} min-w-0 space-y-1.5 p-5`} data-testid="cc-kpi">
      <p className={mono}>{kpi?.label ?? fallback.label}</p>
      <p className="text-[36px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{value}</p>
      {value === EMPTY ? (
        <p className="text-[12px] text-[#5e6684]" data-testid="cc-kpi-definition">
          {kpi?.definition ?? "No data for this month yet."}
        </p>
      ) : (
        <>
          <p className="text-[13px] font-medium text-[#2f7d4f]">{delta ?? `No ${previousMonth} data`}</p>
          {ratio || kpi?.detail ? <p className="text-[12px] text-[#2a3360]">{[ratio, kpi?.detail].filter(Boolean).join(" · ")}</p> : null}
        </>
      )}
      <p className="text-xs text-[#5e6684]">Source: {kpi?.sourceLabel ?? fallback.source}</p>
      {kpi ? <SourceLinks sources={kpi.sources} truncated={kpi.sourcesTruncated} /> : null}
    </div>
  );
}

/** KPI row (10:74): calendar month vs previous month. */
export function BriefKpis() {
  const { query, hidden, brief } = useBrief();
  if (hidden) return null;
  const previousMonth = brief ? monthName(brief.period.compareStartDate) : "last month";
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-figma="10:74" aria-label="Key numbers" aria-busy={query.isLoading || undefined}>
      {query.isLoading ? (
        KPIS.map((k) => (
          <div key={k.key} className={`${card} space-y-2 p-5`} data-testid="cc-kpi-loading">
            <p className={mono}>{k.label}</p>
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))
      ) : query.isError ? (
        <p className={`${card} p-5 text-[13px] text-[#5e6684] sm:col-span-2 xl:col-span-4`} role="status">
          Key numbers aren’t available right now.
        </p>
      ) : (
        KPIS.map((k) => <KpiTile key={k.key} fallback={k} previousMonth={previousMonth} kpi={brief?.kpis.find((x) => x.key === k.key)} />)
      )}
    </section>
  );
}

function monthLabel(brief: CommandCenterBrief | undefined) {
  return brief ? monthName(brief.period.startDate) : EMPTY;
}

/** Rail (10:168): this month's loop (10:172) + today's crews. */
export function BriefRail() {
  const { query, hidden, brief } = useBrief();
  if (hidden) return null;
  const max = Math.max(1, ...(brief?.loop.map((s) => s.count) ?? [0]));
  const status = query.isLoading ? "loading" : query.isError ? "error" : "ready";
  return (
    <>
      <section className={`${card} space-y-3.5 p-5`} aria-label="This month’s loop">
        <div className="flex items-start gap-1">
          <h2 className="text-base font-semibold">This month’s loop</h2>
          <span className={mono}>{monthLabel(brief)}</span>
        </div>
        {status === "error" ? <p className="text-[13px] text-[#5e6684]" role="status">The loop isn’t available right now.</p> : null}
        {status !== "error"
          ? LOOP_STAGES.map((stage) => {
              const s = brief?.loop.find((x) => x.stage === stage.key);
              const pct = s ? Math.round((s.count / max) * 100) : 0;
              return (
                <div key={stage.key} className="space-y-1.5" data-testid="cc-loop">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium">{s?.label ?? stage.label}</span>
                    <span className="font-semibold tabular-nums">{status === "loading" ? EMPTY : (s?.count ?? EMPTY)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f3eadc]">
                    <div data-cc-bar className={stage.tone === "dark" ? "h-2 bg-[#0f1530]" : "h-2 bg-[#f6b400]"} style={{ width: `${pct}%` }} />
                  </div>
                  {s ? <SourceLinks sources={s.sources} truncated={s.sourcesTruncated} /> : null}
                </div>
              );
            })
          : null}
      </section>
      <section className={`${card} space-y-3 p-5`} aria-label="Today’s crews">
        <h2 className="text-base font-semibold">Today’s crews</h2>
        {status === "loading" ? <Skeleton className="h-10 w-full" /> : null}
        {status === "error" ? <p className="text-[13px] text-[#5e6684]" role="status">Crew status isn’t available right now.</p> : null}
        {status === "ready" && brief && brief.crewsToday.length === 0 ? (
          <p className="text-[13px] text-[#5e6684]">No crews are set up for today.</p>
        ) : null}
        <ul className="space-y-3">
          {brief?.crewsToday.map((crew) => {
            const st = CREW_STATUS[crew.status] ?? CREW_STATUS.scheduled!;
            return (
              <li key={crew.crewId} className="space-y-1 border-t border-[#e6dccb] pt-3 first:border-t-0 first:pt-0" data-testid="cc-crew">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-[14px] font-semibold [overflow-wrap:anywhere]">{crew.name}</span>
                  <span className={cn("inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", st.className)}>{st.label}</span>
                </div>
                <p className="text-[12px] text-[#5e6684]">
                  {plural(crew.jobCount, "job", "jobs")} · next {formatTimeIn(crew.nextStartAt, brief.period.timeZone)}
                </p>
                <SourceLinks sources={crew.sources} />
              </li>
            );
          })}
        </ul>
        <Link href="/dispatch" className={linkCls}>
          Open dispatch
        </Link>
      </section>
    </>
  );
}

function primaryLabel(item: CommandCenterNeedsYouItem) {
  if (item.primaryAction === "approve") return "Approve";
  return item.primaryAction === "review" ? "Review" : "Open";
}

function BriefItem({ item }: { item: CommandCenterNeedsYouItem }) {
  const queryClient = useQueryClient();
  const approve = useApproveAgentAction({ id: item.actionId, version: item.version });
  const [error, setError] = useState<string | null>(null);
  const status = itemStatus(item.state);
  const href = item.sources.map(safeRoute).find(Boolean) ?? null;

  async function onApprove() {
    setError(null);
    try {
      await approve.mutateAsync();
    } catch (e) {
      setError(agentActionErrorMessage(e));
    } finally {
      await queryClient.invalidateQueries({ queryKey: commandCenterKeys.all });
    }
  }

  const action = "flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#f6b400] px-[18px] text-[14px] font-semibold text-[#0f1530] hover:bg-[#e0a400] disabled:opacity-50";
  return (
    <div className={`${card} space-y-3 p-4`} data-testid="cc-brief-item">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#fff4d6] px-2.5 py-1 text-xs font-semibold text-[#7a5600]">
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {item.kind === "suggestion" ? status.label : `${status.label} · fact`}
        </span>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#5e6684]">{agentLabel(item.agentProduct)}</span>
      </div>
      <p className="text-[20px] font-semibold leading-[1.35] [overflow-wrap:anywhere]">{item.title}</p>
      <SourceLinks sources={item.sources} label="Connected record" />
      {item.primaryAction === "approve" ? (
        <button type="button" className={action} disabled={approve.isPending} onClick={onApprove}>
          {primaryLabel(item)}
        </button>
      ) : href ? (
        <Link href={href} className={action}>
          {primaryLabel(item)}
        </Link>
      ) : null}
      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
    </div>
  );
}

/** Mobile owner "Today" (266:1165): jobs today + needs-you counts and the newest item. Same endpoint. */
export function DailyBriefCard() {
  const { query, hidden, brief } = useBrief();
  if (hidden) return null;
  const tile = `${card} min-w-0 flex-1 space-y-3 p-4`;
  return (
    <section className="space-y-3 lg:hidden" aria-label="Today" data-figma="266:1165" data-testid="cc-daily-brief" aria-busy={query.isLoading || undefined}>
      {query.isLoading ? (
        <div className="flex gap-3" data-testid="cc-daily-brief-loading">
          <Skeleton className="h-[120px] flex-1" />
          <Skeleton className="h-[120px] flex-1" />
        </div>
      ) : query.isError || !brief ? (
        <p className={`${card} p-4 text-[13px] text-[#5e6684]`} role="status">
          Today’s brief isn’t available right now.
        </p>
      ) : (
        <>
          <div className="flex gap-3">
            <div className={tile}>
              <p className="text-[12px] font-medium uppercase text-[#2a3360]">Jobs today</p>
              <p className="text-[36px] font-semibold leading-[1.15] tabular-nums">{brief.today.jobsToday}</p>
              <SourceLinks sources={brief.today.sources} label="Jobs" />
            </div>
            <div className={tile}>
              <p className="text-[12px] font-medium uppercase text-[#2a3360]">Needs you</p>
              <p className="text-[36px] font-semibold leading-[1.15] tabular-nums">{brief.needsYou.counts.approvals + brief.needsYou.counts.exceptions}</p>
              <p className="text-[12px] font-medium text-[#2a3360]">
                {plural(brief.needsYou.counts.approvals, "approval", "approvals")} · {plural(brief.needsYou.counts.exceptions, "exception", "exceptions")}
              </p>
            </div>
          </div>
          {brief.needsYou.items[0] ? (
            <BriefItem item={brief.needsYou.items[0]} />
          ) : (
            <p className={`${card} p-4 text-[13px] text-[#5e6684]`} data-testid="cc-daily-brief-empty">
              {brief.emptyStates.hasAnyData ? "Nothing needs you right now." : "No jobs or inquiries yet. Numbers show up here once work comes in."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
