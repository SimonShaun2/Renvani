/**
 * FS-171 — timesheets & payroll service.
 *
 * Rules (documented in the PR body and packages/types timesheets/v1):
 * - Work date = startedAt in the company timezone. Workweek = Monday..Sunday (local).
 * - Paid minutes = closed travel + on_site entries; breaks are unpaid.
 * - Weekly overtime: minutes beyond the threshold (default 2400 = 40h) within a workweek,
 *   allocated chronologically (the minutes worked after the threshold is crossed).
 * - Pay = minutes x rate effective on the work date. Sums are kept exact and rounded once
 *   per technician per bucket (regular / overtime) to whole cents, half-up.
 * - Approved timesheets lock their entries for everyone; owner/admin must reopen (with reason).
 *   Submitted timesheets lock entries for technicians only.
 */
import { and, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";

import {
  companies,
  db,
  jobs,
  technicianPayRates,
  technicians,
  timeEntries,
  timesheetAuditEvents,
  timesheets,
  users
} from "@fsm/db";
import {
  AppError,
  buildRecordVersionV1,
  DEFAULT_OVERTIME_MULTIPLIER_BPS,
  DEFAULT_WEEKLY_OVERTIME_THRESHOLD_MINUTES,
  ErrorCode,
  TIMESHEETS_CONTRACT_VERSION,
  TIMESHEETS_LIST_DEFAULT_LIMIT,
  TIMESHEETS_LIST_MAX_LIMIT,
  type TimesheetsPageV1,
  type CanonicalEntityTypeV1,
  type ClockInBody,
  type ClockOutBody,
  type CreatePayRateBody,
  type CreateTimeEntryBody,
  type CreateTimesheetBody,
  type ListPayRatesQuery,
  type ListTimeEntriesQuery,
  type ListTimesheetsQuery,
  type PayRateV1,
  type PayrollLineV1,
  type PayrollQuery,
  type PayrollSummaryV1,
  type TimeEntryV1,
  type TimesheetAuditEventV1,
  type TimesheetStatus,
  type TimesheetTotalsV1,
  type TimesheetV1,
  type UpdateTimeEntryBody,
  type UserRole
} from "@fsm/types";

type EntryRow = typeof timeEntries.$inferSelect;
type SheetRow = typeof timesheets.$inferSelect;
type RateRow = typeof technicianPayRates.$inferSelect;
type Executor = Pick<typeof db, "select" | "insert" | "update">;

export interface TimesheetActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

export type TimesheetConflictReason =
  | "stale_record_version"
  | "overlapping_entry"
  | "open_entry_exists"
  | "no_open_entry"
  | "timesheet_locked"
  | "timesheet_submitted"
  | "overlapping_period"
  | "invalid_status"
  | "open_entries"
  | "duplicate_effective_date";

export class TimesheetConflictError extends Error {
  constructor(
    public readonly reason: TimesheetConflictReason,
    message: string,
    public readonly current: unknown
  ) {
    super(message);
  }
}

const MANAGER_ROLES: readonly string[] = ["owner", "admin", "dispatcher", "office"];
const PAYROLL_ROLES: readonly string[] = ["owner", "admin"];

const isManager = (actor: TimesheetActor) => MANAGER_ROLES.includes(actor.role);
const isPayrollAdmin = (actor: TimesheetActor) => PAYROLL_ROLES.includes(actor.role);

function forbidden(message = "You do not have access to this resource"): AppError {
  return new AppError(ErrorCode.FORBIDDEN, message);
}

// ── Pure helpers (exported for tests) ─────────

export function localDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

/** UTC instant of local midnight (company timezone) at the start of a YYYY-MM-DD day. */
export function localMidnightUtc(dateOnly: string, timeZone: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
  };
  let result = guess - offsetAt(guess);
  result = guess - offsetAt(result);
  return new Date(result);
}

