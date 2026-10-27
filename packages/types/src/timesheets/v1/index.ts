/**
 * FS-171 — timesheets & payroll API contract (v1).
 *
 * - Clock in/out (job-linked), manual entries, edits and soft-deletes of time entries.
 * - Pay-period timesheets per technician: open -> submitted -> approved | rejected;
 *   approved timesheets lock their entries; owner/admin "reopen" (with reason) unlocks.
 *   Every state change and entry write is recorded in an append-only audit trail.
 * - Technician pay rates (integer cents/hour, effective-dated history).
 * - Payroll summary / export (JSON or CSV) of APPROVED hours per technician per period,
 *   with regular/overtime split. No payments, nothing sent externally.
 *
 * Versioning: time entries, timesheets and pay rates carry `recordVersion` (opaque token
 * from buildRecordVersionV1 over `updatedAt`). Writes accept an optional `recordVersion`;
 * stale -> 409 `{ error: "CONFLICT", reason: "stale_record_version", message, current }`.
 *
 * Dates (`periodStart`, `periodEnd`, `effectiveFrom`, `from`, `to`) are calendar dates
 * (YYYY-MM-DD) in the company's timezone. Timestamps are ISO-8601 UTC.
 */
import { z } from "zod";

export const TIMESHEETS_CONTRACT_VERSION = "1.0.0" as const;

/** Default weekly overtime threshold: 40h (FLSA). */
export const DEFAULT_WEEKLY_OVERTIME_THRESHOLD_MINUTES = 2400;
/** Default overtime multiplier: 1.5x, in basis points. */
export const DEFAULT_OVERTIME_MULTIPLIER_BPS = 15000;
/** Max pay period / report span in days. */
export const MAX_TIMESHEET_PERIOD_DAYS = 31;

export const TimesheetStatusSchema = z.enum(["open", "submitted", "approved", "rejected"]);
export type TimesheetStatus = z.infer<typeof TimesheetStatusSchema>;

export const TimeEntryKindSchema = z.enum(["travel", "on_site", "break"]);

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
  "Invalid date"
);
const DateTime = z.string().datetime({ offset: true });
const RecordVersionInput = z.string().min(1).max(512);
const Reason = z.string().trim().min(1).max(2000);
const Notes = z.string().trim().max(2000);

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function periodShape<T extends { periodStart: string; periodEnd: string }>(schema: z.ZodType<T>) {
  return schema
    .refine((value) => value.periodEnd >= value.periodStart, { message: "periodEnd must be on or after periodStart", path: ["periodEnd"] })
    .refine((value) => daysBetween(value.periodStart, value.periodEnd) < MAX_TIMESHEET_PERIOD_DAYS, {
      message: `Period may not exceed ${MAX_TIMESHEET_PERIOD_DAYS} days`,
      path: ["periodEnd"]
    });
}

export const TimesheetIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

// ── Time entries ─────────────────────────────

export const ClockInBodySchema = z.object({
  jobId: z.string().uuid(),
  /** Managers only; technicians always clock themselves. */
  technicianId: z.string().uuid().optional(),
  entryType: TimeEntryKindSchema.optional(),
  notes: Notes.optional()
}).strict();
export type ClockInBody = z.infer<typeof ClockInBodySchema>;

export const ClockOutBodySchema = z.object({
  technicianId: z.string().uuid().optional(),
  notes: Notes.optional(),
  recordVersion: RecordVersionInput.optional()
}).strict();
export type ClockOutBody = z.infer<typeof ClockOutBodySchema>;

export const CreateTimeEntryBodySchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid().optional(),
  startedAt: DateTime,
  endedAt: DateTime,
  entryType: TimeEntryKindSchema.optional(),
  notes: Notes.optional()
}).strict().refine((value) => Date.parse(value.endedAt) > Date.parse(value.startedAt), {
  message: "endedAt must be after startedAt",
  path: ["endedAt"]
});
export type CreateTimeEntryBody = z.infer<typeof CreateTimeEntryBodySchema>;

export const UpdateTimeEntryBodySchema = z.object({
  startedAt: DateTime.optional(),
  endedAt: DateTime.nullable().optional(),
  entryType: TimeEntryKindSchema.optional(),
  notes: Notes.nullable().optional(),
  recordVersion: RecordVersionInput.optional()
}).strict().refine((value) => Object.keys(value).some((key) => key !== "recordVersion"), {
  message: "At least one field is required"
});
export type UpdateTimeEntryBody = z.infer<typeof UpdateTimeEntryBodySchema>;

