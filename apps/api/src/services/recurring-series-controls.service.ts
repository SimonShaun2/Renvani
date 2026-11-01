/**
 * FS-60 recurring series controls, built on the FS-59 series and occurrence tables (migrations 0047/0048).
 *
 * Flow: preview -> approve -> execute. POST .../changes/preview is a dry run that returns the exact diff and a
 * previewHash. POST .../changes executes only when the caller sends the previewHash they approved. The diff is
 * recomputed under a series lock, and if anything moved since the preview, the result is 409 preview_stale
 * (no silent overwrite).
 *
 * - Company-scoped everywhere. The series row is locked FOR UPDATE for every execute.
 * - Series version = number of FS-60 change events (activity_events, payload.seriesChange) + 1. Every execute takes
 *   expectedVersion (409 stale_version) and idempotencyKey (series-scoped). The same key with the same request
 *   replays the stored result; the same key with a different request is 409 idempotency_conflict.
 * - Visits already linked to a job are never moved or cancelled here. They go to the exception queue
 *   (payload.seriesException, escalation "human"): skip/reschedule return 409 linked_job, and "end" leaves them
 *   for a person.
 * - No migration: reuses the existing job.updated / job.rescheduled activity event types with
 *   entity_type = "recurring_visit_series".
 */
import { createHash } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { activityEvents, db, recurringVisitOccurrences, recurringVisitSeries } from "@fsm/db";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { canonicalJson } from "../lib/canonical-json.js";
import { localDateTimeToUtc, todayLocalDate } from "./recurring-visit-occurrence.schedule.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Q = Tx | typeof db;
type SeriesRow = typeof recurringVisitSeries.$inferSelect;
type OccurrenceRow = typeof recurringVisitOccurrences.$inferSelect;
type EventRow = typeof activityEvents.$inferSelect;

export const SERIES_CONTROL_POLICY_VERSION = "fs60-v1";
const ENTITY_TYPE = "recurring_visit_series";
const EVENT_TYPES = ["job.updated", "job.rescheduled"] as const;

export interface SeriesActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

export type SeriesChange =
  | { action: "pause"; reason: string }
  | { action: "resume"; reason: string }
  | { action: "end"; reason: string }
  | { action: "skip_occurrence"; occurrenceId: string; reason: string }
  | { action: "reschedule_occurrence"; occurrenceId: string; localDate: string; reason: string }
  | { action: "reschedule_future"; localTime: string; reason: string };

export interface ExecuteBody {
  expectedVersion: number;
  idempotencyKey: string;
  previewHash: string;
  change: SeriesChange;
}

export interface OccurrenceState {
  id: string;
  occurrenceIndex: number;
  status: string;
  localDate: string;
  scheduledAtUtc: string;
  jobId: string | null;
}

export interface SeriesState {
  seriesId: string;
  status: string;
  frequency: string;
  localTime: string;
  timeZone: string;
  seriesVersion: number;
}

export interface OccurrenceDiff {
  occurrenceId: string;
  occurrenceIndex: number;
  before: { status: string; localDate: string; scheduledAtUtc: string };
  after: { status: string; localDate: string; scheduledAtUtc: string };
}

export interface SeriesException {
  occurrenceId: string;
  reason: "linked_job";
  jobId: string;
  escalation: "human";
}

export interface SeriesPreview {
  action: SeriesChange["action"];
  series: { before: { status: string; localTime: string }; after: { status: string; localTime: string } };
  occurrences: OccurrenceDiff[];
  exceptions: SeriesException[];
}

export interface PreviewResponse {
  series: SeriesState;
  preview: SeriesPreview;
  previewHash: string;
}

export interface SeriesChangeRecord {
  id: string;
  action: SeriesChange["action"];
  version: number;
  actorUserId: string | null;
  reason: string;
  preview: SeriesPreview;
  occurredAt: string;
}

export interface ExecuteResponse {
  series: SeriesState;
  change: SeriesChangeRecord;
  replayed: boolean;
}

export interface SeriesDetailResponse {
  series: SeriesState;
  occurrences: OccurrenceState[];
  history: SeriesChangeRecord[];
  openExceptions: Array<SeriesException & { action: string; recordedAt: string }>;
}

interface ChangePayload {
  seriesChange: true;
  action: SeriesChange["action"];
  version: number;
  idempotencyKey: string;
  requestHash: string;
  policyVersion: string;
  reason: string;
  preview: SeriesPreview;
}

