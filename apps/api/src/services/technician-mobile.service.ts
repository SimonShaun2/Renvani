/**
 * FS-169 — technician mobile API (Today list, on-the-way, status, checklist, report issue).
 * Reuses job.service / job-tasks.service for writes; adds tenant + assignee scoping and
 * optimistic concurrency via recordVersion (buildRecordVersionV1 over updatedAt).
 *
 * On-the-way here records status + timestamp only. It never enqueues the customer
 * SMS (`send-otw-notification`); that stays on POST /jobs/:id/on-the-way.
 */
import { and, eq, isNull } from "drizzle-orm";

import { db, emitEventWithExecutor, jobs, jobTasks, onTheWayNotifications, technicians, users } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  MOBILE_ISSUE_CATEGORIES,
  TECHNICIAN_MOBILE_CONTRACT_VERSION,
  buildRecordVersionV1,
  type MobileChecklistItem,
  type MobileChecklistUpdateBody,
  type MobileIssue,
  type MobileJob,
  type MobileJobStatus,
  type MobileOnTheWayBody,
  type MobileReportIssueBody,
  type MobileStatusBody,
  type MobileTodayQuery,
  type MobileTodayResponse,
  type UserRole
} from "@fsm/types";

import { addNote, transitionStatus } from "./job.service.js";
import { updateTask } from "./job-tasks.service.js";

type JobRow = typeof jobs.$inferSelect;
type TaskRow = typeof jobTasks.$inferSelect;

export interface MobileActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

const OFFICE_ROLES: readonly UserRole[] = ["owner", "admin", "dispatcher", "office"];

export class MobileVersionConflictError extends Error {
  constructor(public readonly current: MobileJob | MobileChecklistItem) {
    super("recordVersion is stale; refetch and retry");
  }
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toMobileChecklistItem(row: TaskRow): MobileChecklistItem {
  return {
    id: row.id,
    jobId: row.jobId,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    isRequired: row.isRequired ?? false,
    sortOrder: row.sortOrder ?? 0,
    notes: row.notes ?? null,
    actualMinutes: row.actualMinutes ?? null,
    completedAt: iso(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: buildRecordVersionV1("job_task", row.id, row.updatedAt)
  };
}

export function toMobileJob(row: JobRow, tasks: TaskRow[], onTheWayAt: Date | null): MobileJob {
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    title: row.title ?? null,
    status: row.status as MobileJobStatus,
    priority: row.priority ?? null,
    technicianId: row.technicianId ?? null,
    customerId: row.customerId,
    propertyId: row.propertyId ?? null,
    scheduledStart: iso(row.scheduledStart),
    scheduledEnd: iso(row.scheduledEnd),
    actualStart: iso(row.actualStart),
    onTheWayAt: iso(onTheWayAt),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: buildRecordVersionV1("job", row.id, row.updatedAt),
    checklist: tasks
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())
      .map(toMobileChecklistItem)
  };
}

/** Route order: scheduledStart asc, unscheduled last, then jobNumber. */
export function compareRouteOrder(a: JobRow, b: JobRow): number {
  const at = a.scheduledStart?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = b.scheduledStart?.getTime() ?? Number.POSITIVE_INFINITY;
  if (at !== bt) return at < bt ? -1 : 1;
  return a.jobNumber.localeCompare(b.jobNumber);
}

export function utcDayBounds(date?: string, now: Date = new Date()): { day: string; start: Date; end: Date } {
  const day = date ?? now.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid date");
  }
  return { day, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

async function resolveOwnTechnicianId(actor: MobileActor): Promise<string> {
  const [technician] = await db
    .select()
    .from(technicians)
    .where(
      and(
        eq(technicians.companyId, actor.companyId),
        eq(technicians.userId, actor.userId),
        isNull(technicians.deletedAt)
      )
    )
    .limit(1);
  if (!technician) {
    throw new AppError(ErrorCode.FORBIDDEN, "No technician profile is linked to this user");
  }
  return technician.id;
}

async function loadJobRow(companyId: string, jobId: string): Promise<JobRow> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);
  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }
  return job;
}

