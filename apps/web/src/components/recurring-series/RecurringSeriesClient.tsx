"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, RotateCcw, UserRound } from "lucide-react";

import { StatBadge } from "@/src/components/ui/StatBadge";
import { useApplySeriesChange, usePreviewSeriesChange, useRecurringSeries } from "@/src/hooks/recurring-series.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import type { OccurrenceState, PreviewResponse, SeriesAction, SeriesChange } from "./recurring-series.types";
import {
  ACTION_LABELS,
  allowedSeriesActions,
  canManageSeries,
  describeSeriesError,
  formatLocalDate,
  formatLocalTime,
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

const inputClass =
  "mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-brand-accent";
// Figma 10:1746 Button/secondary/Preview changes: white, #E6DCCB stroke.
const secondaryButton =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButton =
  "inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60";

const statusTone = (s: string) => (s === "active" ? "green" : s === "paused" ? "neutral" : "gray");
const SINGLE_VISIT_ACTIONS: SeriesAction[] = ["skip_occurrence", "reschedule_occurrence"];

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

  return (
    <div className="space-y-6">
      <section className="surface-card px-6 py-6">
        <Link href="/service-agreements" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent">
          <ArrowLeft className="h-4 w-4" />
          Back to Agreements
        </Link>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Recurring visits</h1>
          {series ? <StatBadge label={seriesStatusLabel(series.status)} tone={statusTone(series.status)} className="px-3 py-1.5 text-sm" /> : null}
        </div>
        {series ? (
          <p className="mt-3 text-sm text-neutral-500">
            {frequencyLabel(series.frequency)} · {formatLocalTime(series.localTime)} ({series.timeZone})
          </p>
        ) : null}
        {query.isLoading ? <p className="mt-3 text-sm text-neutral-500">Loading plan…</p> : null}
        {query.isError ? (
          <div className="mt-3 flex items-center gap-3 text-sm text-error" role="alert">
            <span>This plan couldn&apos;t be loaded.</span>
            <button type="button" className={secondaryButton} onClick={() => void reload()}>
              <RotateCcw className="h-4 w-4" /> Reload
            </button>
          </div>
        ) : null}
        {series?.status === "cancelled" ? (
          <p className="mt-3 rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600" data-testid="series-ended">
            This plan has ended. Its visits are kept for history and it can&apos;t be changed.
          </p>
        ) : null}
      </section>

      {series && actions.length > 0 ? (
        <section className="surface-card px-6 py-6" aria-labelledby="series-change-title">
          <h2 id="series-change-title" className="text-lg font-semibold tracking-tight text-neutral-900">
            Change this plan
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions
              .filter((a) => !SINGLE_VISIT_ACTIONS.includes(a))
              .map((a) => (
                <button key={a} type="button" className={secondaryButton} aria-pressed={action === a} disabled={pending} onClick={() => resetForm(a)}>
                  {ACTION_LABELS[a]}
                </button>
              ))}
          </div>

          {action ? (
            <form
              className="mt-4 space-y-3"
              aria-label={ACTION_LABELS[action]}
              onSubmit={(e) => {
                e.preventDefault();
                void runPreview();
              }}
            >
              <p className="text-sm font-semibold text-neutral-700">{ACTION_LABELS[action]}</p>
              {SINGLE_VISIT_ACTIONS.includes(action) && occurrenceById.get(occurrenceId) ? (
                <p className="text-sm text-neutral-600">Visit on {formatLocalDate(occurrenceById.get(occurrenceId)!.localDate)}</p>
              ) : null}
              {action === "reschedule_occurrence" ? (
                <label className="block text-xs font-semibold text-neutral-500">
                  New date
                  <input type="date" className={inputClass} value={localDate} onChange={(e) => (setLocalDate(e.target.value), setPreview(null))} required />
                </label>
              ) : null}
              {action === "reschedule_future" ? (
                <label className="block text-xs font-semibold text-neutral-500">
                  New visit time ({series.timeZone})
                  <input type="time" className={inputClass} value={localTime} onChange={(e) => (setLocalTime(e.target.value), setPreview(null))} required />
                </label>
              ) : null}
              <label className="block text-xs font-semibold text-neutral-500">
                Reason
                <textarea
                  className={`${inputClass} min-h-20`}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => (setReason(e.target.value), setPreview(null))}
                  placeholder="e.g. Homeowner is away for the winter; resume before the spring AC tune-up"
                  required
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryButton} onClick={() => resetForm(null)} disabled={pending}>
                  Back
                </button>
                <button type="submit" className={secondaryButton} disabled={!canPreview}>
                  {previewMutation.isPending ? "Previewing…" : "Preview changes"}
                </button>
              </div>
            </form>
          ) : null}

          {preview ? (
            <div className="mt-5 rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-4" data-testid="series-preview">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">What will change</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {preview.response.preview.series.before.status !== preview.response.preview.series.after.status ? (
                  <li>
                    Plan: {seriesStatusLabel(preview.response.preview.series.before.status)} → {seriesStatusLabel(preview.response.preview.series.after.status)}
                  </li>
                ) : null}
                {preview.response.preview.series.before.localTime !== preview.response.preview.series.after.localTime ? (
                  <li>
                    Visit time: {formatLocalTime(preview.response.preview.series.before.localTime)} → {formatLocalTime(preview.response.preview.series.after.localTime)}
                  </li>
                ) : null}
                {preview.response.preview.occurrences.map((d) => (
                  <li key={d.occurrenceId}>
                    Visit {formatLocalDate(d.before.localDate)} {formatTimeInZone(d.before.scheduledAtUtc, tz)} →{" "}
                    {d.after.status !== d.before.status
                      ? occurrenceStatusLabel(d.after.status)
                      : `${formatLocalDate(d.after.localDate)} ${formatTimeInZone(d.after.scheduledAtUtc, tz)}`}
                  </li>
                ))}
                {preview.response.preview.occurrences.length === 0 && preview.response.preview.series.before.status === preview.response.preview.series.after.status && preview.response.preview.series.before.localTime === preview.response.preview.series.after.localTime ? (
                  <li>No visits change.</li>
                ) : null}
              </ul>
              {preview.response.preview.exceptions.length > 0 ? (
                <div className="mt-3 text-sm text-neutral-700" data-testid="series-preview-exceptions">
                  <p className="flex items-center gap-2 font-semibold">
                    <UserRound className="h-4 w-4" /> Needs a person
                  </p>
                  <ul className="mt-1 space-y-1">
                    {preview.response.preview.exceptions.map((x) => (
                      <li key={x.occurrenceId}>
                        Visit on {formatLocalDate(occurrenceById.get(x.occurrenceId)?.localDate ?? "")} already has a{" "}
                        <Link className="font-semibold underline" href={`/jobs/${x.jobId}`}>
                          job
                        </Link>
                        , so it won&apos;t be changed. It will be flagged for a person.
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-neutral-500">Nothing changes until you apply. No message is sent to the customer.</p>
              <div className="mt-3 flex justify-end">
                <button type="button" className={primaryButton} onClick={() => void apply()} disabled={pending}>
                  {applyMutation.isPending ? "Applying…" : "Apply changes"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div role="alert" data-testid="series-error" className="rounded-3xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>{error.message}</p>
              {error.jobId ? (
                <Link className="font-semibold underline" href={`/jobs/${error.jobId}`}>
                  Open the job
                </Link>
              ) : null}
              {error.reload ? (
                <button type="button" className={secondaryButton} onClick={() => void reload()}>
                  <RotateCcw className="h-4 w-4" /> Reload plan
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-3xl border border-success/20 bg-success-light px-4 py-3 text-sm text-neutral-700">
          {notice}
        </p>
      ) : null}

      {data && data.openExceptions.length > 0 ? (
        <section className="surface-card px-6 py-6" data-testid="series-open-exceptions">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900">
            <UserRound className="h-4 w-4 text-brand-accent" /> Needs a person
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {data.openExceptions.map((x) => (
              <li key={`${x.occurrenceId}-${x.recordedAt}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                Visit on {formatLocalDate(occurrenceById.get(x.occurrenceId)?.localDate ?? "")} has a job and wasn&apos;t changed by &quot;{ACTION_LABELS[x.action as SeriesAction] ?? x.action}&quot;.{" "}
                <Link className="font-semibold underline" href={`/jobs/${x.jobId}`}>
                  Open the job
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data ? (
        <section className="surface-card px-6 py-6" aria-labelledby="series-visits-title">
          <h2 id="series-visits-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900">
            <CalendarClock className="h-4 w-4 text-brand-accent" /> Visits
          </h2>
          {data.occurrences.length === 0 ? <p className="mt-3 text-sm text-neutral-500">No visits generated yet.</p> : null}
          <ul className="mt-3 divide-y divide-neutral-200" data-testid="series-visits">
            {data.occurrences.map((o) => {
              const changeable = actions.length > 0 && isChangeableOccurrence(o, now);
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-neutral-800">
                      {formatLocalDate(o.localDate)} · {formatTimeInZone(o.scheduledAtUtc, tz)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {occurrenceStatusLabel(o.status)}
                      {o.jobId ? (
                        <>
                          {" · "}
                          <Link className="underline" href={`/jobs/${o.jobId}`}>
                            Has a job — change it from the job
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {changeable ? (
                    <div className="flex gap-2">
                      <button type="button" className={secondaryButton} disabled={pending} onClick={() => resetForm("skip_occurrence", o)}>
                        Skip
                      </button>
                      <button type="button" className={secondaryButton} disabled={pending} onClick={() => resetForm("reschedule_occurrence", o)}>
                        Move
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data && data.history.length > 0 ? (
        <section className="surface-card px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Recent changes</p>
          <ul className="mt-2 space-y-2" data-testid="series-history">
            {data.history.slice(0, 10).map((h) => (
              <li key={h.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <span className="font-semibold">{ACTION_LABELS[h.action]}</span>
                <span className="text-neutral-500"> · {h.reason}</span>
                <span className="block text-xs text-neutral-400">{new Date(h.occurredAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
