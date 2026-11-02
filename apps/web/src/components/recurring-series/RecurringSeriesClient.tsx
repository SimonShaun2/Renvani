"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { useApplySeriesChange, usePreviewSeriesChange, useRecurringSeries } from "@/src/hooks/recurring-series.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import type { OccurrenceState, PreviewResponse, SeriesAction, SeriesChange } from "./recurring-series.types";
import {
  ACTION_LABELS,
  allowedSeriesActions,
  canManageSeries,
  describeSeriesError,
  formatLocalTime,
  formatShortDate,
  formatTimeInZone,
  frequencyLabel,
  isChangeableOccurrence,
  newIdempotencyKey,
  occurrenceStatusLabel,
  seriesStatusLabel,
  type SeriesErrorView
} from "./recurring-series.utils";

interface Props {
  seriesId: string;
  now?: Date;
}

// Figma 364:4217 fields: 44px input, r8, #e6dccb border, 12px side padding, 14px text.
const inputClass =
  "mt-1.5 h-11 w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none transition focus:border-[#0f1530]";
const labelClass = "block text-[13px] font-medium text-[#2a3360]";
// Figma 10:1746 / 364:4217 secondary + dark buttons: 44px (48px on tablet/mobile for Apply), r10, 18px padding, 14px semibold, 2px ink focus ring.
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2";
const secondaryButton = `inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm text-[#0f1530] font-semibold transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const darkButton = `inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 lg:h-11 ${focusRing}`;
const cardClass = "rounded-[14px] border border-[#e6dccb] bg-white p-5";

// Figma 364:4217 / 364:4335 pills: r999, 10px/4px padding, 10.5px medium uppercase.
const PILL: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#e4f1e8", fg: "#2f7d4f" },
  paused: { bg: "#eef0f5", fg: "#2a3360" },
  cancelled: { bg: "#eef0f5", fg: "#2a3360" },
  scheduled: { bg: "#e5eafb", fg: "#2b4acb" },
  skipped: { bg: "#eef0f5", fg: "#2a3360" },
  completed: { bg: "#e4f1e8", fg: "#2f7d4f" },
  preview: { bg: "#e5eafb", fg: "#2b4acb" },
  job: { bg: "#fff4d6", fg: "#0f1530" }
};
function Pill({ tone, label, testId }: { tone: string; label: string; testId?: string }) {
  const c = PILL[tone] ?? PILL.skipped!;
  return (
    <span data-testid={testId} className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.06em]" style={{ backgroundColor: c.bg, color: c.fg }}>
      {label}
    </span>
  );
}

// Figma 364:4335 alert tones.
const ALERT = {
  error: { box: "bg-[#fbe3dc]", title: "text-[#b42318]", detail: "text-[#b42318]" },
  warn: { box: "bg-[#fff4d6]", title: "text-[#0f1530]", detail: "text-[#2a3360]" },
  neutral: { box: "bg-[#eef0f5]", title: "text-[#0f1530]", detail: "text-[#2a3360]" },
  info: { box: "bg-[#e5eafb]", title: "text-[#0f1530]", detail: "text-[#2a3360]" }
} as const;
function Alert({ tone, title, detail, children, testId, role }: { tone: keyof typeof ALERT; title: string; detail?: string | undefined; children?: ReactNode; testId?: string; role?: string }) {
  const c = ALERT[tone];
  return (
    <div data-testid={testId} role={role} className={`space-y-1.5 rounded-[10px] p-3.5 ${c.box}`}>
      <p className={`text-sm font-semibold ${c.title}`}>{title}</p>
      {detail ? <p className={`text-[13px] ${c.detail}`}>{detail}</p> : null}
      {children}
    </div>
  );
}
const errorTone = (kind: SeriesErrorView["kind"]): keyof typeof ALERT =>
  kind === "linked_job" ? "warn" : kind === "series_ended" ? "neutral" : kind === "external_scheduler" ? "info" : "error";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-[13.5px] sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-[#5e6684]">{label}</span>
      <span className="font-medium text-[#0f1530]">{value}</span>
    </div>
  );
}

const SINGLE_VISIT_ACTIONS: SeriesAction[] = ["skip_occurrence", "reschedule_occurrence"];
// Figma 364:4217 change-type order; pause/resume/end (no frame) follow.
const ACTION_ORDER: SeriesAction[] = ["skip_occurrence", "reschedule_occurrence", "reschedule_future", "pause", "resume", "end"];

export function RecurringSeriesClient({ seriesId, now }: Props) {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canManageSeries(role);
  const query = useRecurringSeries(seriesId, allowed);
  const previewMutation = usePreviewSeriesChange(seriesId);
  const applyMutation = useApplySeriesChange(seriesId);

  const [action, setAction] = useState<SeriesAction | null>(null);
  const [occurrenceId, setOccurrenceId] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ change: SeriesChange; response: PreviewResponse } | null>(null);
  // One key per previewed change, reused on retry so a double click can't apply twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<SeriesErrorView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const data = query.data;
  const series = data?.series ?? null;
  const actions = useMemo(() => (series ? allowedSeriesActions(series.status) : []), [series]);
  const occurrenceById = useMemo(() => new Map((data?.occurrences ?? []).map((o) => [o.id, o])), [data]);

  if (!allowed) {
    return (
      <div className="surface-card px-6 py-6 text-sm text-neutral-600" data-testid="series-no-access">
        Only owners, admins and dispatchers can manage recurring plans.
      </div>
    );
  }

  function resetForm(next: SeriesAction | null, occ?: OccurrenceState) {
    setAction(next);
    setOccurrenceId(occ?.id ?? "");
    setLocalDate("");
    setLocalTime(series?.localTime ?? "");
    setReason("");
    setPreview(null);
    setError(null);
    setNotice(null);
  }

  async function reload() {
    setError(null);
    setPreview(null);
    setIdempotencyKey(newIdempotencyKey());
    await query.refetch();
  }

  function buildChange(): SeriesChange | null {
    const r = reason.trim();
    if (!action || !r) return null;
    switch (action) {
      case "pause":
      case "resume":
      case "end":
        return { action, reason: r };
      case "skip_occurrence":
        return occurrenceId ? { action, occurrenceId, reason: r } : null;
      case "reschedule_occurrence":
        return occurrenceId && localDate ? { action, occurrenceId, localDate, reason: r } : null;
      case "reschedule_future":
        return /^([01]\d|2[0-3]):[0-5]\d$/u.test(localTime) ? { action, localTime, reason: r } : null;
    }
  }

  async function runPreview() {
    const change = buildChange();
    if (!change) return;
    setError(null);
    setNotice(null);
    try {
      const response = await previewMutation.mutateAsync(change);
      setPreview({ change, response });
      setIdempotencyKey(newIdempotencyKey());
    } catch (err) {
      setPreview(null);
      setError(describeSeriesError(err));
    }
  }

  async function apply() {
    if (!preview) return;
    setError(null);
    try {
      await applyMutation.mutateAsync({
        expectedVersion: preview.response.series.seriesVersion,
        idempotencyKey,
        previewHash: preview.response.previewHash,
        change: preview.change
      });
      const flagged = preview.response.preview.exceptions.length;
      setNotice(
        `Change applied.${flagged ? ` ${flagged} visit${flagged === 1 ? "" : "s"} with a job ${flagged === 1 ? "was" : "were"} left for a person to handle.` : ""} The customer has not been messaged.`
      );
      setAction(null);
      setPreview(null);
    } catch (err) {
      setError(describeSeriesError(err));
    }
  }

  const pending = previewMutation.isPending || applyMutation.isPending;
  const canPreview = Boolean(buildChange()) && !pending;
  const tz = series?.timeZone ?? "UTC";
  const changeable = (data?.occurrences ?? []).filter((o) => actions.length > 0 && isChangeableOccurrence(o, now));
  const orderedActions = ACTION_ORDER.filter((a) => actions.includes(a) && (!SINGLE_VISIT_ACTIONS.includes(a) || changeable.length > 0));
  const p = preview?.response.preview;
  const statusChanged = p ? p.series.before.status !== p.series.after.status : false;
  const timeChanged = p ? p.series.before.localTime !== p.series.after.localTime : false;
  const nothingChanges = p ? p.occurrences.length === 0 && !statusChanged && !timeChanged : false;

  const visitsCard = data ? (
    <section className={`${cardClass} space-y-3.5 lg:col-start-1`} aria-labelledby="series-visits-title">
      <h2 id="series-visits-title" className="text-[17px] font-semibold text-[#0f1530]">
        Visits in this plan
      </h2>
      {data.occurrences.length === 0 ? <p className="text-[13px] text-[#5e6684]">No visits generated yet.</p> : null}
      <ul className="space-y-0.5" data-testid="series-visits">
        {data.occurrences.map((o) => (
          <li
            key={o.id}
            data-testid={`visit-${o.id}`}
            className={`flex min-h-14 items-center justify-between gap-3 rounded-[10px] px-3 py-2 ${o.id === occurrenceId && action && SINGLE_VISIT_ACTIONS.includes(action) ? "bg-[#f3eadc]" : ""}`}
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-[#0f1530]">{formatShortDate(o.localDate)}</p>
              <p className="text-[13px] text-[#5e6684]">
                {o.status === "scheduled" || o.status === "completed" ? formatTimeInZone(o.scheduledAtUtc, tz) : occurrenceStatusLabel(o.status)}
                {o.jobId ? (
                  <>
                    {" · "}
                    <Link className="inline-flex min-h-11 items-center underline" href={`/jobs/${o.jobId}`}>
                      Has a job — change it from the job
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {o.jobId ? <Pill tone="job" label="Has job" /> : null}
              <Pill tone={o.status} label={occurrenceStatusLabel(o.status)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Figma 364:4217 page header + context row. */}
      <header className="space-y-2">
        <Link href="/service-agreements" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#2b4acb]">
          <ArrowLeft className="h-4 w-4" />
          Back to Agreements
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Recurring visits</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1530] md:text-[28px] lg:text-[30px]">Recurring visits</h1>
        <p className="text-[15px] text-[#5e6684]">Skip or move a visit, preview what changes, then apply.</p>
        <div className="!mt-4 border-t border-[#e6dccb]" />
        {series ? (
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Pill tone={series.status} label={seriesStatusLabel(series.status)} testId="series-status-pill" />
            <p className="text-[13px] text-[#2a3360]">
              {frequencyLabel(series.frequency)} · {formatLocalTime(series.localTime)} ({series.timeZone})
            </p>
          </div>
        ) : null}
        {query.isLoading ? <p className="text-sm text-[#5e6684]">Loading plan…</p> : null}
        {query.isError ? (
          <Alert tone="error" role="alert" title="This plan couldn’t be loaded.">
            <button type="button" className={secondaryButton} onClick={() => void reload()}>
              Reload
            </button>
          </Alert>
        ) : null}
      </header>

      {series?.status === "cancelled" ? (
        <Alert testId="series-ended" tone="neutral" title="This plan has ended. Ended plans can’t be changed." detail="Visits stay in history." />
      ) : null}

      {error ? (
        <Alert testId="series-error" role="alert" tone={errorTone(error.kind)} title={error.title ?? error.message} detail={error.detail}>
          {error.jobId || error.reload ? (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {error.jobId ? (
                <Link className={secondaryButton} href={`/jobs/${error.jobId}`}>
                  Open the job
                </Link>
              ) : null}
              {error.reload ? (
                <button type="button" className={secondaryButton} onClick={() => void reload()}>
                  Reload
                </button>
              ) : null}
            </div>
          ) : null}
        </Alert>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-[10px] bg-[#e4f1e8] p-3.5 text-sm text-[#0f1530]">
          {notice}
        </p>
      ) : null}

      {/* Desktop: visits / preview / history on the left, 420px change panel on the right. Tablet + mobile stack in Figma order. */}
      <div className="grid gap-5 lg:grid-flow-dense lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6">
        {visitsCard}

        {series && actions.length > 0 ? (
          <section className={`${cardClass} space-y-3.5 lg:col-start-2 lg:row-span-4 lg:row-start-1`} aria-labelledby="series-change-title">
            <h2 id="series-change-title" className="text-[17px] font-semibold text-[#0f1530]">
              Change this plan
            </h2>
            <div role="radiogroup" aria-label="Change type" className="space-y-0.5">
              {orderedActions.map((a) => (
                <label key={a} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#0f1530]">
                  <input
                    type="radio"
                    name="series-action"
                    className="h-5 w-5 accent-[#0f1530]"
                    checked={action === a}
                    disabled={pending}
                    onChange={() => resetForm(a, SINGLE_VISIT_ACTIONS.includes(a) ? changeable[0] : undefined)}
                  />
                  <span className={action === a ? "font-semibold" : ""}>{ACTION_LABELS[a]}</span>
                </label>
              ))}
            </div>

            {action ? (
              <form
                className="space-y-3.5"
                aria-label={ACTION_LABELS[action]}
                onSubmit={(e) => {
                  e.preventDefault();
                  void runPreview();
                }}
              >
                {SINGLE_VISIT_ACTIONS.includes(action) ? (
                  <label className={labelClass}>
                    Visit
                    <select className={inputClass} value={occurrenceId} onChange={(e) => (setOccurrenceId(e.target.value), setPreview(null))}>
                      {changeable.map((o) => (
                        <option key={o.id} value={o.id}>
                          {formatShortDate(o.localDate)} · {formatTimeInZone(o.scheduledAtUtc, tz)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {action === "reschedule_occurrence" ? (
                  <label className={labelClass}>
                    New date
                    <input type="date" className={inputClass} value={localDate} onChange={(e) => (setLocalDate(e.target.value), setPreview(null))} required />
                  </label>
                ) : null}
                {action === "reschedule_future" ? (
                  <label className={labelClass}>
                    New time ({series.timeZone})
                    <input type="time" className={inputClass} value={localTime} onChange={(e) => (setLocalTime(e.target.value), setPreview(null))} required />
                  </label>
                ) : null}
                <label className={labelClass}>
                  Reason
                  <textarea
                    className={`${inputClass} h-[88px] py-3`}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => (setReason(e.target.value), setPreview(null))}
                    placeholder="e.g. Homeowner is away for the winter; resume before the spring AC tune-up"
                    required
                  />
                </label>
                <button type="submit" className={`${secondaryButton} w-full`} disabled={!canPreview}>
                  {previewMutation.isPending ? "Previewing…" : "Preview changes"}
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {preview && p ? (
          <section className={`${cardClass} space-y-3.5 lg:col-start-1`} data-testid="series-preview">
            <div className="flex items-center gap-3">
              <h2 className="text-[17px] font-semibold text-[#0f1530]">What will change</h2>
              <Pill tone="preview" label="Preview" />
            </div>
            {statusChanged ? <Row label="Plan" value={`${seriesStatusLabel(p.series.before.status)} → ${seriesStatusLabel(p.series.after.status)}`} /> : null}
            {timeChanged ? <Row label="Visit time" value={`${formatLocalTime(p.series.before.localTime)} → ${formatLocalTime(p.series.after.localTime)}`} /> : null}
            {p.occurrences.map((d) => (
              <Row
                key={d.occurrenceId}
                label={`${formatShortDate(d.before.localDate)} · ${formatTimeInZone(d.before.scheduledAtUtc, tz)}`}
                value={`→  ${d.after.status !== d.before.status ? occurrenceStatusLabel(d.after.status) : `${formatShortDate(d.after.localDate)} · ${formatTimeInZone(d.after.scheduledAtUtc, tz)}`}`}
              />
            ))}
            {nothingChanges ? <Alert tone="neutral" title="No visits change." /> : p.occurrences.length > 0 && !statusChanged && !timeChanged ? <Row label="Other visits" value="No change" /> : null}
            {p.exceptions.length > 0 ? (
              <div className="space-y-2" data-testid="series-preview-exceptions">
                {p.exceptions.map((x) => (
                  <Alert
                    key={x.occurrenceId}
                    tone="warn"
                    title={`The ${formatShortDate(occurrenceById.get(x.occurrenceId)?.localDate ?? "")} visit already has a job, so it won’t be changed here.`}
                    detail="It will be flagged for a person — change it from the job instead."
                  >
                    <Link className="text-[13px] font-semibold text-[#0f1530] underline" href={`/jobs/${x.jobId}`}>
                      Open the job
                    </Link>
                  </Alert>
                ))}
              </div>
            ) : null}
            <Alert tone="neutral" title="Nothing changes until you apply. No message is sent to the customer." />
            <div className="flex">
              <button type="button" className={darkButton} onClick={() => void apply()} disabled={pending}>
                {applyMutation.isPending ? "Applying…" : "Apply changes"}
              </button>
            </div>
          </section>
        ) : null}

        {data && data.openExceptions.length > 0 ? (
          <section className={`${cardClass} space-y-3.5 lg:col-start-1`} data-testid="series-open-exceptions">
            <h2 className="text-[17px] font-semibold text-[#0f1530]">Needs a person</h2>
            {data.openExceptions.map((x) => (
              <Alert
                key={`${x.occurrenceId}-${x.recordedAt}`}
                tone="warn"
                title={`The ${formatShortDate(occurrenceById.get(x.occurrenceId)?.localDate ?? "")} visit has a job and wasn’t changed by “${ACTION_LABELS[x.action as SeriesAction] ?? x.action}”.`}
                detail="Change it from the job instead."
              >
                <Link className="text-[13px] font-semibold text-[#0f1530] underline" href={`/jobs/${x.jobId}`}>
                  Open the job
                </Link>
              </Alert>
            ))}
          </section>
        ) : null}

        {data && data.history.length > 0 ? (
          <section className={`${cardClass} space-y-3.5 lg:col-start-1`}>
            <h2 className="text-[17px] font-semibold text-[#0f1530]">Recent changes</h2>
            <div className="space-y-2" data-testid="series-history">
              {data.history.slice(0, 10).map((h) => (
                <Row
                  key={h.id}
                  label={new Date(h.occurredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  value={<span className="font-normal">{ACTION_LABELS[h.action]} · {h.reason}</span>}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