function nextDay(dateOnly: string): string {
  const day = new Date(`${dateOnly}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

const OPEN_ENTRY_INDEX = "time_entries_open_technician_idx";

/** True for a Postgres unique violation (23505) on the one-open-entry-per-technician index. */
export function isOpenEntryUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; constraint_name?: unknown; message?: unknown };
    if (candidate.code === "23505") {
      const name = candidate.constraint ?? candidate.constraint_name;
      if (name === OPEN_ENTRY_INDEX) return true;
      if (name === undefined && typeof candidate.message === "string" && candidate.message.includes(OPEN_ENTRY_INDEX)) return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function guardOpenEntryInsert<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isOpenEntryUniqueViolation(error)) {
      throw new TimesheetConflictError("open_entry_exists", "Technician is already clocked in", null);
    }
    throw error;
  }
}

export function workweekStart(dateOnly: string): string {
  const day = new Date(`${dateOnly}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7; // Monday = 0
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

export function durationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

export interface PayrollWorkItem {
  workDate: string;
  startedAt: Date;
  minutes: number;
  /** Hourly rate in cents effective on workDate; null when none. */
  rateCents: number | null;
}

export interface OvertimeSplit {
  regularMinutes: number;
  overtimeMinutes: number;
  regularPayCents: number | null;
  overtimePayCents: number | null;
  missingPayRate: boolean;
}

export function splitWeeklyOvertime(
  items: PayrollWorkItem[],
  weeklyThresholdMinutes = DEFAULT_WEEKLY_OVERTIME_THRESHOLD_MINUTES,
  overtimeMultiplierBps = DEFAULT_OVERTIME_MULTIPLIER_BPS
): OvertimeSplit {
  const weekTotals = new Map<string, number>();
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let regularCentMinutes = 0;
  let overtimeCentMinutes = 0;
  let missingPayRate = false;

  const ordered = items.slice().sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  for (const item of ordered) {
    const week = workweekStart(item.workDate);
    const before = weekTotals.get(week) ?? 0;
    const regularPart = Math.max(0, Math.min(item.minutes, weeklyThresholdMinutes - before));
    const overtimePart = item.minutes - regularPart;
    weekTotals.set(week, before + item.minutes);
    regularMinutes += regularPart;
    overtimeMinutes += overtimePart;
    if (item.rateCents === null) {
      if (item.minutes > 0) missingPayRate = true;
      continue;
    }
    regularCentMinutes += regularPart * item.rateCents;
    overtimeCentMinutes += overtimePart * item.rateCents;
  }

  return {
    regularMinutes,
    overtimeMinutes,
    regularPayCents: missingPayRate ? null : Math.round(regularCentMinutes / 60),
    overtimePayCents: missingPayRate ? null : Math.round((overtimeCentMinutes * overtimeMultiplierBps) / 600_000),
    missingPayRate
  };
}

export function rateForDate(rates: Array<Pick<RateRow, "effectiveFrom" | "hourlyRateCents">>, workDate: string): number | null {
  let best: { effectiveFrom: string; hourlyRateCents: number } | null = null;
  for (const rate of rates) {
    if (rate.effectiveFrom <= workDate && (!best || rate.effectiveFrom > best.effectiveFrom)) {
      best = rate;
    }
  }
  return best ? best.hourlyRateCents : null;
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  let text = String(value);
  // Spreadsheet formula-injection guard.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const centsToDollars = (cents: number | null) => (cents === null ? null : (cents / 100).toFixed(2));
const minutesToHours = (minutes: number) => (minutes / 60).toFixed(2);

export function payrollToCsv(summary: PayrollSummaryV1): string {
  const header = [
    "period_start", "period_end", "technician_id", "technician_name", "regular_hours", "overtime_hours", "total_hours",
    "regular_minutes", "overtime_minutes", "hourly_rate", "regular_pay", "overtime_pay", "gross_pay", "missing_pay_rate"
  ];
  const rows = summary.lines.map((line) => [
    summary.periodStart, summary.periodEnd, line.technicianId, line.technicianName,
    minutesToHours(line.regularMinutes), minutesToHours(line.overtimeMinutes), minutesToHours(line.totalMinutes),
    line.regularMinutes, line.overtimeMinutes, centsToDollars(line.hourlyRateCents), centsToDollars(line.regularPayCents),
    centsToDollars(line.overtimePayCents), centsToDollars(line.grossPayCents), line.missingPayRate
  ]);
  return [header, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\r\n") + "\r\n";
}

// ── Mappers ───────────────────────────────────

const iso = (value: Date | null) => (value ? value.toISOString() : null);
const version = (type: CanonicalEntityTypeV1, id: string, updatedAt: Date) => buildRecordVersionV1(type, id, updatedAt);

function toTimesheetV1(row: SheetRow): TimesheetV1 {
  return {
    id: row.id,
    technicianId: row.technicianId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status as TimesheetStatus,
    submittedAt: iso(row.submittedAt),
    submittedById: row.submittedById,
    approvedAt: iso(row.approvedAt),
    approvedById: row.approvedById,
    rejectedAt: iso(row.rejectedAt),
    rejectedById: row.rejectedById,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: version("timesheet", row.id, row.updatedAt)
  };
}

function coveringSheet(sheets: SheetRow[], technicianId: string, workDate: string): SheetRow | null {
  return (
    sheets.find(
      (sheet) =>
        sheet.deletedAt === null &&
        sheet.technicianId === technicianId &&
        sheet.periodStart <= workDate &&
        sheet.periodEnd >= workDate
    ) ?? null
  );
}

function toTimeEntryV1(row: EntryRow, timeZone: string, sheets: SheetRow[]): TimeEntryV1 {
  const workDate = localDate(row.startedAt, timeZone);
  const sheet = coveringSheet(sheets, row.technicianId, workDate);
  return {
    id: row.id,
    technicianId: row.technicianId,
    jobId: row.jobId,
    startedAt: row.startedAt.toISOString(),
    endedAt: iso(row.endedAt),
    durationMinutes: row.durationMinutes,
    entryType: (row.entryType ?? "on_site") as TimeEntryV1["entryType"],
    notes: row.notes,
    workDate,
    timesheetStatus: sheet ? (sheet.status as TimesheetStatus) : null,
    locked: sheet?.status === "approved",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: version("time_entry", row.id, row.updatedAt)
  };
}

function toPayRateV1(row: RateRow): PayRateV1 {
  return {
    id: row.id,
    technicianId: row.technicianId,
    hourlyRateCents: row.hourlyRateCents,
    effectiveFrom: row.effectiveFrom,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: version("technician_pay_rate", row.id, row.updatedAt)
  };
}

function auditSnapshot(row: object | null): Record<string, unknown> | null {
  if (!row) return null;
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

// ── Lookups ───────────────────────────────────

async function companyTimezone(companyId: string, executor: Pick<typeof db, "select">): Promise<string> {
  const [company] = await executor.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return company?.timezone ?? "America/Chicago";
}

async function actorTechnicianId(actor: TimesheetActor, executor: Pick<typeof db, "select">): Promise<string | null> {
  const [user] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, actor.companyId), eq(users.id, actor.userId), isNull(users.deletedAt)))
    .limit(1);
  if (user?.technicianId) return user.technicianId;
  const [tech] = await executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, actor.companyId), eq(technicians.userId, actor.userId), isNull(technicians.deletedAt)))
    .limit(1);
  return tech?.id ?? null;
}

