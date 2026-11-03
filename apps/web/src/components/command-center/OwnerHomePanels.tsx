"use client";

import Link from "next/link";
import type { CommandCenterBrief, CommandCenterKpi, CommandCenterSource } from "@fsm/types";
import { useCompany } from "@/src/hooks/company.hooks";
import { useCommandCenterBrief } from "@/src/hooks/command-center.hooks";
import { useAuthStore } from "@/src/stores/auth.store";
import { EMPTY, KPIS, LOOP_STAGES, plural } from "./command-center.config";
import { canViewBrief, CREW_STATUS, formatKpiValue, formatTimeIn, kpiDelta, monthName, ratioLabel } from "./daily-brief.utils";
import { isKnownMetric, loopWidth, ownerPanelState, ownerSourceHref, type OwnerPanelState } from "./owner-home-state";
import { OwnerPanelNotice } from "./OwnerPanelNotice";
import styles from "./owner-home.module.css";

/** Same tenant-authenticated API/cache as the existing brief, never a separate metrics store. */
function useOwnerBrief() {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canViewBrief(role);
  const company = useCompany();
  const query = useCommandCenterBrief(allowed && !company.isLoading && !company.isError, company.data?.company.timezone || undefined);
  let state: OwnerPanelState = company.isError ? "unavailable" : company.isLoading ? "loading" : ownerPanelState(query);
  if (state === "ready" && (!query.data || !Array.isArray(query.data.kpis) || !Array.isArray(query.data.loop) || !Array.isArray(query.data.crewsToday) || !query.data.period)) state = "unavailable";
  const brief = state === "ready" ? query.data : undefined;
  return {
    allowed, state, brief,
    refreshing: Boolean(query.isFetching || company.isFetching),
    retry: () => company.isError ? company.refetch() : query.refetch()
  };
}

function RecordLinks({ sources }: { sources: CommandCenterSource[] }) {
  if (!sources.length) return null;
  return (
    <details className={styles.sources}>
      <summary>View source records</summary>
      <ul>
        {sources.slice(0, 3).map((source) => {
          const href = ownerSourceHref(source.route);
          return <li key={`${source.kind}-${source.id}`}>{href ? <Link href={href}>{source.label}</Link> : source.label}</li>;
        })}
        {sources.length > 3 ? <li>Additional records are included in this total.</li> : null}
      </ul>
    </details>
  );
}

function Metric({ kpi, index, previousMonth }: { kpi?: CommandCenterKpi; index: number; previousMonth: string }) {
  const definition = KPIS[index]!;
  const known = Boolean(kpi && isKnownMetric(kpi.value, kpi.unit));
  const value = known && kpi ? formatKpiValue(kpi) : EMPTY;
  const previousKnown = Boolean(kpi && isKnownMetric(kpi.previousValue, kpi.unit));
  const delta = known && previousKnown && kpi ? kpiDelta(kpi, previousMonth) : null;
  const ratio = kpi ? ratioLabel(kpi) : null;
  return (
    <article className={styles.metric} data-testid="cc-kpi" data-metric-state={known ? "known" : "unknown"}>
      <h2 className={styles.eyebrow}>{kpi?.label ?? definition.label}</h2>
      <p className={styles.metricValue}>{value}</p>
      {known ? <>
        <p className={styles.metricDetail}>{delta ?? (ratio || kpi?.detail || `No ${previousMonth} comparison`)}</p>
        {delta && (ratio || kpi?.detail) ? <p className={styles.muted}>{[ratio, kpi?.detail].filter(Boolean).join(" · ")}</p> : null}
      </> : <p className={styles.muted}>{kpi?.definition || "This measure is not available yet. No zero has been assumed."}</p>}
      <p className={styles.source}>Source: {kpi?.sourceLabel ?? definition.source}</p>
      {kpi ? <RecordLinks sources={kpi.sources} /> : null}
      {kpi?.sourcesTruncated ? <p className={styles.source}>Source list is abbreviated.</p> : null}
    </article>
  );
}

