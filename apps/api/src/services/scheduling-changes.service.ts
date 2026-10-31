/**
 * FS-24 Scheduling Agent: changes and exceptions (Renvani is the system of record).
 *
 * - Company-scoped on every query; the job row (and target technician row) is locked FOR UPDATE so
 *   concurrent changes to the same job or technician lane serialize, and capacity is re-checked under lock.
 * - The schedule version is the count of FS-24 change events on the job (activity_events, payload.scheduleChange)
 *   plus 1. Every write takes expectedVersion (409 stale_version) and idempotencyKey (job-scoped):
 *   same key + same payload replays the stored result; same key + different payload is 409 idempotency_conflict.
 * - No customer message is sent here: only the confirmed state is recorded. Exceptions are recorded for human
 *   escalation (payload.escalation = "human") and do not move the job.
 * - No migration: reuses the existing job.rescheduled / job.cancelled / job.updated activity event types.
 */
import { createHash } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { activityEvents, db, jobs, technicians } from "@fsm/db";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { canonicalJson } from "./growth-check-report-render.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type JobRow = typeof jobs.$inferSelect;
type EventRow = typeof activityEvents.$inferSelect;

export const SCHEDULE_CHANGE_POLICY_VERSION = "fs24-v1";
/** Dispatchers can't cancel a visit that starts within this many hours; owner/admin can (with a reason). */
export const CANCELLATION_WINDOW_HOURS = 24;
export const MAX_VISIT_HOURS = 24;

export const SCHEDULE_EXCEPTION_KINDS = ["late_staff", "customer_conflict", "access_issue", "weather", "parts_delay", "other"] as const;
export type ScheduleExceptionKind = (typeof SCHEDULE_EXCEPTION_KINDS)[number];

const CHANGEABLE_STATUSES = new Set(["lead", "estimate_requested", "estimate_sent", "estimate_approved", "scheduled", "dispatched", "on_hold"]);
const EXCEPTION_STATUSES = new Set(["scheduled", "dispatched", "in_progress", "on_hold"]);
/** Jobs that occupy a technician's time for collision checks. */
const OCCUPYING_STATUSES = ["scheduled", "dispatched", "in_progress", "on_hold"] as const;
const CHANGE_EVENT_TYPES = ["job.rescheduled", "job.cancelled", "job.updated"] as const;

export type ScheduleChangeAction = "reschedule" | "cancel" | "exception";

export interface SchedulingActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

export interface JobScheduleState {
  jobId: string;
  status: string;
  technicianId: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleVersion: number;
}

export interface ScheduleChangeRecord {
  id: string;
  action: ScheduleChangeAction;
  version: number;
  actorUserId: string | null;
  reason: string | null;
  previous: Pick<JobScheduleState, "status" | "technicianId" | "scheduledStart" | "scheduledEnd">;
  next: Pick<JobScheduleState, "status" | "technicianId" | "scheduledStart" | "scheduledEnd">;
  exception: { kind: ScheduleExceptionKind; delayMinutes: number | null; escalation: "human" } | null;
  occurredAt: string;
}

export interface ScheduleChangeResponse {
  schedule: JobScheduleState;
  change: ScheduleChangeRecord;
  replayed: boolean;
}

export interface JobScheduleDetailResponse {
  schedule: JobScheduleState;
  history: ScheduleChangeRecord[];
}