async function assertTechnician(companyId: string, technicianId: string, executor: Pick<typeof db, "select">) {
  const [tech] = await executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt)))
    .limit(1);
  if (!tech) throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
  return tech;
}

/** Technicians are pinned to themselves (403 if they name someone else); managers must name or be a technician. */
async function resolveTargetTechnician(
  actor: TimesheetActor,
  requested: string | undefined,
  executor: Pick<typeof db, "select">
): Promise<string> {
  if (!isManager(actor)) {
    const own = await actorTechnicianId(actor, executor);
    if (!own) throw forbidden("Your user is not linked to a technician");
    if (requested && requested !== own) throw forbidden("Technicians can only access their own time");
    return own;
  }
  const target = requested ?? (await actorTechnicianId(actor, executor));
  if (!target) throw new AppError(ErrorCode.VALIDATION_ERROR, "technicianId is required", { technicianId: "Required" });
  await assertTechnician(actor.companyId, target, executor);
  return target;
}

async function technicianEntries(companyId: string, technicianId: string, executor: Pick<typeof db, "select">) {
  return executor
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.technicianId, technicianId), isNull(timeEntries.deletedAt)));
}

async function companySheets(companyId: string, executor: Pick<typeof db, "select">, technicianId?: string) {
  const rows = await executor
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.companyId, companyId),
      technicianId ? eq(timesheets.technicianId, technicianId) : undefined,
      isNull(timesheets.deletedAt)
    ));
  return rows as SheetRow[];
}

async function getEntryForActor(actor: TimesheetActor, entryId: string, executor: Pick<typeof db, "select">): Promise<EntryRow> {
  const [entry] = await executor
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.companyId, actor.companyId), eq(timeEntries.id, entryId), isNull(timeEntries.deletedAt)))
    .limit(1);
  if (!entry) throw new AppError(ErrorCode.NOT_FOUND, "Time entry not found");
  if (!isManager(actor)) {
    const own = await actorTechnicianId(actor, executor);
    // Do not reveal other technicians' entries.
    if (!own || own !== entry.technicianId) throw new AppError(ErrorCode.NOT_FOUND, "Time entry not found");
  }
  return entry;
}

async function getSheetForActor(actor: TimesheetActor, sheetId: string, executor: Pick<typeof db, "select">): Promise<SheetRow> {
  const [sheet] = await executor
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.companyId, actor.companyId), eq(timesheets.id, sheetId), isNull(timesheets.deletedAt)))
    .limit(1);
  if (!sheet) throw new AppError(ErrorCode.NOT_FOUND, "Timesheet not found");
  if (!isManager(actor)) {
    const own = await actorTechnicianId(actor, executor);
    if (!own || own !== sheet.technicianId) throw new AppError(ErrorCode.NOT_FOUND, "Timesheet not found");
  }
  return sheet;
}

async function assertJob(companyId: string, jobId: string, executor: Pick<typeof db, "select">) {
  const [job] = await executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);
  if (!job) throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
}

function assertVersion(expected: string | undefined, type: CanonicalEntityTypeV1, row: { id: string; updatedAt: Date }, current: unknown) {
  if (expected !== undefined && expected !== version(type, row.id, row.updatedAt)) {
    throw new TimesheetConflictError("stale_record_version", "Record was modified since it was read", current);
  }
}

/** Throws if any of the work dates is covered by a locked timesheet for this actor. */
function assertDatesWritable(actor: TimesheetActor, sheets: SheetRow[], technicianId: string, workDates: string[]) {
  for (const workDate of workDates) {
    const sheet = coveringSheet(sheets, technicianId, workDate);
    if (!sheet) continue;
    if (sheet.status === "approved") {
      throw new TimesheetConflictError(
        "timesheet_locked",
        "This time falls in an approved timesheet; an owner/admin must reopen it first",
        toTimesheetV1(sheet)
      );
    }
    if (sheet.status === "submitted" && !isManager(actor)) {
      throw new TimesheetConflictError("timesheet_submitted", "This time falls in a submitted timesheet", toTimesheetV1(sheet));
    }
  }
}