export const DeleteTimeEntryBodySchema = z.object({
  recordVersion: RecordVersionInput.optional()
}).strict();
export type DeleteTimeEntryBody = z.infer<typeof DeleteTimeEntryBodySchema>;

export const ListTimeEntriesQuerySchema = z.object({
  technicianId: z.string().uuid().optional(),
  from: DateOnly.optional(),
  to: DateOnly.optional(),
  jobId: z.string().uuid().optional()
}).strict();
export type ListTimeEntriesQuery = z.infer<typeof ListTimeEntriesQuerySchema>;

export interface TimeEntryV1 {
  id: string;
  technicianId: string;
  jobId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  entryType: "travel" | "on_site" | "break";
  notes: string | null;
  /** Local (company timezone) work date of startedAt. */
  workDate: string;
  /** Status of the timesheet covering workDate, or null when none exists. */
  timesheetStatus: TimesheetStatus | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  recordVersion: string;
}

// ── Timesheets ───────────────────────────────

export const CreateTimesheetBodySchema = periodShape(z.object({
  technicianId: z.string().uuid().optional(),
  periodStart: DateOnly,
  periodEnd: DateOnly
}).strict());
export type CreateTimesheetBody = z.infer<typeof CreateTimesheetBodySchema>;

export const ListTimesheetsQuerySchema = z.object({
  technicianId: z.string().uuid().optional(),
  status: TimesheetStatusSchema.optional(),
  from: DateOnly.optional(),
  to: DateOnly.optional()
}).strict();
export type ListTimesheetsQuery = z.infer<typeof ListTimesheetsQuerySchema>;

export const TimesheetTransitionBodySchema = z.object({
  recordVersion: RecordVersionInput.optional()
}).strict();
export type TimesheetTransitionBody = z.infer<typeof TimesheetTransitionBodySchema>;

export const TimesheetReasonBodySchema = z.object({
  reason: Reason,
  recordVersion: RecordVersionInput.optional()
}).strict();
export type TimesheetReasonBody = z.infer<typeof TimesheetReasonBodySchema>;

export interface TimesheetTotalsV1 {
  /** Paid minutes (travel + on_site), closed entries only. Breaks are unpaid. */
  workedMinutes: number;
  breakMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  openEntryCount: number;
  entryCount: number;
}

export interface TimesheetV1 {
  id: string;
  technicianId: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatus;
  submittedAt: string | null;
  submittedById: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  rejectedAt: string | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  recordVersion: string;
}

export interface TimesheetAuditEventV1 {
  id: string;
  timesheetId: string | null;
  timeEntryId: string | null;
  action: string;
  actorUserId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

// ── Pay rates & payroll ──────────────────────

export const CreatePayRateBodySchema = z.object({
  technicianId: z.string().uuid(),
  hourlyRateCents: z.number().int().min(0).max(100_000_00),
  effectiveFrom: DateOnly
}).strict();
export type CreatePayRateBody = z.infer<typeof CreatePayRateBodySchema>;

export const ListPayRatesQuerySchema = z.object({
  technicianId: z.string().uuid().optional()
}).strict();
export type ListPayRatesQuery = z.infer<typeof ListPayRatesQuerySchema>;

export interface PayRateV1 {
  id: string;
  technicianId: string;
  hourlyRateCents: number;
  effectiveFrom: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  recordVersion: string;
}

export const PayrollQuerySchema = periodShape(z.object({
  periodStart: DateOnly,
  periodEnd: DateOnly,
  weeklyOvertimeThresholdMinutes: z.coerce.number().int().min(0).max(10_080).optional(),
  overtimeMultiplierBps: z.coerce.number().int().min(10_000).max(30_000).optional(),
  format: z.enum(["json", "csv"]).optional()
}).strict());
export type PayrollQuery = z.infer<typeof PayrollQuerySchema>;

export interface PayrollLineV1 {
  technicianId: string;
  technicianName: string;
  timesheetIds: string[];
  regularMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
  /** Rate effective at periodEnd (display only; pay uses the rate effective on each work date). */
  hourlyRateCents: number | null;
  regularPayCents: number | null;
  overtimePayCents: number | null;
  grossPayCents: number | null;
  /** True when some approved work date had no effective pay rate; pay fields are then null. */
  missingPayRate: boolean;
}

export interface PayrollSummaryV1 {
  contractVersion: typeof TIMESHEETS_CONTRACT_VERSION;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  weeklyOvertimeThresholdMinutes: number;
  overtimeMultiplierBps: number;
  lines: PayrollLineV1[];
  totals: {
    regularMinutes: number;
    overtimeMinutes: number;
    totalMinutes: number;
    grossPayCents: number;
  };
}
