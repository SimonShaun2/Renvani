"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Flag, RotateCcw, XCircle } from "lucide-react";

import { useTechnicians } from "@/src/hooks/technicians.hooks";
import { useCancelJobVisit, useFlagScheduleException, useJobSchedule, useRescheduleJob } from "@/src/hooks/scheduling-changes.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { SCHEDULE_EXCEPTION_KINDS, type ScheduleExceptionKind } from "./schedule-changes.types";
import {
  EXCEPTION_LABELS,
  canChangeStatus,
  canFlagStatus,
  canManageSchedule,
  cancelBlockedReason,
  describeChange,
  describeScheduleError,
  fromLocalInputValue,
  newIdempotencyKey,
  toLocalInputValue,
  type ScheduleErrorView
} from "./schedule-changes.utils";

export type ScheduleChangeMode = "reschedule" | "cancel" | "flag" | null;

interface Props {
  jobId: string;
  mode: ScheduleChangeMode;
  onModeChange: (mode: ScheduleChangeMode) => void;
  now?: Date;
}

const inputClass =
  "mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-brand-accent";
const secondaryButton =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButton =
  "inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60";

const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled";

/** FS-24: reschedule, cancel, or flag a problem on a visit. Owner/admin/dispatcher only (matches the API). */
export function JobScheduleChangesPanel({ jobId, mode, onModeChange, now }: Props) {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const allowed = canManageSchedule(role);
  const scheduleQuery = useJobSchedule(jobId, allowed);
  const technicians = useTechnicians({ status: "active", page: 1, limit: 100, sortBy: "firstName", sortOrder: "asc", enabled: allowed && mode === "reschedule" });
  const reschedule = useRescheduleJob(jobId);
  const cancel = useCancelJobVisit(jobId);
  const flag = useFlagScheduleException(jobId);

  // One key per open form, kept across retries so a double submit can't apply twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<ScheduleErrorView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<ScheduleExceptionKind>("late_staff");
  const [delay, setDelay] = useState("");

  const schedule = scheduleQuery.data?.schedule ?? null;

  useEffect(() => {
    setIdempotencyKey(newIdempotencyKey());
    setError(null);
    setReason("");
    setDelay("");
    if (mode === "reschedule" && schedule) {
      setStart(toLocalInputValue(schedule.scheduledStart));
      setEnd(toLocalInputValue(schedule.scheduledEnd));
      setTechnicianId(schedule.technicianId ?? "");
    }
    // Reset only when the form opens or closes.
  }, [mode]);

  if (!allowed) return null;

  const pending = reschedule.isPending || cancel.isPending || flag.isPending;
  const blockedCancel = schedule ? cancelBlockedReason(role, schedule.scheduledStart, now) : null;
  const changeable = schedule ? canChangeStatus(schedule.status) : false;
  const flaggable = schedule ? canFlagStatus(schedule.status) : false;

  async function reload() {
    setError(null);
    setIdempotencyKey(newIdempotencyKey());
    await scheduleQuery.refetch();
  }

  async function run(action: () => Promise<{ replayed: boolean }>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
      onModeChange(null);
    } catch (err) {
      setError(describeScheduleError(err));
    }
  }

  function submitReschedule() {
    if (!schedule) return;
    const s = fromLocalInputValue(start);
    const e = fromLocalInputValue(end);
    if (!s || !e) return setError({ kind: "validation", message: "Pick a start and end time.", reload: false });
    if (new Date(e) <= new Date(s)) return setError({ kind: "validation", message: "End time must be after the start time.", reload: false });
    void run(
      () =>
        reschedule.mutateAsync({
          expectedVersion: schedule.scheduleVersion,
          idempotencyKey,
          scheduledStart: s,
          scheduledEnd: e,
          ...(technicianId && technicianId !== schedule.technicianId ? { technicianId } : {}),
          reason: reason.trim()
        }),
      "Visit rescheduled. The customer has not been messaged."
    );
  }

  function submitCancel() {
    if (!schedule) return;
    void run(
      () => cancel.mutateAsync({ expectedVersion: schedule.scheduleVersion, idempotencyKey, reason: reason.trim() }),
      "Visit cancelled. The customer has not been messaged."
    );
  }

  function submitFlag() {
    if (!schedule) return;
    const minutes = delay ? Number(delay) : undefined;
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > 480)) {
      return setError({ kind: "validation", message: "Delay must be between 1 and 480 minutes.", reload: false });
    }
    void run(
      () =>
        flag.mutateAsync({
          expectedVersion: schedule.scheduleVersion,
          idempotencyKey,
          kind,
          note: reason.trim(),
          ...(minutes !== undefined ? { delayMinutes: minutes } : {})
        }),
      "Flagged for a person to follow up. The visit time hasn't changed."
    );
  }

  return (
    <section className="surface-card px-6 py-6" aria-labelledby="schedule-changes-title" data-testid="schedule-changes-panel">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-brand-accent" />
        <h2 id="schedule-changes-title" className="text-lg font-semibold tracking-tight text-neutral-900">
          Visit schedule
        </h2>
      </div>

      {scheduleQuery.isLoading ? <p className="mt-3 text-sm text-neutral-500">Loading schedule…</p> : null}
      {scheduleQuery.isError ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-error" role="alert">
          <span>Schedule couldn&apos;t be loaded.</span>
          <button type="button" className={secondaryButton} onClick={() => void reload()}>
            <RotateCcw className="h-4 w-4" /> Reload
          </button>
        </div>
      ) : null}

      {schedule ? (
        <>
          <p className="mt-3 text-sm text-neutral-700">
            {formatWhen(schedule.scheduledStart)}
            {schedule.scheduledEnd ? ` – ${new Date(schedule.scheduledEnd).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
          </p>

          {mode === null ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} disabled={!changeable || pending} onClick={() => onModeChange("reschedule")}>
                <CalendarClock className="h-4 w-4" /> Reschedule
              </button>
              <button type="button" className={secondaryButton} disabled={!flaggable || pending} onClick={() => onModeChange("flag")}>
                <Flag className="h-4 w-4" /> Flag a problem
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={!changeable || pending || Boolean(blockedCancel)}
                aria-describedby={blockedCancel ? "cancel-blocked" : undefined}
                onClick={() => onModeChange("cancel")}
              >
                <XCircle className="h-4 w-4" /> Cancel visit
              </button>
            </div>
          ) : null}
          {mode === null && blockedCancel && changeable ? (
            <p id="cancel-blocked" className="mt-2 text-xs text-neutral-500">
              {blockedCancel}
            </p>
          ) : null}

          {mode === "reschedule" ? (
            <form className="mt-4 space-y-3" onSubmit={(e) => (e.preventDefault(), submitReschedule())} aria-label="Reschedule visit">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-neutral-500">
                  Start
                  <input type="datetime-local" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} required />
                </label>
                <label className="text-xs font-semibold text-neutral-500">
                  End
                  <input type="datetime-local" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} required />
                </label>
              </div>
              <label className="block text-xs font-semibold text-neutral-500">
                Technician
                <select className={inputClass} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                  <option value="">{schedule.technicianId ? "Keep current technician" : "Unassigned"}</option>
                  {(technicians.data?.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{`${t.firstName} ${t.lastName}`.trim()}</option>
                  ))}
                </select>
              </label>
              <ReasonField label="Reason" value={reason} onChange={setReason} placeholder="e.g. Customer asked to move the furnace tune-up to Thursday" />
              <FormActions pending={pending} submitLabel="Save new time" disabled={!reason.trim()} onBack={() => onModeChange(null)} />
            </form>
          ) : null}

          {mode === "cancel" ? (
            <form className="mt-4 space-y-3" onSubmit={(e) => (e.preventDefault(), submitCancel())} aria-label="Cancel visit">
              {blockedCancel ? <p className="text-sm text-neutral-600">{blockedCancel}</p> : null}
              <ReasonField label="Why is this visit being cancelled?" value={reason} onChange={setReason} placeholder="e.g. Customer replaced the water heater themselves" />
              <FormActions pending={pending} submitLabel="Cancel visit" disabled={!reason.trim() || Boolean(blockedCancel)} onBack={() => onModeChange(null)} />
            </form>
          ) : null}

          {mode === "flag" ? (
            <form className="mt-4 space-y-3" onSubmit={(e) => (e.preventDefault(), submitFlag())} aria-label="Flag a problem">
              <p className="text-sm text-neutral-600">This flags the visit for a person to follow up. It doesn&apos;t move the visit.</p>
              <label className="block text-xs font-semibold text-neutral-500">
                What&apos;s wrong?
                <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ScheduleExceptionKind)}>
                  {SCHEDULE_EXCEPTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {EXCEPTION_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "late_staff" || kind === "parts_delay" ? (
                <label className="block text-xs font-semibold text-neutral-500">
                  Expected delay (minutes, optional)
                  <input type="number" min={1} max={480} className={inputClass} value={delay} onChange={(e) => setDelay(e.target.value)} />
                </label>
              ) : null}
              <ReasonField label="Note" value={reason} onChange={setReason} placeholder="e.g. Ray is 40 minutes behind after the panel upgrade ran long" max={1000} />
              <FormActions pending={pending} submitLabel="Flag for a person" disabled={!reason.trim()} onBack={() => onModeChange(null)} />
            </form>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div role="alert" data-testid="schedule-error" className="mt-4 rounded-3xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>{error.message}</p>
              {error.conflictJobId ? (
                <a className="font-semibold underline" href={`/jobs/${error.conflictJobId}`}>
                  View the other visit
                </a>
              ) : null}
              {error.reload ? (
                <button type="button" className={secondaryButton} onClick={() => void reload()}>
                  <RotateCcw className="h-4 w-4" /> Reload schedule
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="mt-4 rounded-3xl border border-success/20 bg-success-light px-4 py-3 text-sm text-neutral-700">
          {notice}
        </p>
      ) : null}

      {scheduleQuery.data && scheduleQuery.data.history.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Recent changes</p>
          <ul className="mt-2 space-y-2" data-testid="schedule-history">
            {scheduleQuery.data.history.slice(0, 5).map((c) => (
              <li key={c.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <span className="font-semibold">{describeChange(c)}</span>
                {c.reason ? <span className="text-neutral-500"> · {c.reason}</span> : null}
                <span className="block text-xs text-neutral-400">{formatWhen(c.occurredAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ReasonField({ label, value, onChange, placeholder, max = 500 }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; max?: number }) {
  return (
    <label className="block text-xs font-semibold text-neutral-500">
      {label}
      <textarea className={`${inputClass} min-h-20`} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required />
    </label>
  );
}

function FormActions({ pending, submitLabel, disabled, onBack }: { pending: boolean; submitLabel: string; disabled: boolean; onBack: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" className={secondaryButton} onClick={onBack} disabled={pending}>
        Back
      </button>
      <button type="submit" className={primaryButton} disabled={pending || disabled}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