function assertNoOverlap(entries: EntryRow[], selfId: string | null, startedAt: Date, endedAt: Date | null, timeZone: string, sheets: SheetRow[]) {
  const start = startedAt.getTime();
  const end = endedAt ? endedAt.getTime() : Number.POSITIVE_INFINITY;
  const clash = entries.find((entry) => {
    if (entry.id === selfId || entry.deletedAt !== null) return false;
    const otherStart = entry.startedAt.getTime();
    const otherEnd = entry.endedAt ? entry.endedAt.getTime() : Number.POSITIVE_INFINITY;
    return otherStart < end && start < otherEnd;
  });
  if (clash) {
    throw new TimesheetConflictError("overlapping_entry", "Time entry overlaps an existing entry", toTimeEntryV1(clash, timeZone, sheets));
  }
}

async function writeAudit(
  executor: Executor,
  values: {
    companyId: string;
    action: string;
    actorUserId: string;
    timesheetId?: string | null;
    timeEntryId?: string | null;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
  }
) {
  await executor.insert(timesheetAuditEvents).values({
    companyId: values.companyId,
    action: values.action,
    actorUserId: values.actorUserId,
    timesheetId: values.timesheetId ?? null,
    timeEntryId: values.timeEntryId ?? null,
    reason: values.reason ?? null,
    before: values.before ?? null,
    after: values.after ?? null
  });
}

/** Used by the legacy PATCH /time/:entryId path so approved periods stay locked there too. */
export async function assertTimeEntryDatesNotLocked(
  companyId: string,
  technicianId: string,
  dates: Date[],
  executor: Pick<typeof db, "select">
): Promise<void> {
  const [timeZone, sheets] = await Promise.all([companyTimezone(companyId, executor), companySheets(companyId, executor, technicianId)]);
  const owner: TimesheetActor = { companyId, userId: "", role: "owner" };
  assertDatesWritable(owner, sheets, technicianId, dates.map((date) => localDate(date, timeZone)));
}

// ── Time entries ──────────────────────────────

function pageOf(query: { limit?: number; offset?: number }): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? TIMESHEETS_LIST_DEFAULT_LIMIT), 1), TIMESHEETS_LIST_MAX_LIMIT);
  const offset = Math.max(Math.trunc(query.offset ?? 0), 0);
  return { limit, offset };
}

export async function listTimeEntries(
  actor: TimesheetActor,
  query: ListTimeEntriesQuery
): Promise<{ entries: TimeEntryV1[] } & TimesheetsPageV1> {
  let technicianId = query.technicianId;
  if (!isManager(actor)) technicianId = await resolveTargetTechnician(actor, query.technicianId, db);
  else if (technicianId) await assertTechnician(actor.companyId, technicianId, db);
  const { limit, offset } = pageOf(query);

  const timeZone = await companyTimezone(actor.companyId, db);
  // workDate is the company-local date of startedAt, so from/to become exact UTC bounds in SQL.
  const rows: EntryRow[] = await db
    .select()
    .from(timeEntries)
    .where(and(
      eq(timeEntries.companyId, actor.companyId),
      technicianId ? eq(timeEntries.technicianId, technicianId) : undefined,
      query.jobId ? eq(timeEntries.jobId, query.jobId) : undefined,
      query.from ? gte(timeEntries.startedAt, localMidnightUtc(query.from, timeZone)) : undefined,
      query.to ? lt(timeEntries.startedAt, localMidnightUtc(nextDay(query.to), timeZone)) : undefined,
      isNull(timeEntries.deletedAt)
    ))
    .orderBy(desc(timeEntries.startedAt), desc(timeEntries.id))
    .limit(limit + 1)
    .offset(offset);
  const page = rows.slice(0, limit);
  const sheets = await companySheets(actor.companyId, db, technicianId);
  return {
    entries: page.map((row) => toTimeEntryV1(row, timeZone, sheets)),
    limit,
    offset,
    hasMore: rows.length > limit
  };
}

export async function clockIn(actor: TimesheetActor, body: ClockInBody): Promise<TimeEntryV1> {
  return db.transaction(async (tx: Executor) => {
    const technicianId = await resolveTargetTechnician(actor, body.technicianId, tx);
    await assertJob(actor.companyId, body.jobId, tx);
    const [timeZone, sheets, entries] = await Promise.all([
      companyTimezone(actor.companyId, tx),
      companySheets(actor.companyId, tx, technicianId),
      technicianEntries(actor.companyId, technicianId, tx)
    ]);
    const open = entries.find((entry: EntryRow) => entry.endedAt === null);
    if (open) {
      throw new TimesheetConflictError("open_entry_exists", "Technician is already clocked in", toTimeEntryV1(open, timeZone, sheets));
    }
    const now = new Date();
    assertDatesWritable(actor, sheets, technicianId, [localDate(now, timeZone)]);
    assertNoOverlap(entries, null, now, null, timeZone, sheets);
    // The pre-check above is racy; time_entries_open_technician_idx is the real guard (23505 -> 409).
    const [row] = await guardOpenEntryInsert(() => tx
      .insert(timeEntries)
      .values({
        companyId: actor.companyId,
        jobId: body.jobId,
        technicianId,
        startedAt: now,
        entryType: body.entryType ?? "on_site",
        notes: body.notes?.length ? body.notes : null
      })
      .returning());
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to clock in");
    await writeAudit(tx, { companyId: actor.companyId, action: "time_entry.clock_in", actorUserId: actor.userId, timeEntryId: row.id, after: auditSnapshot(row) });
    return toTimeEntryV1(row, timeZone, sheets);
  });
}