/** Tenant-scoped load + assignee check. Technicians get 404 for jobs not assigned to them (no existence leak). */
async function loadAccessibleJob(actor: MobileActor, jobId: string): Promise<JobRow> {
  const job = await loadJobRow(actor.companyId, jobId);
  if (OFFICE_ROLES.includes(actor.role)) return job;
  if (actor.role === "technician") {
    const technicianId = await resolveOwnTechnicianId(actor);
    if (job.technicianId !== technicianId) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }
    return job;
  }
  throw new AppError(ErrorCode.FORBIDDEN, "You do not have access to this resource");
}

async function loadTasks(companyId: string, jobId: string): Promise<TaskRow[]> {
  return db
    .select()
    .from(jobTasks)
    .where(and(eq(jobTasks.companyId, companyId), eq(jobTasks.jobId, jobId), isNull(jobTasks.deletedAt)));
}

async function latestOnTheWayByJob(companyId: string): Promise<Map<string, Date>> {
  const rows = await db
    .select()
    .from(onTheWayNotifications)
    .where(and(eq(onTheWayNotifications.companyId, companyId), isNull(onTheWayNotifications.deletedAt)));
  const map = new Map<string, Date>();
  for (const row of rows) {
    const at = row.sentAt ?? row.createdAt;
    const prev = map.get(row.jobId);
    if (!prev || at.getTime() > prev.getTime()) map.set(row.jobId, at);
  }
  return map;
}

async function buildMobileJob(companyId: string, jobId: string): Promise<MobileJob> {
  const [job, tasks, otw] = await Promise.all([
    loadJobRow(companyId, jobId),
    loadTasks(companyId, jobId),
    latestOnTheWayByJob(companyId)
  ]);
  return toMobileJob(job, tasks, otw.get(jobId) ?? null);
}

async function assertJobVersion(actor: MobileActor, job: JobRow, recordVersion: string | undefined) {
  if (recordVersion === undefined) return;
  if (recordVersion !== buildRecordVersionV1("job", job.id, job.updatedAt)) {
    throw new MobileVersionConflictError(await buildMobileJob(actor.companyId, job.id));
  }
}

export async function getTodayJobs(actor: MobileActor, query: MobileTodayQuery): Promise<MobileTodayResponse> {
  let technicianId: string;
  if (actor.role === "technician") {
    technicianId = await resolveOwnTechnicianId(actor);
  } else if (OFFICE_ROLES.includes(actor.role)) {
    if (!query.technicianId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "technicianId is required for non-technician roles");
    }
    technicianId = query.technicianId;
  } else {
    throw new AppError(ErrorCode.FORBIDDEN, "You do not have access to this resource");
  }

  const { day, start, end } = utcDayBounds(query.date);
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, actor.companyId), eq(jobs.technicianId, technicianId), isNull(jobs.deletedAt)));

  const dayJobs = rows
    .filter((job) => job.technicianId === technicianId)
    .filter((job) => job.scheduledStart && job.scheduledStart >= start && job.scheduledStart < end)
    .sort(compareRouteOrder);

  const otw = await latestOnTheWayByJob(actor.companyId);
  const result: MobileJob[] = [];
  for (const job of dayJobs) {
    result.push(toMobileJob(job, await loadTasks(actor.companyId, job.id), otw.get(job.id) ?? null));
  }

  return { contractVersion: TECHNICIAN_MOBILE_CONTRACT_VERSION, date: day, technicianId, jobs: result };
}

export async function getMobileJob(actor: MobileActor, jobId: string): Promise<MobileJob> {
  await loadAccessibleJob(actor, jobId);
  return buildMobileJob(actor.companyId, jobId);
}