export interface RescheduleBody {
  expectedVersion: number;
  idempotencyKey: string;
  scheduledStart: string;
  scheduledEnd: string;
  technicianId?: string | undefined;
  reason: string;
}
export interface CancelBody {
  expectedVersion: number;
  idempotencyKey: string;
  reason: string;
}
export interface ExceptionBody {
  expectedVersion: number;
  idempotencyKey: string;
  kind: ScheduleExceptionKind;
  note: string;
  delayMinutes?: number | undefined;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const notFound = () => new AppError(ErrorCode.NOT_FOUND, "Job not found");
const conflict = (message: string, fields: Record<string, string>) => new AppError(ErrorCode.CONFLICT, message, fields);

function payloadHash(action: ScheduleChangeAction, jobId: string, body: object): string {
  const rest: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  delete rest.idempotencyKey;
  return createHash("sha256").update(`${action}:${jobId}|${canonicalJson(rest)}`).digest("hex");
}

interface ChangePayload {
  scheduleChange: true;
  action: ScheduleChangeAction;
  version: number;
  idempotencyKey: string;
  payloadHash: string;
  policyVersion: string;
  reason: string | null;
  previous: ScheduleChangeRecord["previous"];
  next: ScheduleChangeRecord["next"];
  exception: ScheduleChangeRecord["exception"];
}

function asChangePayload(row: EventRow): ChangePayload | null {
  const p = row.payload as Partial<ChangePayload> | null;
  return p && p.scheduleChange === true && typeof p.version === "number" ? (p as ChangePayload) : null;
}

function toRecord(row: EventRow, p: ChangePayload): ScheduleChangeRecord {
  return {
    id: row.id,
    action: p.action,
    version: p.version,
    actorUserId: row.actorId ?? null,
    reason: p.reason,
    previous: p.previous,
    next: p.next,
    exception: p.exception,
    occurredAt: row.occurredAt.toISOString()
  };
}

function snapshot(job: JobRow): ScheduleChangeRecord["previous"] {
  return { status: job.status, technicianId: job.technicianId ?? null, scheduledStart: iso(job.scheduledStart), scheduledEnd: iso(job.scheduledEnd) };
}

function toState(job: JobRow, version: number): JobScheduleState {
  return { jobId: job.id, ...snapshot(job), scheduleVersion: version };
}

async function findJob(q: Tx | typeof db, companyId: string, jobId: string, lock: boolean): Promise<JobRow> {
  const base = q
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)));
  const [row] = lock ? await base.for("update").limit(1) : await base.limit(1);
  if (!row) throw notFound();
  return row;
}

async function loadChanges(q: Tx | typeof db, companyId: string, jobId: string) {
  const rows = await q
    .select()
    .from(activityEvents)
    .where(and(eq(activityEvents.companyId, companyId), eq(activityEvents.jobId, jobId), inArray(activityEvents.eventType, [...CHANGE_EVENT_TYPES])));
  return rows
    .map((row) => ({ row, p: asChangePayload(row) }))
    .filter((x): x is { row: EventRow; p: ChangePayload } => x.p !== null)
    .sort((a, b) => b.p.version - a.p.version);
}

export async function getJobSchedule(companyId: string, jobId: string): Promise<JobScheduleDetailResponse> {
  const job = await findJob(db, companyId, jobId, false);
  const changes = await loadChanges(db, companyId, jobId);
  return { schedule: toState(job, changes.length + 1), history: changes.map(({ row, p }) => toRecord(row, p)) };
}

async function assertNoCollision(tx: Tx, companyId: string, jobId: string, technicianId: string, start: Date, end: Date) {
  const others = await tx
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.technicianId, technicianId), inArray(jobs.status, [...OCCUPYING_STATUSES]), isNull(jobs.deletedAt)));
  const clash = others.find(
    (o) => o.id !== jobId && o.scheduledStart && o.scheduledEnd && o.scheduledStart < end && o.scheduledEnd > start
  );
  if (clash) {
    throw conflict("The technician already has a visit at that time", { reason: "schedule_conflict", conflictJobId: clash.id });
  }
}

async function lockTechnician(tx: Tx, companyId: string, technicianId: string) {
  const [tech] = await tx
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt)))
    .for("update")
    .limit(1);
  if (!tech) throw new AppError(ErrorCode.VALIDATION_ERROR, "Technician not found", { technicianId: "not_found" });
}

interface Plan {
  set: Partial<typeof jobs.$inferInsert>;
  eventType: (typeof CHANGE_EVENT_TYPES)[number];
  summary: string;
  reason: string | null;
  exception: ScheduleChangeRecord["exception"];
}