export async function clockOut(actor: TimesheetActor, body: ClockOutBody): Promise<TimeEntryV1> {
  return db.transaction(async (tx: Executor) => {
    const technicianId = await resolveTargetTechnician(actor, body.technicianId, tx);
    const [timeZone, sheets, entries] = await Promise.all([
      companyTimezone(actor.companyId, tx),
      companySheets(actor.companyId, tx, technicianId),
      technicianEntries(actor.companyId, technicianId, tx)
    ]);
    const open: EntryRow | undefined = entries.find((entry: EntryRow) => entry.endedAt === null);
    if (!open) throw new TimesheetConflictError("no_open_entry", "Technician is not clocked in", null);
    const before = auditSnapshot(open);
    assertVersion(body.recordVersion, "time_entry", open, toTimeEntryV1(open, timeZone, sheets));
    assertDatesWritable(actor, sheets, technicianId, [localDate(open.startedAt, timeZone)]);
    const now = new Date();
    const [row] = await tx
      .update(timeEntries)
      .set({
        endedAt: now,
        durationMinutes: durationMinutes(open.startedAt, now),
        notes: body.notes?.length ? body.notes : open.notes,
        updatedAt: now
      })
      .where(and(eq(timeEntries.companyId, actor.companyId), eq(timeEntries.id, open.id)))
      .returning();
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to clock out");
    await writeAudit(tx, { companyId: actor.companyId, action: "time_entry.clock_out", actorUserId: actor.userId, timeEntryId: row.id, before, after: auditSnapshot(row) });
    return toTimeEntryV1(row, timeZone, sheets);
  });
}

export async function createTimeEntry(actor: TimesheetActor, body: CreateTimeEntryBody): Promise<TimeEntryV1> {
  return db.transaction(async (tx: Executor) => {
    const technicianId = await resolveTargetTechnician(actor, body.technicianId, tx);
    await assertJob(actor.companyId, body.jobId, tx);
    const [timeZone, sheets, entries] = await Promise.all([
      companyTimezone(actor.companyId, tx),
      companySheets(actor.companyId, tx, technicianId),
      technicianEntries(actor.companyId, technicianId, tx)
    ]);
    const startedAt = new Date(body.startedAt);
    const endedAt = new Date(body.endedAt);
    assertDatesWritable(actor, sheets, technicianId, [localDate(startedAt, timeZone)]);
    assertNoOverlap(entries, null, startedAt, endedAt, timeZone, sheets);
    const [row] = await tx
      .insert(timeEntries)
      .values({
        companyId: actor.companyId,
        jobId: body.jobId,
        technicianId,
        startedAt,
        endedAt,
        durationMinutes: durationMinutes(startedAt, endedAt),
        entryType: body.entryType ?? "on_site",
        notes: body.notes?.length ? body.notes : null
      })
      .returning();
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create time entry");
    await writeAudit(tx, { companyId: actor.companyId, action: "time_entry.created", actorUserId: actor.userId, timeEntryId: row.id, after: auditSnapshot(row) });
    return toTimeEntryV1(row, timeZone, sheets);
  });
}

export async function updateTimeEntryV1(actor: TimesheetActor, entryId: string, body: UpdateTimeEntryBody): Promise<TimeEntryV1> {
  return db.transaction(async (tx: Executor) => {
    const entry = await getEntryForActor(actor, entryId, tx);
    const [timeZone, sheets, entries] = await Promise.all([
      companyTimezone(actor.companyId, tx),
      companySheets(actor.companyId, tx, entry.technicianId),
      technicianEntries(actor.companyId, entry.technicianId, tx)
    ]);
    const before = auditSnapshot(entry);
    assertVersion(body.recordVersion, "time_entry", entry, toTimeEntryV1(entry, timeZone, sheets));
    const startedAt = body.startedAt ? new Date(body.startedAt) : entry.startedAt;
    const endedAt = body.endedAt === undefined ? entry.endedAt : body.endedAt === null ? null : new Date(body.endedAt);
    if (endedAt && endedAt.getTime() <= startedAt.getTime()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "endedAt must be after startedAt", { endedAt: "Must be after startedAt" });
    }
    assertDatesWritable(actor, sheets, entry.technicianId, [localDate(entry.startedAt, timeZone), localDate(startedAt, timeZone)]);
    assertNoOverlap(entries, entry.id, startedAt, endedAt, timeZone, sheets);
    const now = new Date();
    const [row] = await guardOpenEntryInsert(() => tx
      .update(timeEntries)
      .set({
        startedAt,
        endedAt,
        durationMinutes: endedAt ? durationMinutes(startedAt, endedAt) : null,
        entryType: body.entryType ?? entry.entryType,
        notes: body.notes === undefined ? entry.notes : body.notes && body.notes.length ? body.notes : null,
        updatedAt: now
      })
      .where(and(eq(timeEntries.companyId, actor.companyId), eq(timeEntries.id, entry.id)))
      .returning());
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update time entry");
    await writeAudit(tx, { companyId: actor.companyId, action: "time_entry.updated", actorUserId: actor.userId, timeEntryId: row.id, before, after: auditSnapshot(row) });
    return toTimeEntryV1(row, timeZone, sheets);
  });
}

