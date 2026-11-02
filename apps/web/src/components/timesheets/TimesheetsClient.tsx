"use client";

import { useEffect, useState } from "react";
import { Clock, Download, FileClock, Lock, Users } from "lucide-react";
import type { TimeEntryV1, TimesheetV1, UpdateTimeEntryBody } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useTechnicians } from "@/src/hooks/technicians.hooks";
import {
  ENTRY_LIMIT,
  TIMESHEET_STATUS_LABEL,
  fetchPayrollCsv,
  isConflict,
  payrollCsvFileName,
  useCreateTimesheet,
  usePayrollSummary,
  useTimeEntries,
  useTimesheetAction,
  useTimesheets,
  useUpdateTimeEntry,
  type PeriodInput,
  type TimesheetAction
} from "@/src/hooks/timesheets.hooks";
import { cn } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";
import { showToast } from "@/src/stores/toast.store";

/** API page sizes; when a cap is hit the UI says so instead of silently truncating. */
const TECH_LIMIT = 100;

const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher", "office"]);
const PAYROLL_ROLES = new Set(["owner", "admin"]);

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Current Monday-Sunday week as the default pay period. */
export function currentWeekPeriod(now = new Date()): PeriodInput {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { periodStart: ymd(start), periodEnd: ymd(end) };
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "In progress";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

const formatCents = (cents: number | null) => (cents === null ? "—" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${ymd(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS_TONE: Record<TimesheetV1["status"], string> = {
  open: "bg-neutral-100 text-neutral-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700"
};

function conflictOrError(error: unknown, fallback: string) {
  const description = isConflict(error) ? "Refresh and try again. Approved periods are read-only." : error instanceof Error ? error.message : null;
  showToast({ tone: "error", title: isConflict(error) ? "This record changed or is locked" : fallback, ...(description ? { description } : {}) });
}

function EntryRow({ entry }: { entry: TimeEntryV1 }) {
  const update = useUpdateTimeEntry();
  const [editing, setEditing] = useState(false);
  const [startedAt, setStartedAt] = useState(toLocalInput(entry.startedAt));
  const [endedAt, setEndedAt] = useState(entry.endedAt ? toLocalInput(entry.endedAt) : "");
  const [notes, setNotes] = useState(entry.notes ?? "");

  const endBeforeStart = Boolean(startedAt && endedAt) && new Date(endedAt).getTime() <= new Date(startedAt).getTime();

  const save = () => {
    if (endBeforeStart) return;
    // Send only changed fields so untouched start/end keep their original seconds
    // (datetime-local inputs are minute precision). The PATCH schema allows any subset.
    const initialStart = toLocalInput(entry.startedAt);
    const initialEnd = entry.endedAt ? toLocalInput(entry.endedAt) : "";
    const nextNotes = notes.trim() ? notes.trim() : null;
    const body: UpdateTimeEntryBody = {
      ...(startedAt !== initialStart ? { startedAt: new Date(startedAt).toISOString() } : {}),
      ...(endedAt !== initialEnd ? { endedAt: endedAt ? new Date(endedAt).toISOString() : null } : {}),
      ...(nextNotes !== (entry.notes ?? null) ? { notes: nextNotes } : {}),
      recordVersion: entry.recordVersion
    };
    if (Object.keys(body).length === 1) {
      setEditing(false);
      return;
    }
    update.mutate(
      {
        id: entry.id,
        body
      },
      {
        onSuccess: () => {
          setEditing(false);
          showToast({ tone: "success", title: "Time entry updated" });
        },
        onError: (error) => conflictOrError(error, "Could not update time entry")
      }
    );
  };

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white px-4 py-3" data-testid={`time-entry-${entry.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {formatDateTime(entry.startedAt)} – {entry.endedAt ? formatDateTime(entry.endedAt) : "now"}
          </p>
          <p className="text-xs text-neutral-500">
            {entry.entryType.replace("_", " ")} · {formatMinutes(entry.durationMinutes)}
            {entry.notes ? ` · ${entry.notes}` : ""}
          </p>
        </div>
        {entry.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
            <Lock className="h-3 w-3" aria-hidden="true" /> Locked
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        )}
      </div>
      {editing && !entry.locked ? (
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-xs font-medium text-neutral-600">
            Start
            <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-neutral-600">
            End
            <input
              type="datetime-local"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              aria-invalid={endBeforeStart}
              aria-describedby={endBeforeStart ? `end-error-${entry.id}` : undefined}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          {endBeforeStart ? (
            <p id={`end-error-${entry.id}`} role="alert" className="text-xs text-red-700 sm:col-span-full">
              End must be after start.
            </p>
          ) : null}
          <label className="text-xs font-medium text-neutral-600">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={save}
              disabled={update.isPending || endBeforeStart}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function TimesheetRow({ sheet, canManage, canReopen }: { sheet: TimesheetV1; canManage: boolean; canReopen: boolean }) {
  const action = useTimesheetAction();
  const [reason, setReason] = useState("");
  const needsReason = sheet.status === "submitted" || sheet.status === "approved";

  const run = (kind: TimesheetAction) => {
    if ((kind === "reject" || kind === "reopen") && !reason.trim()) {
      showToast({ tone: "error", title: "Add a reason first" });
      return;
    }
    action.mutate(
      { id: sheet.id, action: kind, recordVersion: sheet.recordVersion, ...(kind === "reject" || kind === "reopen" ? { reason: reason.trim() } : {}) },
      {
        onSuccess: () => showToast({ tone: "success", title: `Timesheet ${kind === "submit" ? "submitted" : `${kind}ed`.replace("eed", "ed")}` }),
        onError: (error) => conflictOrError(error, "Could not update timesheet")
      }
    );
  };

  const btn = "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-50";
  return (
    <li className="rounded-2xl border border-neutral-200 bg-white px-4 py-3" data-testid={`timesheet-${sheet.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-neutral-900">
            {sheet.periodStart} → {sheet.periodEnd}
          </p>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_TONE[sheet.status])}>{TIMESHEET_STATUS_LABEL[sheet.status]}</span>
          {sheet.status === "approved" ? <span className="text-xs text-neutral-500">Read-only</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheet.status === "open" || sheet.status === "rejected" ? (
            <button type="button" className={btn} disabled={action.isPending} onClick={() => run("submit")}>
              Submit
            </button>
          ) : null}
          {sheet.status === "submitted" && canManage ? (
            <>
              <button type="button" className={btn} disabled={action.isPending} onClick={() => run("approve")}>
                Approve
              </button>
              <button type="button" className={btn} disabled={action.isPending} onClick={() => run("reject")}>
                Reject
              </button>
            </>
          ) : null}
          {sheet.status === "approved" && canReopen ? (
            <button type="button" className={btn} disabled={action.isPending} onClick={() => run("reopen")}>
              Reopen
            </button>
          ) : null}
        </div>
      </div>
      {sheet.rejectionReason ? <p className="mt-2 text-xs text-red-700">Rejected: {sheet.rejectionReason}</p> : null}
      {needsReason && (sheet.status === "submitted" ? canManage : canReopen) ? (
        <input
          aria-label="Reason"
          placeholder={sheet.status === "approved" ? "Reason to reopen" : "Reason if rejecting"}
          value={reason}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
        />
      ) : null}
    </li>
  );
}

function PayrollSection({ period }: { period: PeriodInput }) {
  const summary = usePayrollSummary(period, true);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await fetchPayrollCsv(period);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payrollCsvFileName(period);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      conflictOrError(error, "Payroll export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm" aria-label="Payroll">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Payroll</h2>
          <p className="text-sm text-neutral-500">Approved hours only, with regular and overtime totals.</p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting || !summary.data}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {summary.isLoading ? (
        <SkeletonCard className="h-32" />
      ) : summary.isError ? (
        <ErrorState compact title="Couldn't load payroll" onRetry={() => void summary.refetch()} isRetrying={summary.isFetching} />
      ) : !summary.data || summary.data.summary.lines.length === 0 ? (
        <EmptyState compact icon={FileClock} title="No approved hours" subtitle="Approve timesheets for this period to see payroll totals." />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-2">Technician</th>
              <th>Regular</th>
              <th>Overtime</th>
              <th>Gross pay</th>
            </tr>
          </thead>
          <tbody>
            {summary.data.summary.lines.map((line) => (
              <tr key={line.technicianId} className="border-t border-neutral-100">
                <td className="py-2 font-medium text-neutral-900">{line.technicianName}</td>
                <td>{formatMinutes(line.regularMinutes)}</td>
                <td>{formatMinutes(line.overtimeMinutes)}</td>
                <td>{line.missingPayRate ? <span className="text-amber-700">Missing pay rate</span> : formatCents(line.grossPayCents)}</td>
              </tr>
            ))}
            <tr className="border-t border-neutral-200 font-semibold">
              <td className="py-2">Total</td>
              <td>{formatMinutes(summary.data.summary.totals.regularMinutes)}</td>
              <td>{formatMinutes(summary.data.summary.totals.overtimeMinutes)}</td>
              <td>{formatCents(summary.data.summary.totals.grossPayCents)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

export function TimesheetsClient() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const canManage = role !== null && MANAGER_ROLES.has(role);
  const canPayroll = role !== null && PAYROLL_ROLES.has(role);
  const [period, setPeriod] = useState<PeriodInput>(() => currentWeekPeriod());
  const technicians = useTechnicians({ status: "active", page: 1, limit: TECH_LIMIT, sortBy: "firstName", sortOrder: "asc" });
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const techList = technicians.data?.data ?? [];
  const techTotal = technicians.data?.total ?? techList.length;

  useEffect(() => {
    const first = techList[0];
    if (!technicianId && first) setTechnicianId(first.id);
  }, [technicianId, techList]);

  const entries = useTimeEntries(technicianId, period);
  const sheets = useTimesheets(technicianId, period);
  const createSheet = useCreateTimesheet();
  const hasSheetForPeriod = (sheets.data?.timesheets ?? []).some((s) => s.periodStart === period.periodStart && s.periodEnd === period.periodEnd);

  const startSheet = () => {
    if (!technicianId) return;
    createSheet.mutate(
      { technicianId, ...period },
      {
        onSuccess: () => showToast({ tone: "success", title: "Timesheet created" }),
        onError: (error) => conflictOrError(error, "Could not create timesheet")
      }
    );
  };

  const field = "rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm";
  return (
    <PageLayout
      title="Timesheets"
      subtitle="Review technician time, approve pay periods, and export payroll."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-neutral-600">
            <span className="sr-only">Technician</span>
            <select aria-label="Technician" className={field} value={technicianId ?? ""} onChange={(e) => setTechnicianId(e.target.value || null)} disabled={techList.length === 0}>
              {techList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </label>
          <input aria-label="Period start" type="date" className={field} value={period.periodStart} onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, periodStart: e.target.value }))} />
          <input aria-label="Period end" type="date" className={field} value={period.periodEnd} onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, periodEnd: e.target.value }))} />
        </div>
      }
    >
      {technicians.isLoading ? (
        <SkeletonCard className="h-40" />
      ) : technicians.isError ? (
        <ErrorState title="Couldn't load technicians" onRetry={() => void technicians.refetch()} isRetrying={technicians.isFetching} />
      ) : techList.length === 0 ? (
        <EmptyState icon={Users} title="No active technicians" subtitle="Add a technician to start tracking time." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {techTotal > techList.length ? (
            <p role="status" data-testid="techs-cap-notice" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 lg:col-span-2">
              Showing the first {techList.length} of {techTotal} active technicians in the picker.
            </p>
          ) : null}
          <section className="space-y-3 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm" aria-label="Time entries">
            <h2 className="text-base font-semibold text-neutral-900">Time entries</h2>
            {entries.isLoading ? (
              <SkeletonCard className="h-32" />
            ) : entries.isError ? (
              <ErrorState compact title="Couldn't load time entries" onRetry={() => void entries.refetch()} isRetrying={entries.isFetching} />
            ) : (entries.data?.entries ?? []).length === 0 ? (
              <EmptyState compact icon={Clock} title="No time entries" subtitle="No time was logged for this technician in this period." />
            ) : (
              <>
                {entries.data!.hasMore ? (
                  <p role="status" data-testid="entries-cap-notice" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Showing the first {ENTRY_LIMIT} entries. Narrow the date range to see the rest.
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {entries.data!.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              </>
            )}
          </section>
          <section className="space-y-3 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm" aria-label="Pay periods">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">Pay periods</h2>
              {!sheets.isLoading && !sheets.isError && !hasSheetForPeriod ? (
                <button type="button" onClick={startSheet} disabled={createSheet.isPending} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-50">
                  Start timesheet
                </button>
              ) : null}
            </div>
            {sheets.isLoading ? (
              <SkeletonCard className="h-32" />
            ) : sheets.isError ? (
              <ErrorState compact title="Couldn't load timesheets" onRetry={() => void sheets.refetch()} isRetrying={sheets.isFetching} />
            ) : (sheets.data?.timesheets ?? []).length === 0 ? (
              <EmptyState compact icon={FileClock} title="No timesheets" subtitle="Start a timesheet for this period to submit it for approval." />
            ) : (
              <ul className="space-y-2">
                {sheets.data!.timesheets.map((sheet) => (
                  <TimesheetRow key={sheet.id} sheet={sheet} canManage={canManage} canReopen={canPayroll} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {canPayroll ? <PayrollSection period={period} /> : null}
    </PageLayout>
  );
}
