"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Flag, RotateCcw, XCircle } from "lucide-react";

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

// Figma 367:4217 / 367:4365 / 367:4496 (Operator / 04c Job detail · Reschedule, cancel, flag) styles.
const ring = "outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2";
const inputBase = "mt-1.5 block w-full rounded-[8px] border bg-white px-3 text-sm text-[#0f1530] outline-none placeholder:text-[#5e6684] focus:border-[#0f1530]";
const inputClass = `${inputBase} h-11 border-[#e6dccb]`;
const inputError = `${inputBase} h-11 border-[#b42318]`;
const labelClass = "block text-[13px] font-medium text-[#2a3360]";
const cardClass = "space-y-3.5 rounded-[14px] border border-[#e6dccb] bg-white p-5";
const secondaryButton = `inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;
const fullButton = "w-full md:h-12 lg:h-11";
const darkButton = `inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;
const dangerButton = `inline-flex h-11 items-center justify-center rounded-[10px] bg-[#b42318] px-[18px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${ring}`;
const PILL = { error: "bg-[#fbe3dc] text-[#b42318]", success: "bg-[#e4f1e8] text-[#2f7d4f]", info: "bg-[#e5eafb] text-[#2b4acb]" } as const;
function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`inline-flex h-[22px] w-fit shrink-0 items-center rounded-full px-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${PILL[tone]}`}>{children}</span>;
}
/** "First sentence. Rest." -> [title, detail], matching the Figma alert title/detail split. */
function splitMessage(message: string): [string, string | null] {
  const i = message.indexOf(". ");
  return i === -1 ? [message, null] : [message.slice(0, i + 1), message.slice(i + 2)];
}
const ERROR_PILL: Record<string, string> = { conflict: "Conflict", idempotency: "Conflict", stale: "Stale" };

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
  const [fieldError, setFieldError] = useState<{ field: "end" | "delay"; message: string } | null>(null);

  const schedule = scheduleQuery.data?.schedule ?? null;

  useEffect(() => {
    setIdempotencyKey(newIdempotencyKey());
    setError(null);
    setFieldError(null);
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
    setFieldError(null);
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
    if (new Date(e) <= new Date(s)) return setFieldError({ field: "end", message: "End time must be after the start time." });
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
      return setFieldError({ field: "delay", message: "Delay must be between 1 and 480 minutes." });
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
    <section className="surface-card space-y-4 px-5 py-6 md:space-y-5 md:px-6" aria-labelledby="schedule-changes-title" data-testid="schedule-changes-panel">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Job / Schedule changes</p>
        <h2 id="schedule-changes-title" className="text-2xl font-semibold tracking-tight text-[#0f1530] md:text-[28px] lg:text-[30px]">
          Change this visit
        </h2>
        <p className="text-[15px] text-[#5e6684]">Reschedule, cancel or flag a visit. The customer is never messaged automatically.</p>
      </header>
      <div className="border-t border-[#e6dccb]" />

      {scheduleQuery.isLoading ? <p className="text-sm text-[#5e6684]">Loading schedule…</p> : null}
      {scheduleQuery.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[#fbe3dc] p-3.5 text-sm font-semibold text-[#b42318]" role="alert">
          <span>Schedule couldn&apos;t be loaded.</span>
          <button type="button" className={secondaryButton} onClick={() => void reload()}>
            <RotateCcw className="h-4 w-4" /> Reload
          </button>
        </div>
      ) : null}

      {schedule ? (
        <>
          <div className="flex flex-wrap items-center gap-2.5" data-testid="schedule-context">
            <Pill tone="info">{schedule.status.replace(/_/g, " ")}</Pill>
            <p className="text-[13px] text-[#2a3360]">
              {formatWhen(schedule.scheduledStart)}
              {schedule.scheduledEnd ? ` – ${new Date(schedule.scheduledEnd).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          </div>

          {mode === null ? (
            <div className="flex flex-wrap gap-2">
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
            <p id="cancel-blocked" className="text-[12.5px] text-[#5e6684]">
              {blockedCancel}
            </p>
          ) : null}

          {mode === "reschedule" ? (
            <form className={cardClass} onSubmit={(e) => (e.preventDefault(), submitReschedule())} aria-labelledby="reschedule-title">
              <h3 id="reschedule-title" className="text-[17px] font-semibold text-[#0f1530]">Reschedule visit</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Start
                  <input type="datetime-local" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} required />
                </label>
                <label className={labelClass}>
                  End
                  <input
                    type="datetime-local"
                    className={fieldError?.field === "end" ? inputError : inputClass}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    aria-invalid={fieldError?.field === "end" || undefined}
                    aria-describedby={fieldError?.field === "end" ? "end-error" : undefined}
                    required
                  />
                </label>
              </div>
              {fieldError?.field === "end" ? (
                <p id="end-error" role="alert" className="text-[12.5px] text-[#b42318]">{fieldError.message}</p>
              ) : null}
              <label className={labelClass}>
                Technician
                <select className={inputClass} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                  <option value="">{schedule.technicianId ? "Keep current technician" : "Unassigned"}</option>
                  {(technicians.data?.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{`${t.firstName} ${t.lastName}`.trim()}</option>
                  ))}
                </select>
              </label>
              <ReasonField label="Note" value={reason} onChange={setReason} placeholder="e.g. Customer asked to move the furnace tune-up to Thursday" />
              <FormActions pending={pending} submitLabel="Save new time" submitClass={darkButton} disabled={!reason.trim()} onBack={() => onModeChange(null)} />
            </form>
          ) : null}

          {mode === "cancel" ? (
            <form className={cardClass} onSubmit={(e) => (e.preventDefault(), submitCancel())} aria-labelledby="cancel-title">
              <h3 id="cancel-title" className="text-[17px] font-semibold text-[#0f1530]">Cancel visit</h3>
              {blockedCancel ? <p className="text-sm text-[#2a3360]">{blockedCancel}</p> : null}
              <ReasonField label="Why is this visit being cancelled?" value={reason} onChange={setReason} placeholder="e.g. Customer replaced the water heater themselves" />
              <p className="text-[12.5px] text-[#5e6684]">The customer is not messaged automatically.</p>
              <FormActions pending={pending} submitLabel="Cancel visit" submitClass={dangerButton} disabled={!reason.trim() || Boolean(blockedCancel)} onBack={() => onModeChange(null)} />
            </form>
          ) : null}

          {mode === "flag" ? (
            <form className={cardClass} onSubmit={(e) => (e.preventDefault(), submitFlag())} aria-labelledby="flag-title">
              <h3 id="flag-title" className="text-[17px] font-semibold text-[#0f1530]">Flag a problem</h3>
              <fieldset className="space-y-0.5">
                <legend className={labelClass}>Reason</legend>
                {SCHEDULE_EXCEPTION_KINDS.map((k) => (
                  <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#0f1530] ${kind === k ? "font-semibold" : ""}`}>
                    <input
                      type="radio"
                      name="schedule-exception-kind"
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                      className="h-5 w-5 accent-[#0f1530]"
                    />
                    {EXCEPTION_LABELS[k]}
                  </label>
                ))}
              </fieldset>
              {kind === "late_staff" || kind === "parts_delay" ? (
                <div>
                  <label className={labelClass}>
                    Delay (minutes)
                    <input
                      type="number"
                      min={1}
                      max={480}
                      className={fieldError?.field === "delay" ? inputError : inputClass}
                      value={delay}
                      onChange={(e) => setDelay(e.target.value)}
                      aria-invalid={fieldError?.field === "delay" || undefined}
                      aria-describedby="delay-help"
                    />
                  </label>
                  {fieldError?.field === "delay" ? (
                    <p id="delay-help" role="alert" className="mt-1.5 text-[12.5px] text-[#b42318]">{fieldError.message}</p>
                  ) : (
                    <p id="delay-help" className="mt-1.5 text-[12.5px] text-[#5e6684]">1–480 minutes</p>
                  )}
                </div>
              ) : null}
              <ReasonField label="Note" value={reason} onChange={setReason} placeholder="e.g. Ray is 40 minutes behind after the panel upgrade ran long" max={1000} />
              <p className="rounded-[10px] bg-[#eef0f5] p-3.5 text-sm font-semibold text-[#0f1530]">This flags the visit for a person to follow up. It doesn&apos;t move the visit.</p>
              <FormActions pending={pending} submitLabel="Flag for a person" submitClass={secondaryButton} disabled={!reason.trim()} onBack={() => onModeChange(null)} />
            </form>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <Pill tone="error">{ERROR_PILL[error.kind] ?? "Error"}</Pill>
          <div role="alert" data-testid="schedule-error" className="space-y-1.5 rounded-[10px] bg-[#fbe3dc] p-3.5 text-[#b42318]">
            {(() => {
              const [title, detail] = splitMessage(error.message);
              return (
                <>
                  <p className="text-sm font-semibold">{title}</p>
                  {detail ? <p className="text-[13px]">{detail}</p> : null}
                </>
              );
            })()}
            {error.conflictJobId ? (
              <a className="block text-[13px] font-semibold underline" href={`/jobs/${error.conflictJobId}`}>
                View the other visit
              </a>
            ) : null}
            {error.reload ? (
              <div className="pt-1">
                <button type="button" className={`${secondaryButton} lg:h-10`} onClick={() => void reload()}>
                  Reload schedule
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="space-y-2">
          <Pill tone="success">Done</Pill>
          <p role="status" className="rounded-[10px] bg-[#e4f1e8] p-3.5 text-sm font-semibold text-[#0f1530]">
            {notice}
          </p>
        </div>
      ) : null}

      {scheduleQuery.data && scheduleQuery.data.history.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Recent changes</p>
          <ul className="mt-2 space-y-2" data-testid="schedule-history">
            {scheduleQuery.data.history.slice(0, 5).map((c) => (
              <li key={c.id} className="rounded-[10px] border border-[#e6dccb] bg-white px-3 py-2 text-sm text-[#2a3360]">
                <span className="font-semibold text-[#0f1530]">{describeChange(c)}</span>
                {c.reason ? <span className="text-[#5e6684]"> · {c.reason}</span> : null}
                <span className="block text-[12.5px] text-[#5e6684]">{formatWhen(c.occurredAt)}</span>
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
    <label className={labelClass}>
      {label}
      <textarea className={`${inputBase} h-[88px] border-[#e6dccb] py-3`} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required />
    </label>
  );
}

function FormActions({ pending, submitLabel, submitClass, disabled, onBack }: { pending: boolean; submitLabel: string; submitClass: string; disabled: boolean; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button type="submit" className={`${submitClass} ${fullButton}`} disabled={pending || disabled}>
        {pending ? "Saving…" : submitLabel}
      </button>
      <button type="button" className={`${secondaryButton} ${fullButton}`} onClick={onBack} disabled={pending}>
        Back
      </button>
    </div>
  );
}