const notFound = () => new AppError(ErrorCode.NOT_FOUND, "Recurring series not found");
const conflict = (message: string, fields: Record<string, string>) => new AppError(ErrorCode.CONFLICT, message, fields);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const effectiveDate = (o: OccurrenceRow) => o.overrideScheduledLocalDate ?? o.scheduledLocalDate;
const toOcc = (o: OccurrenceRow): OccurrenceState => ({
  id: o.id,
  occurrenceIndex: o.occurrenceIndex,
  status: o.status,
  localDate: effectiveDate(o),
  scheduledAtUtc: o.scheduledAtUtc.toISOString(),
  jobId: o.jobId ?? null
});
const toState = (s: SeriesRow, version: number): SeriesState => ({
  seriesId: s.id,
  status: s.status,
  frequency: s.frequency,
  localTime: s.localTime,
  timeZone: s.timeZone,
  seriesVersion: version
});

async function findSeries(q: Q, companyId: string, seriesId: string, lock: boolean): Promise<SeriesRow> {
  const base = q
    .select()
    .from(recurringVisitSeries)
    .where(and(eq(recurringVisitSeries.companyId, companyId), eq(recurringVisitSeries.id, seriesId), isNull(recurringVisitSeries.deletedAt)));
  const [row] = lock ? await base.for("update").limit(1) : await base.limit(1);
  if (!row) throw notFound();
  return row;
}

async function loadOccurrences(q: Q, companyId: string, seriesId: string): Promise<OccurrenceRow[]> {
  const rows = await q
    .select()
    .from(recurringVisitOccurrences)
    .where(
      and(eq(recurringVisitOccurrences.companyId, companyId), eq(recurringVisitOccurrences.seriesId, seriesId), isNull(recurringVisitOccurrences.deletedAt))
    );
  return [...rows].sort((a, b) => a.occurrenceIndex - b.occurrenceIndex);
}

async function loadEvents(q: Q, companyId: string, seriesId: string): Promise<EventRow[]> {
  return q
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.companyId, companyId),
        eq(activityEvents.entityType, ENTITY_TYPE),
        eq(activityEvents.entityId, seriesId),
        inArray(activityEvents.eventType, [...EVENT_TYPES])
      )
    );
}

function changesOf(events: EventRow[]) {
  return events
    .map((row) => ({ row, p: row.payload as Partial<ChangePayload> | null }))
    .filter((x): x is { row: EventRow; p: ChangePayload } => x.p?.seriesChange === true && typeof x.p.version === "number")
    .sort((a, b) => b.p.version - a.p.version);
}

const toRecord = (row: EventRow, p: ChangePayload): SeriesChangeRecord => ({
  id: row.id,
  action: p.action,
  version: p.version,
  actorUserId: row.actorId ?? null,
  reason: p.reason,
  preview: p.preview,
  occurredAt: row.occurredAt.toISOString()
});

export async function getSeriesDetail(companyId: string, seriesId: string): Promise<SeriesDetailResponse> {
  const series = await findSeries(db, companyId, seriesId, false);
  const [occurrences, events] = await Promise.all([loadOccurrences(db, companyId, seriesId), loadEvents(db, companyId, seriesId)]);
  const changes = changesOf(events);
  const openExceptions = events
    .map((row) => ({ row, p: row.payload as { seriesException?: boolean; action?: string; exception?: SeriesException } | null }))
    .filter((x) => x.p?.seriesException === true && x.p.exception)
    .map(({ row, p }) => ({ ...p!.exception!, action: p!.action ?? "unknown", recordedAt: row.occurredAt.toISOString() }));
  return {
    series: toState(series, changes.length + 1),
    occurrences: occurrences.map(toOcc),
    history: changes.map(({ row, p }) => toRecord(row, p)),
    openExceptions
  };
}

interface Computed {
  preview: SeriesPreview;
  seriesSet: Partial<typeof recurringVisitSeries.$inferInsert>;
  occurrenceSets: Array<{ id: string; set: Partial<typeof recurringVisitOccurrences.$inferInsert> }>;
}

function isFutureScheduled(o: OccurrenceRow, now: Date) {
  return o.status === "scheduled" && o.scheduledAtUtc > now;
}

function requireOccurrence(occurrences: OccurrenceRow[], id: string, now: Date): OccurrenceRow {
  const occ = occurrences.find((o) => o.id === id);
  if (!occ) throw new AppError(ErrorCode.NOT_FOUND, "Occurrence not found");
  if (!isFutureScheduled(occ, now)) throw conflict("Only upcoming scheduled visits can be changed", { reason: "occurrence_not_open", status: occ.status });
  if (occ.jobId) throw conflict("This visit already has a job; change it from the job instead", { reason: "linked_job", jobId: occ.jobId });
  return occ;
}