/** Figma 399:4231; data from the existing FS-29 brief endpoint. */
export function OwnerKeyNumbers() {
  const { allowed, state, brief, retry, refreshing } = useOwnerBrief();
  if (!allowed) return null;
  return (
    <section className={styles.metrics} data-figma="399:4231" aria-label="Key numbers" aria-busy={state === "loading"}>
      {state === "loading" ? KPIS.map((metric) => (
        <article key={metric.key} className={styles.metric} data-testid="cc-kpi-loading">
          <h2 className={styles.eyebrow}>{metric.label}</h2>
          <div className={styles.skeleton} aria-hidden="true" /><p className={styles.muted}>Loading business data…</p>
        </article>
      )) : state === "unavailable" || !brief ? (
        <div className={`${styles.card} ${styles.spanAll}`}>
          <OwnerPanelNotice message="Key numbers aren’t available right now. This is not a zero balance or an empty workspace." retry={retry} pending={refreshing} />
        </div>
      ) : <>
        {KPIS.map((definition, index) => <Metric key={definition.key} index={index} kpi={brief.kpis.find((kpi) => kpi.key === definition.key)} previousMonth={monthName(brief.period.compareStartDate)} />)}
        {brief.limits && Object.values(brief.limits).some(Boolean) ? <p className={styles.partial} role="status">Some source reads reached their limit. These figures may be incomplete; review the source records before making a decision.</p> : null}
      </>}
    </section>
  );
}

function Loop({ brief, state }: { brief?: CommandCenterBrief; state: OwnerPanelState }) {
  const maximum = Math.max(1, ...(brief?.loop.map((stage) => stage.count) ?? []));
  return <div className={styles.loop}>
    {LOOP_STAGES.map((definition) => {
      const stage = brief?.loop.find((item) => item.stage === definition.key);
      return <div key={definition.key} data-testid="cc-loop" className={styles.loopStage}>
        <div className={styles.loopLabel}><span>{stage?.label ?? definition.label}</span><strong>{state === "loading" ? EMPTY : stage?.count ?? EMPTY}</strong></div>
        <div className={styles.track} aria-hidden="true"><span className={definition.tone === "dark" ? styles.darkBar : styles.amberBar} style={{ width: `${loopWidth(stage?.count, maximum)}%` }} /></div>
        {stage ? <RecordLinks sources={stage.sources} /> : null}
      </div>;
    })}
    {state === "ready" && brief?.emptyStates && !brief.emptyStates.hasAnyData ? <p className={styles.muted}>No jobs or inquiries have been recorded for this workspace yet.</p> : null}
  </div>;
}

/** Figma 399:4325; failed refreshes never present cached crews as current. */
export function OwnerBusinessRail() {
  const { allowed, state, brief, retry, refreshing } = useOwnerBrief();
  if (!allowed) return null;
  return <>
    <section className={styles.card} aria-label="This month’s loop" data-figma="399:4326" aria-busy={state === "loading"}>
      <header className={styles.railHeader}><h2>This month’s loop</h2><span className={styles.eyebrow}>{brief ? monthName(brief.period.startDate) : EMPTY}</span></header>
      {state === "unavailable" ? <OwnerPanelNotice message="The loop isn’t available right now." retry={retry} pending={refreshing} /> : <Loop brief={brief} state={state} />}
    </section>
    <section className={styles.card} aria-label="Today’s crews" data-figma="399:4354" aria-busy={state === "loading"}>
      <header className={styles.railHeader}><h2>Today’s crews</h2></header>
      {state === "loading" ? <div className={styles.skeleton} aria-label="Loading crew schedules" /> : state === "unavailable" || !brief ? (
        <OwnerPanelNotice message="Crew status isn’t available right now. Schedules have not been confirmed." retry={retry} pending={refreshing} />
      ) : brief.crewsToday.length === 0 ? <p className={styles.muted}>No crews are set up for today.</p> : <ul className={styles.crews}>
        {brief.crewsToday.map((crew) => {
          const status = CREW_STATUS[crew.status] ?? CREW_STATUS.scheduled!;
          return <li key={crew.crewId} data-testid="cc-crew">
            <div className={styles.crewRow}><div className={styles.crewIdentity}><p className={styles.crewName}>{crew.name}</p><p className={styles.muted}>{plural(crew.jobCount, "job", "jobs")} · next {formatTimeIn(crew.nextStartAt, brief.period.timeZone)}</p></div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></div>
            <RecordLinks sources={crew.sources} />
          </li>;
        })}
      </ul>}
      <Link href="/dispatch" className={styles.textLink}>Open dispatch</Link>
    </section>
  </>;
}