async function applyChange(
  actor: SchedulingActor,
  jobId: string,
  action: ScheduleChangeAction,
  body: { expectedVersion: number; idempotencyKey: string },
  plan: (tx: Tx, job: JobRow) => Promise<Plan>
): Promise<ScheduleChangeResponse> {
  const hash = payloadHash(action, jobId, body);
  return db.transaction(async (tx) => {
    const job = await findJob(tx, actor.companyId, jobId, true);
    const changes = await loadChanges(tx, actor.companyId, jobId);
    const version = changes.length + 1;
    const prior = changes.find((c) => c.p.idempotencyKey === body.idempotencyKey);
    if (prior) {
      if (prior.p.payloadHash !== hash) {
        throw conflict("Idempotency key was already used with a different request", { reason: "idempotency_conflict" });
      }
      return { schedule: toState(job, version), change: toRecord(prior.row, prior.p), replayed: true };
    }
    if (body.expectedVersion !== version) {
      throw conflict("This visit was changed by someone else; reload and retry", { reason: "stale_version", currentVersion: String(version) });
    }
    const p = await plan(tx, job);
    const before = snapshot(job);
    const now = new Date();
    const [updated] = Object.keys(p.set).length
      ? await tx
          .update(jobs)
          .set({ ...p.set, updatedAt: now })
          .where(and(eq(jobs.companyId, actor.companyId), eq(jobs.id, job.id)))
          .returning()
      : [job];
    const next = updated ?? job;
    const nextVersion = version + 1;
    const payload: ChangePayload = {
      scheduleChange: true,
      action,
      version: nextVersion,
      idempotencyKey: body.idempotencyKey,
      payloadHash: hash,
      policyVersion: SCHEDULE_CHANGE_POLICY_VERSION,
      reason: p.reason,
      previous: before,
      next: snapshot(next),
      exception: p.exception
    };
    const [event] = await tx
      .insert(activityEvents)
      .values({
        companyId: actor.companyId,
        eventType: p.eventType,
        actorId: actor.userId,
        actorType: "user",
        entityType: "job",
        entityId: job.id,
        customerId: job.customerId,
        jobId: job.id,
        payload,
        summary: p.summary,
        occurredAt: now
      })
      .returning();
    return { schedule: toState(next, nextVersion), change: toRecord(event!, payload), replayed: false };
  });
}

export function rescheduleJob(actor: SchedulingActor, jobId: string, body: RescheduleBody, now = new Date()) {
  return applyChange(actor, jobId, "reschedule", body, async (tx, job) => {
    if (!CHANGEABLE_STATUSES.has(job.status)) {
      throw conflict("This visit can no longer be rescheduled", { reason: "not_reschedulable", status: job.status });
    }
    const start = new Date(body.scheduledStart);
    const end = new Date(body.scheduledEnd);
    if (!(end > start)) throw new AppError(ErrorCode.VALIDATION_ERROR, "End must be after start", { scheduledEnd: "before_start" });
    if (end.getTime() - start.getTime() > MAX_VISIT_HOURS * 3_600_000) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `A visit can't be longer than ${MAX_VISIT_HOURS} hours`, { scheduledEnd: "too_long" });
    }
    if (start < now) throw new AppError(ErrorCode.VALIDATION_ERROR, "Start can't be in the past", { scheduledStart: "in_past" });
    const technicianId = body.technicianId ?? job.technicianId ?? null;
    if (technicianId) {
      await lockTechnician(tx, job.companyId, technicianId);
      await assertNoCollision(tx, job.companyId, job.id, technicianId, start, end);
    }
    return {
      set: {
        scheduledStart: start,
        scheduledEnd: end,
        scheduledDurationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
        ...(body.technicianId ? { technicianId: body.technicianId } : {})
      },
      eventType: "job.rescheduled",
      summary: `Visit rescheduled to ${start.toISOString()}`,
      reason: body.reason,
      exception: null
    };
  });
}

export function cancelJob(actor: SchedulingActor, jobId: string, body: CancelBody, now = new Date()) {
  return applyChange(actor, jobId, "cancel", body, async (_tx, job) => {
    if (!CHANGEABLE_STATUSES.has(job.status)) {
      throw conflict("This visit can no longer be cancelled", { reason: "not_cancellable", status: job.status });
    }
    const withinWindow = job.scheduledStart !== null && job.scheduledStart.getTime() - now.getTime() < CANCELLATION_WINDOW_HOURS * 3_600_000;
    if (withinWindow && actor.role !== "owner" && actor.role !== "admin") {
      throw new AppError(ErrorCode.POLICY_DENIED, `Visits within ${CANCELLATION_WINDOW_HOURS} hours need an owner or admin to cancel`, {
        reason: "cancellation_window",
        windowHours: String(CANCELLATION_WINDOW_HOURS)
      });
    }
    return { set: { status: "cancelled" }, eventType: "job.cancelled", summary: "Visit cancelled", reason: body.reason, exception: null };
  });
}

export function recordScheduleException(actor: SchedulingActor, jobId: string, body: ExceptionBody) {
  return applyChange(actor, jobId, "exception", body, async (_tx, job) => {
    if (!EXCEPTION_STATUSES.has(job.status)) {
      throw conflict("Exceptions can only be raised on scheduled or active visits", { reason: "not_active", status: job.status });
    }
    return {
      set: {},
      eventType: "job.updated",
      summary: `Schedule exception: ${body.kind.replace(/_/gu, " ")} (needs a person to follow up)`,
      reason: body.note,
      exception: { kind: body.kind, delayMinutes: body.delayMinutes ?? null, escalation: "human" }
    };
  });
}