export async function deleteTimeEntryV1(actor: TimesheetActor, entryId: string, recordVersion: string | undefined): Promise<void> {
  await db.transaction(async (tx: Executor) => {
    const entry = await getEntryForActor(actor, entryId, tx);
    const [timeZone, sheets] = await Promise.all([companyTimezone(actor.companyId, tx), companySheets(actor.companyId, tx, entry.technicianId)]);
    const before = auditSnapshot(entry);
    assertVersion(recordVersion, "time_entry", entry, toTimeEntryV1(entry, timeZone, sheets));
    assertDatesWritable(actor, sheets, entry.technicianId, [localDate(entry.startedAt, timeZone)]);
    const now = new Date();
    await tx
      .update(timeEntries)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(timeEntries.companyId, actor.companyId), eq(timeEntries.id, entry.id)));
    await writeAudit(tx, { companyId: actor.companyId, action: "time_entry.deleted", actorUserId: actor.userId, timeEntryId: entry.id, before });
  });
}

// ── Timesheets ────────────────────────────────

function sheetEntries(entries: EntryRow[], sheet: SheetRow, timeZone: string): EntryRow[] {
  return entries.filter((entry) => {
    if (entry.deletedAt !== null || entry.technicianId !== sheet.technicianId) return false;
    const workDate = localDate(entry.startedAt, timeZone);
    return workDate >= sheet.periodStart && workDate <= sheet.periodEnd;
  });
}

function computeTotals(entries: EntryRow[], timeZone: string): TimesheetTotalsV1 {
  let breakMinutes = 0;
  let openEntryCount = 0;
  const items: PayrollWorkItem[] = [];
  for (const entry of entries) {
    if (entry.endedAt === null) {
      openEntryCount += 1;
      continue;
    }
    const minutes = entry.durationMinutes ?? durationMinutes(entry.startedAt, entry.endedAt);
    if (entry.entryType === "break") {
      breakMinutes += minutes;
      continue;
    }
    items.push({ workDate: localDate(entry.startedAt, timeZone), startedAt: entry.startedAt, minutes, rateCents: 0 });
  }
  const split = splitWeeklyOvertime(items);
  return {
    workedMinutes: split.regularMinutes + split.overtimeMinutes,
    breakMinutes,
    regularMinutes: split.regularMinutes,
    overtimeMinutes: split.overtimeMinutes,
    openEntryCount,
    entryCount: entries.length
  };
}

export async function listTimesheets(
  actor: TimesheetActor,
  query: ListTimesheetsQuery
): Promise<{ timesheets: TimesheetV1[] } & TimesheetsPageV1> {
  let technicianId = query.technicianId;
  if (!isManager(actor)) technicianId = await resolveTargetTechnician(actor, query.technicianId, db);
  const { limit, offset } = pageOf(query);
  const rows: SheetRow[] = await db
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.companyId, actor.companyId),
      technicianId ? eq(timesheets.technicianId, technicianId) : undefined,
      query.status ? eq(timesheets.status, query.status) : undefined,
      query.from ? gte(timesheets.periodEnd, query.from) : undefined,
      query.to ? lte(timesheets.periodStart, query.to) : undefined,
      isNull(timesheets.deletedAt)
    ))
    .orderBy(desc(timesheets.periodStart), desc(timesheets.id))
    .limit(limit + 1)
    .offset(offset);
  return { timesheets: rows.slice(0, limit).map(toTimesheetV1), limit, offset, hasMore: rows.length > limit };
}

export async function createTimesheet(actor: TimesheetActor, body: CreateTimesheetBody): Promise<TimesheetV1> {
  return db.transaction(async (tx: Executor) => {
    const technicianId = await resolveTargetTechnician(actor, body.technicianId, tx);
    const sheets = await companySheets(actor.companyId, tx, technicianId);
    const clash = sheets.find((sheet: SheetRow) => sheet.periodStart <= body.periodEnd && body.periodStart <= sheet.periodEnd);
    if (clash) throw new TimesheetConflictError("overlapping_period", "A timesheet already covers part of this period", toTimesheetV1(clash));
    const [row] = await tx
      .insert(timesheets)
      .values({ companyId: actor.companyId, technicianId, periodStart: body.periodStart, periodEnd: body.periodEnd, status: "open" })
      .returning();
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create timesheet");
    await writeAudit(tx, { companyId: actor.companyId, action: "timesheet.created", actorUserId: actor.userId, timesheetId: row.id, after: auditSnapshot(row) });
    return toTimesheetV1(row);
  });
}