function compute(series: SeriesRow, occurrences: OccurrenceRow[], change: SeriesChange, now: Date): Computed {
  if (series.externalSchedulerAuthoritative) {
    throw conflict("This series is managed by an external scheduler", { reason: "external_scheduler" });
  }
  const before = { status: series.status, localTime: series.localTime };
  const out: Computed = {
    preview: { action: change.action, series: { before, after: { ...before } }, occurrences: [], exceptions: [] },
    seriesSet: {},
    occurrenceSets: []
  };
  const snap = (o: OccurrenceRow) => ({ status: o.status, localDate: effectiveDate(o), scheduledAtUtc: o.scheduledAtUtc.toISOString() });
  const requireStatus = (allowed: string[]) => {
    if (!allowed.includes(series.status)) {
      throw conflict(`Series is ${series.status}`, { reason: series.status === "cancelled" ? "series_ended" : "invalid_status", status: series.status });
    }
  };

  switch (change.action) {
    case "pause":
      requireStatus(["active"]);
      out.seriesSet.status = "paused";
      break;
    case "resume":
      requireStatus(["paused"]);
      out.seriesSet.status = "active";
      break;
    case "end": {
      requireStatus(["active", "paused"]);
      out.seriesSet.status = "cancelled";
      for (const o of occurrences.filter((x) => isFutureScheduled(x, now))) {
        if (o.jobId) {
          out.preview.exceptions.push({ occurrenceId: o.id, reason: "linked_job", jobId: o.jobId, escalation: "human" });
          continue;
        }
        out.occurrenceSets.push({ id: o.id, set: { status: "cancelled" } });
        out.preview.occurrences.push({ occurrenceId: o.id, occurrenceIndex: o.occurrenceIndex, before: snap(o), after: { ...snap(o), status: "cancelled" } });
      }
      break;
    }
    case "skip_occurrence": {
      requireStatus(["active", "paused"]);
      const o = requireOccurrence(occurrences, change.occurrenceId, now);
      out.occurrenceSets.push({ id: o.id, set: { status: "skipped" } });
      out.preview.occurrences.push({ occurrenceId: o.id, occurrenceIndex: o.occurrenceIndex, before: snap(o), after: { ...snap(o), status: "skipped" } });
      break;
    }
    case "reschedule_occurrence": {
      requireStatus(["active", "paused"]);
      const o = requireOccurrence(occurrences, change.occurrenceId, now);
      if (change.localDate <= todayLocalDate(series.timeZone, now)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "New date must be after today", { localDate: "in_past" });
      }
      const clash = occurrences.find((x) => x.id !== o.id && (x.status === "scheduled" || x.status === "completed") && effectiveDate(x) === change.localDate);
      if (clash) {
        throw conflict("Another visit in this series is already on that date", { reason: "occurrence_conflict", conflictOccurrenceId: clash.id });
      }
      const at = localDateTimeToUtc(change.localDate, series.localTime, series.timeZone);
      out.occurrenceSets.push({ id: o.id, set: { overrideScheduledLocalDate: change.localDate, scheduledAtUtc: at, overrideNotes: change.reason } });
      out.preview.occurrences.push({
        occurrenceId: o.id,
        occurrenceIndex: o.occurrenceIndex,
        before: snap(o),
        after: { status: o.status, localDate: change.localDate, scheduledAtUtc: at.toISOString() }
      });
      break;
    }
    case "reschedule_future": {
      requireStatus(["active", "paused"]);
      if (change.localTime === series.localTime) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "That is already the series time", { localTime: "unchanged" });
      }
      out.seriesSet.localTime = change.localTime;
      for (const o of occurrences.filter((x) => isFutureScheduled(x, now))) {
        if (o.jobId) {
          out.preview.exceptions.push({ occurrenceId: o.id, reason: "linked_job", jobId: o.jobId, escalation: "human" });
          continue;
        }
        const at = localDateTimeToUtc(effectiveDate(o), change.localTime, series.timeZone);
        out.occurrenceSets.push({ id: o.id, set: { scheduledAtUtc: at } });
        out.preview.occurrences.push({ occurrenceId: o.id, occurrenceIndex: o.occurrenceIndex, before: snap(o), after: { ...snap(o), scheduledAtUtc: at.toISOString() } });
      }
      break;
    }
  }
  out.preview.series.after = { status: out.seriesSet.status ?? before.status, localTime: out.seriesSet.localTime ?? before.localTime };
  return out;
}

const previewHashOf = (seriesId: string, version: number, preview: SeriesPreview) =>
  sha(`${SERIES_CONTROL_POLICY_VERSION}:${seriesId}:${version}|${canonicalJson(preview)}`);