export async function markOnTheWay(actor: MobileActor, jobId: string, input: MobileOnTheWayBody): Promise<MobileJob> {
  const job = await loadAccessibleJob(actor, jobId);
  await assertJobVersion(actor, job, input.recordVersion);

  if (!job.technicianId) {
    throw new AppError(ErrorCode.CONFLICT, "Job has no assigned technician");
  }

  if (job.status === "scheduled" || job.status === "on_hold") {
    await transitionStatus(actor.companyId, actor.userId, jobId, "dispatched", "on_the_way");
  } else if (job.status !== "dispatched") {
    throw new AppError(ErrorCode.CONFLICT, `Job cannot go on the way from ${job.status}`);
  }

  const technicianId = job.technicianId;
  await db.transaction(async (tx) => {
    const [actorRow] = await tx
      .select()
      .from(users)
      .where(and(eq(users.companyId, actor.companyId), eq(users.id, actor.userId)))
      .limit(1);
    const [row] = await tx
      .insert(onTheWayNotifications)
      .values({
        companyId: actor.companyId,
        jobId,
        technicianId,
        customerId: job.customerId,
        // Not sent: channel "none" + sentAt null. Customer SMS stays on POST /jobs/:id/on-the-way.
        sentAt: null,
        channel: "none",
        message: null,
        estimatedArrivalMinutes: input.estimatedArrivalMinutes ?? null,
        technicianLat: input.technicianLat === undefined ? null : input.technicianLat.toFixed(7),
        technicianLng: input.technicianLng === undefined ? null : input.technicianLng.toFixed(7)
      })
      .returning();
    await emitEventWithExecutor(tx, {
      companyId: actor.companyId,
      eventType: "technician.on_the_way",
      actorId: actor.userId,
      actorType: "user",
      actorName: actorRow ? `${actorRow.firstName} ${actorRow.lastName}`.trim() : null,
      entityType: "job",
      entityId: jobId,
      customerId: job.customerId,
      jobId,
      payload: {
        technicianId,
        onTheWayId: row?.id ?? null,
        estimatedArrivalMinutes: input.estimatedArrivalMinutes ?? null,
        customerNotified: false,
        source: "mobile"
      },
      summary: `Technician on the way for ${job.jobNumber}`
    });
  });

  return buildMobileJob(actor.companyId, jobId);
}

export async function updateMobileJobStatus(actor: MobileActor, jobId: string, input: MobileStatusBody): Promise<MobileJob> {
  const job = await loadAccessibleJob(actor, jobId);
  await assertJobVersion(actor, job, input.recordVersion);
  if (job.status !== input.status) {
    await transitionStatus(actor.companyId, actor.userId, jobId, input.status, input.reason);
  }
  return buildMobileJob(actor.companyId, jobId);
}

export async function updateMobileChecklistItem(
  actor: MobileActor,
  jobId: string,
  taskId: string,
  input: MobileChecklistUpdateBody
): Promise<MobileChecklistItem> {
  await loadAccessibleJob(actor, jobId);
  const tasks = await loadTasks(actor.companyId, jobId);
  const task = tasks.find((row) => row.id === taskId);
  if (!task) {
    throw new AppError(ErrorCode.NOT_FOUND, "Checklist item not found");
  }
  if (input.recordVersion !== undefined && input.recordVersion !== buildRecordVersionV1("job_task", task.id, task.updatedAt)) {
    throw new MobileVersionConflictError(toMobileChecklistItem(task));
  }
  await updateTask(actor.companyId, jobId, taskId, {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.actualMinutes !== undefined ? { actualMinutes: input.actualMinutes } : {})
  });
  const updated = (await loadTasks(actor.companyId, jobId)).find((row) => row.id === taskId);
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, "Checklist item not found");
  }
  return toMobileChecklistItem(updated);
}

export const ISSUE_NOTE_PREFIX = "[ISSUE";

export function formatIssueNote(input: Pick<MobileReportIssueBody, "category" | "severity" | "description">): string {
  return `${ISSUE_NOTE_PREFIX} ${input.category}/${input.severity}] ${input.description}`;
}

export async function reportJobIssue(
  actor: MobileActor,
  jobId: string,
  input: MobileReportIssueBody
): Promise<{ issue: MobileIssue; job: MobileJob }> {
  const job = await loadAccessibleJob(actor, jobId);
  await assertJobVersion(actor, job, input.recordVersion);
  if (!MOBILE_ISSUE_CATEGORIES.includes(input.category)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid issue category");
  }

  // Stored as an internal job note (existing job_notes table, RLS already in place); no new table.
  const note = await addNote(actor.companyId, actor.userId, jobId, {
    content: formatIssueNote(input),
    isInternal: true
  });

  if (input.putOnHold && job.status !== "on_hold") {
    await transitionStatus(actor.companyId, actor.userId, jobId, "on_hold", `issue:${input.category}`);
  }

  return {
    issue: {
      id: note.id,
      jobId,
      category: input.category,
      severity: input.severity,
      description: input.description,
      reportedById: actor.userId,
      createdAt: new Date(note.createdAt).toISOString()
    },
    job: await buildMobileJob(actor.companyId, jobId)
  };
}