export async function getTimesheet(actor: TimesheetActor, sheetId: string) {
  const sheet = await getSheetForActor(actor, sheetId, db);
  const [timeZone, entries, sheets] = await Promise.all([
    companyTimezone(actor.companyId, db),
    technicianEntries(actor.companyId, sheet.technicianId, db),
    companySheets(actor.companyId, db, sheet.technicianId)
  ]);
  const inPeriod = sheetEntries(entries, sheet, timeZone);
  return {
    timesheet: toTimesheetV1(sheet),
    entries: inPeriod.map((row) => toTimeEntryV1(row, timeZone, sheets)).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    totals: computeTotals(inPeriod, timeZone)
  };
}

export async function listTimesheetAudit(actor: TimesheetActor, sheetId: string): Promise<TimesheetAuditEventV1[]> {
  const sheet = await getSheetForActor(actor, sheetId, db);
  const rows = await db
    .select()
    .from(timesheetAuditEvents)
    .where(and(eq(timesheetAuditEvents.companyId, actor.companyId), eq(timesheetAuditEvents.timesheetId, sheet.id)));
  return rows
    .map((row: typeof timesheetAuditEvents.$inferSelect) => ({
      id: row.id,
      timesheetId: row.timesheetId,
      timeEntryId: row.timeEntryId,
      action: row.action,
      actorUserId: row.actorUserId,
      reason: row.reason,
      before: row.before,
      after: row.after,
      createdAt: row.createdAt.toISOString()
    }))
    .sort((a: TimesheetAuditEventV1, b: TimesheetAuditEventV1) => a.createdAt.localeCompare(b.createdAt));
}

type Transition = "submit" | "approve" | "reject" | "reopen";

const TRANSITIONS: Record<Transition, { from: TimesheetStatus[]; to: TimesheetStatus; allowed: (actor: TimesheetActor) => boolean }> = {
  submit: { from: ["open", "rejected"], to: "submitted", allowed: () => true },
  approve: { from: ["submitted"], to: "approved", allowed: isManager },
  reject: { from: ["submitted"], to: "rejected", allowed: isManager },
  reopen: { from: ["approved"], to: "open", allowed: isPayrollAdmin }
};

export async function transitionTimesheet(
  actor: TimesheetActor,
  sheetId: string,
  transition: Transition,
  input: { recordVersion?: string | undefined; reason?: string | undefined }
): Promise<TimesheetV1> {
  const rule = TRANSITIONS[transition];
  if (!rule.allowed(actor)) throw forbidden();
  return db.transaction(async (tx: Executor) => {
    const sheet = await getSheetForActor(actor, sheetId, tx);
    const before = auditSnapshot(sheet);
    assertVersion(input.recordVersion, "timesheet", sheet, toTimesheetV1(sheet));
    if (!rule.from.includes(sheet.status as TimesheetStatus)) {
      throw new TimesheetConflictError("invalid_status", `Cannot ${transition} a timesheet that is ${sheet.status}`, toTimesheetV1(sheet));
    }
    if (transition === "submit" || transition === "approve") {
      const [timeZone, entries] = await Promise.all([companyTimezone(actor.companyId, tx), technicianEntries(actor.companyId, sheet.technicianId, tx)]);
      if (sheetEntries(entries, sheet, timeZone).some((entry) => entry.endedAt === null)) {
        throw new TimesheetConflictError("open_entries", "Clock out all open entries in this period first", toTimesheetV1(sheet));
      }
    }
    const now = new Date();
    const patch: Partial<typeof timesheets.$inferInsert> = { status: rule.to, updatedAt: now };
    if (transition === "submit") Object.assign(patch, { submittedAt: now, submittedById: actor.userId, rejectedAt: null, rejectedById: null, rejectionReason: null });
    if (transition === "approve") Object.assign(patch, { approvedAt: now, approvedById: actor.userId });
    if (transition === "reject") Object.assign(patch, { rejectedAt: now, rejectedById: actor.userId, rejectionReason: input.reason ?? null });
    if (transition === "reopen") Object.assign(patch, { approvedAt: null, approvedById: null, submittedAt: null, submittedById: null });
    const [row] = await tx
      .update(timesheets)
      .set(patch)
      .where(and(eq(timesheets.companyId, actor.companyId), eq(timesheets.id, sheet.id)))
      .returning();
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update timesheet");
    await writeAudit(tx, {
      companyId: actor.companyId,
      action: `timesheet.${transition === "submit" ? "submitted" : transition === "approve" ? "approved" : transition === "reject" ? "rejected" : "reopened"}`,
      actorUserId: actor.userId,
      timesheetId: row.id,
      reason: input.reason ?? null,
      before,
      after: auditSnapshot(row)
    });
    return toTimesheetV1(row);
  });
}

// ── Pay rates ─────────────────────────────────

export async function listPayRates(actor: TimesheetActor, query: ListPayRatesQuery): Promise<PayRateV1[]> {
  if (!isPayrollAdmin(actor)) throw forbidden();
  const rows: RateRow[] = await db
    .select()
    .from(technicianPayRates)
    .where(and(eq(technicianPayRates.companyId, actor.companyId), isNull(technicianPayRates.deletedAt)));
  return rows
    .filter((row) => !query.technicianId || row.technicianId === query.technicianId)
    .sort((a, b) => a.technicianId.localeCompare(b.technicianId) || b.effectiveFrom.localeCompare(a.effectiveFrom))
    .map(toPayRateV1);
}