export async function previewSeriesChange(companyId: string, seriesId: string, change: SeriesChange, now = new Date()): Promise<PreviewResponse> {
  const series = await findSeries(db, companyId, seriesId, false);
  const [occurrences, events] = await Promise.all([loadOccurrences(db, companyId, seriesId), loadEvents(db, companyId, seriesId)]);
  const version = changesOf(events).length + 1;
  const { preview } = compute(series, occurrences, change, now);
  return { series: toState(series, version), preview, previewHash: previewHashOf(series.id, version, preview) };
}

async function recordException(companyId: string, actor: SeriesActor, series: SeriesRow, action: string, exception: SeriesException, q: Q = db) {
  await q.insert(activityEvents).values({
    companyId,
    eventType: "job.updated",
    actorId: actor.userId,
    actorType: "user",
    entityType: ENTITY_TYPE,
    entityId: series.id,
    customerId: series.customerId,
    jobId: exception.jobId,
    payload: { seriesException: true, action, exception, policyVersion: SERIES_CONTROL_POLICY_VERSION },
    summary: `Recurring visit needs a person: ${exception.reason}`,
    occurredAt: new Date()
  });
}

export async function executeSeriesChange(actor: SeriesActor, seriesId: string, body: ExecuteBody, now = new Date()): Promise<ExecuteResponse> {
  const requestHash = sha(canonicalJson({ seriesId, expectedVersion: body.expectedVersion, previewHash: body.previewHash, change: body.change }));
  try {
    return await db.transaction(async (tx) => {
      const series = await findSeries(tx, actor.companyId, seriesId, true);
      const [occurrences, events] = await Promise.all([loadOccurrences(tx, actor.companyId, seriesId), loadEvents(tx, actor.companyId, seriesId)]);
      const changes = changesOf(events);
      const version = changes.length + 1;
      const prior = changes.find((c) => c.p.idempotencyKey === body.idempotencyKey);
      if (prior) {
        if (prior.p.requestHash !== requestHash) {
          throw conflict("Idempotency key was already used with a different request", { reason: "idempotency_conflict" });
        }
        return { series: toState(series, version), change: toRecord(prior.row, prior.p), replayed: true };
      }
      if (body.expectedVersion !== version) {
        throw conflict("This series was changed by someone else; preview again", { reason: "stale_version", currentVersion: String(version) });
      }
      const computed = compute(series, occurrences, body.change, now);
      if (previewHashOf(series.id, version, computed.preview) !== body.previewHash) {
        throw conflict("The series changed since you previewed it; preview again", { reason: "preview_stale" });
      }
      const at = new Date();
      let next = series;
      if (Object.keys(computed.seriesSet).length) {
        const [row] = await tx
          .update(recurringVisitSeries)
          .set({ ...computed.seriesSet, updatedAt: at })
          .where(and(eq(recurringVisitSeries.companyId, actor.companyId), eq(recurringVisitSeries.id, series.id)))
          .returning();
        next = row ?? series;
      }
      for (const { id, set } of computed.occurrenceSets) {
        await tx
          .update(recurringVisitOccurrences)
          .set({ ...set, updatedAt: at })
          .where(and(eq(recurringVisitOccurrences.companyId, actor.companyId), eq(recurringVisitOccurrences.seriesId, series.id), eq(recurringVisitOccurrences.id, id)));
      }
      const payload: ChangePayload = {
        seriesChange: true,
        action: body.change.action,
        version: version + 1,
        idempotencyKey: body.idempotencyKey,
        requestHash,
        policyVersion: SERIES_CONTROL_POLICY_VERSION,
        reason: body.change.reason,
        preview: computed.preview
      };
      const [event] = await tx
        .insert(activityEvents)
        .values({
          companyId: actor.companyId,
          eventType: body.change.action.startsWith("reschedule") ? "job.rescheduled" : "job.updated",
          actorId: actor.userId,
          actorType: "user",
          entityType: ENTITY_TYPE,
          entityId: series.id,
          customerId: series.customerId,
          payload,
          summary: `Recurring series ${body.change.action.replace(/_/g, " ")}`,
          occurredAt: at
        })
        .returning();
      for (const ex of computed.preview.exceptions) {
        await recordException(actor.companyId, actor, series, body.change.action, ex, tx);
      }
      return { series: toState(next, version + 1), change: toRecord(event!, payload), replayed: false };
    });
  } catch (error) {
    // A linked job blocks a single-visit change. Put it in the exception queue for a person, then surface the 409.
    if (error instanceof AppError && error.fields?.reason === "linked_job" && error.fields.jobId && "occurrenceId" in body.change) {
      const series = await findSeries(db, actor.companyId, seriesId, false);
      await recordException(actor.companyId, actor, series, body.change.action, {
        occurrenceId: body.change.occurrenceId,
        reason: "linked_job",
        jobId: error.fields.jobId,
        escalation: "human"
      });
    }
    throw error;
  }
}