export async function createPayRate(actor: TimesheetActor, body: CreatePayRateBody): Promise<PayRateV1> {
  if (!isPayrollAdmin(actor)) throw forbidden();
  return db.transaction(async (tx: Executor) => {
    await assertTechnician(actor.companyId, body.technicianId, tx);
    const existing: RateRow[] = await tx
      .select()
      .from(technicianPayRates)
      .where(and(eq(technicianPayRates.companyId, actor.companyId), eq(technicianPayRates.technicianId, body.technicianId), isNull(technicianPayRates.deletedAt)));
    const clash = existing.find((row) => row.effectiveFrom === body.effectiveFrom);
    if (clash) throw new TimesheetConflictError("duplicate_effective_date", "A pay rate already starts on this date", toPayRateV1(clash));
    const [row] = await tx
      .insert(technicianPayRates)
      .values({ companyId: actor.companyId, technicianId: body.technicianId, hourlyRateCents: body.hourlyRateCents, effectiveFrom: body.effectiveFrom, createdById: actor.userId })
      .returning();
    if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create pay rate");
    await writeAudit(tx, { companyId: actor.companyId, action: "pay_rate.created", actorUserId: actor.userId, after: auditSnapshot(row) });
    return toPayRateV1(row);
  });
}

// ── Payroll ───────────────────────────────────

export async function buildPayrollSummary(actor: TimesheetActor, query: PayrollQuery): Promise<PayrollSummaryV1> {
  if (!isPayrollAdmin(actor)) throw forbidden();
  const threshold = query.weeklyOvertimeThresholdMinutes ?? DEFAULT_WEEKLY_OVERTIME_THRESHOLD_MINUTES;
  const multiplier = query.overtimeMultiplierBps ?? DEFAULT_OVERTIME_MULTIPLIER_BPS;
  const [timeZone, sheets, rates, techs] = await Promise.all([
    companyTimezone(actor.companyId, db),
    companySheets(actor.companyId, db),
    db.select().from(technicianPayRates).where(and(eq(technicianPayRates.companyId, actor.companyId), isNull(technicianPayRates.deletedAt))),
    db.select().from(technicians).where(eq(technicians.companyId, actor.companyId))
  ]);
  const approved = (sheets as SheetRow[]).filter(
    (sheet) => sheet.status === "approved" && sheet.periodStart >= query.periodStart && sheet.periodEnd <= query.periodEnd
  );
  const byTech = new Map<string, SheetRow[]>();
  for (const sheet of approved) byTech.set(sheet.technicianId, [...(byTech.get(sheet.technicianId) ?? []), sheet]);

  const lines: PayrollLineV1[] = [];
  for (const [technicianId, techSheets] of byTech) {
    const entries = await technicianEntries(actor.companyId, technicianId, db);
    const techRates = (rates as RateRow[]).filter((rate) => rate.technicianId === technicianId);
    const items: PayrollWorkItem[] = [];
    for (const sheet of techSheets) {
      for (const entry of sheetEntries(entries, sheet, timeZone)) {
        if (entry.endedAt === null || entry.entryType === "break") continue;
        const workDate = localDate(entry.startedAt, timeZone);
        items.push({
          workDate,
          startedAt: entry.startedAt,
          minutes: entry.durationMinutes ?? durationMinutes(entry.startedAt, entry.endedAt),
          rateCents: rateForDate(techRates, workDate)
        });
      }
    }
    const split = splitWeeklyOvertime(items, threshold, multiplier);
    const tech = (techs as Array<{ id: string; firstName: string; lastName: string }>).find((row) => row.id === technicianId);
    lines.push({
      technicianId,
      technicianName: tech ? `${tech.firstName} ${tech.lastName}`.trim() : "",
      timesheetIds: techSheets.map((sheet) => sheet.id).sort(),
      regularMinutes: split.regularMinutes,
      overtimeMinutes: split.overtimeMinutes,
      totalMinutes: split.regularMinutes + split.overtimeMinutes,
      hourlyRateCents: rateForDate(techRates, query.periodEnd),
      regularPayCents: split.regularPayCents,
      overtimePayCents: split.overtimePayCents,
      grossPayCents: split.missingPayRate ? null : (split.regularPayCents ?? 0) + (split.overtimePayCents ?? 0),
      missingPayRate: split.missingPayRate
    });
  }
  lines.sort((a, b) => a.technicianName.localeCompare(b.technicianName) || a.technicianId.localeCompare(b.technicianId));

  return {
    contractVersion: TIMESHEETS_CONTRACT_VERSION,
    periodStart: query.periodStart,
    periodEnd: query.periodEnd,
    timezone: timeZone,
    weeklyOvertimeThresholdMinutes: threshold,
    overtimeMultiplierBps: multiplier,
    lines,
    totals: {
      regularMinutes: lines.reduce((sum, line) => sum + line.regularMinutes, 0),
      overtimeMinutes: lines.reduce((sum, line) => sum + line.overtimeMinutes, 0),
      totalMinutes: lines.reduce((sum, line) => sum + line.totalMinutes, 0),
      grossPayCents: lines.reduce((sum, line) => sum + (line.grossPayCents ?? 0), 0)
    }
  };
}
