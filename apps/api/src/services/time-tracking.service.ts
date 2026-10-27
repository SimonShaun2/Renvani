import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import {
  customers,
  db,
  emitEventWithExecutor,
  jobs,
  onTheWayNotifications,
  technicians,
  timeEntries,
  users
} from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  type ListTechnicianTimeQuery,
  type PaginatedResult,
  type StartTimeEntryInput,
  type StopTimeEntryInput,
  type TimeEntry,
  type UpdateTimeEntryInput
} from "@fsm/types";
import { invalidateDispatchCache } from "./dispatch.service.js";
import { assertTimeEntryDatesNotLocked, guardOpenEntryInsert, TimesheetConflictError } from "./timesheets.service.js";

type CustomerRow = typeof customers.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type TechnicianRow = typeof technicians.$inferSelect;
type TimeEntryRow = typeof timeEntries.$inferSelect;
type UserRow = typeof users.$inferSelect;
type OnTheWayNotificationRow = typeof onTheWayNotifications.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

interface SendOnTheWayInput {
  technicianId?: string;
  estimatedArrivalMinutes?: number;
  message?: string;
  technicianLat?: number;
  technicianLng?: number;
}

export interface OnTheWayNotification {
  id: string;
  companyId: string;
  jobId: string;
  technicianId: string;
  customerId: string;
  sentAt: Date | null;
  channel: string | null;
  message: string | null;
  estimatedArrivalMinutes: number | null;
  technicianLat: string | null;
  technicianLng: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const logger = pino({
  name: "time-tracking-service"
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function toTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    ...row,
    entryType: row.entryType as TimeEntry["entryType"]
  };
}

function toOnTheWayNotification(row: OnTheWayNotificationRow): OnTheWayNotification {
  return {
    ...row
  };
}

function calculateDurationMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

function sameUtcDay(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function parseDateBoundary(value: string | undefined, boundary: "start" | "end"): Date | null {
  if (!value) {
    return null;
  }

  return new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  if (!actor) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  }

  return actor;
}

async function getJobRecord(companyId: string, jobId: string, executor: SelectExecutor): Promise<JobRow> {
  const [job] = await executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  return job;
}

async function getTechnicianRecord(
  companyId: string,
  technicianId: string,
  executor: SelectExecutor
): Promise<TechnicianRow> {
  const [technician] = await executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt)))
    .limit(1);

  if (!technician) {
    throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
  }

  return technician;
}

async function getCustomerRecord(companyId: string, customerId: string, executor: SelectExecutor): Promise<CustomerRow> {
  const [customer] = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  return customer;
}

async function resolveTechnicianId(
  companyId: string,
  actor: UserRow,
  requestedTechnicianId: string | undefined,
  executor: SelectExecutor
): Promise<string> {
  if (requestedTechnicianId) {
    await getTechnicianRecord(companyId, requestedTechnicianId, executor);
    return requestedTechnicianId;
  }

  if (actor.technicianId) {
    await getTechnicianRecord(companyId, actor.technicianId, executor);
    return actor.technicianId;
  }

  throw new AppError(
    ErrorCode.VALIDATION_ERROR,
    "A technicianId is required when the current user is not linked to a technician"
  );
}

export async function listJobTimeEntries(companyId: string, jobId: string): Promise<TimeEntry[]> {
  await getJobRecord(companyId, jobId, db);

  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.jobId, jobId), isNull(timeEntries.deletedAt)));

  return rows
    .slice()
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
    .map((row) => toTimeEntry(row));
}

export async function startTimeEntry(
  companyId: string,
  actorId: string,
  jobId: string,
  input: StartTimeEntryInput
): Promise<TimeEntry> {
  // FS-171: time_entries_open_technician_idx (0046) is the real guard; a race past the
  // pre-checks surfaces as 23505 and maps to 409 open_entry_exists.
  const result = await guardOpenEntryInsert(() => db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const technicianId = await resolveTechnicianId(companyId, actor, input.technicianId, tx);
    const [job, technician] = await Promise.all([
      getJobRecord(companyId, jobId, tx),
      getTechnicianRecord(companyId, technicianId, tx)
    ]);

    const existingEntries = await tx
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.companyId, companyId),
          eq(timeEntries.jobId, jobId),
          eq(timeEntries.technicianId, technicianId),
          isNull(timeEntries.deletedAt)
        )
      );

    if (existingEntries.some((entry) => entry.endedAt === null)) {
      throw new AppError(ErrorCode.CONFLICT, "This technician already has an open time entry for this job");
    }

    const otherOpenEntries = await tx
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.companyId, companyId),
          eq(timeEntries.technicianId, technicianId),
          isNull(timeEntries.endedAt),
          isNull(timeEntries.deletedAt)
        )
      );

    if (otherOpenEntries.length > 0) {
      throw new TimesheetConflictError("open_entry_exists", "Technician is already clocked in on another job", null);
    }

    const now = new Date();
    const insertedEntries = await tx
      .insert(timeEntries)
      .values({
        companyId,
        jobId: job.id,
        technicianId: technician.id,
        startedAt: now,
        entryType: input.entryType ?? "on_site",
        notes: normalizeOptionalString(input.notes),
        travelFromAddress: normalizeOptionalString(input.travelFromAddress)
      })
      .returning();
    const entry = insertedEntries[0];

    if (!entry) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create time entry");
    }

    const transitionedFromScheduled = job.status === "scheduled";

    if (transitionedFromScheduled) {
      await tx
        .update(jobs)
        .set({
          status: "in_progress",
          actualStart: job.actualStart ?? now,
          updatedAt: now
        })
        .where(and(eq(jobs.companyId, companyId), eq(jobs.id, job.id), isNull(jobs.deletedAt)));
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "job.time_started",
      actorId: actor.id,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "job",
      entityId: job.id,
      customerId: job.customerId,
      jobId: job.id,
      payload: {
        technicianId,
        entryId: entry.id,
        entryType: entry.entryType
      },
      summary: `Time started for ${job.jobNumber}`
    });

    return {
      entry: toTimeEntry(entry),
      transitionedFromScheduled,
      scheduledStart: job.scheduledStart
    };
  }));

  if (result.transitionedFromScheduled && result.scheduledStart) {
    await invalidateDispatchCache(companyId, formatDateOnly(result.scheduledStart));
  }

  return result.entry;
}

export async function stopTimeEntry(
  companyId: string,
  actorId: string,
  jobId: string,
  input: StopTimeEntryInput
): Promise<TimeEntry> {
  return db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const technicianId = await resolveTechnicianId(companyId, actor, input.technicianId, tx);
    const job = await getJobRecord(companyId, jobId, tx);

    const existingEntries = await tx
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.companyId, companyId),
          eq(timeEntries.jobId, jobId),
          eq(timeEntries.technicianId, technicianId),
          isNull(timeEntries.deletedAt)
        )
      );
    const openEntry = existingEntries.find((entry) => entry.endedAt === null);

    if (!openEntry) {
      throw new AppError(ErrorCode.NOT_FOUND, "Open time entry not found");
    }

    const endedAt = new Date();
    const durationMinutes = calculateDurationMinutes(openEntry.startedAt, endedAt);
    const updatedEntries = await tx
      .update(timeEntries)
      .set({
        endedAt,
        durationMinutes,
        notes: normalizeOptionalString(input.notes) ?? openEntry.notes,
        updatedAt: endedAt
      })
      .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.id, openEntry.id), isNull(timeEntries.deletedAt)))
      .returning();
    const updatedEntry = updatedEntries[0];

    if (!updatedEntry) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to stop time entry");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "job.time_stopped",
      actorId: actor.id,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "job",
      entityId: job.id,
      customerId: job.customerId,
      jobId: job.id,
      payload: {
        technicianId,
        entryId: updatedEntry.id,
        durationMinutes
      },
      summary: `Time stopped for ${job.jobNumber}`
    });

    return toTimeEntry(updatedEntry);
  });
}

export async function updateTimeEntry(
  companyId: string,
  actorId: string,
  entryId: string,
  input: UpdateTimeEntryInput
): Promise<TimeEntry> {
  // Reopening (endedAt: null) can clash with another open entry: 23505 -> 409.
  return guardOpenEntryInsert(() => db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const entries = await tx
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.id, entryId), isNull(timeEntries.deletedAt)));
    const entry = entries[0];

    if (!entry) {
      throw new AppError(ErrorCode.NOT_FOUND, "Time entry not found");
    }

    const startedAt = input.startedAt ? new Date(input.startedAt) : entry.startedAt;
    // FS-171: approved timesheet periods are locked here too (reopen first).
    await assertTimeEntryDatesNotLocked(companyId, entry.technicianId, [entry.startedAt, startedAt], tx);
    const endedAt =
      input.endedAt === undefined ? entry.endedAt : input.endedAt === null ? null : new Date(input.endedAt);
    const durationMinutes = endedAt ? calculateDurationMinutes(startedAt, endedAt) : null;
    const now = new Date();
    const updatedEntries = await tx
      .update(timeEntries)
      .set({
        startedAt,
        endedAt,
        durationMinutes,
        entryType: input.entryType ?? entry.entryType,
        notes: normalizeOptionalString(input.notes) ?? entry.notes,
        travelFromAddress: normalizeOptionalString(input.travelFromAddress) ?? entry.travelFromAddress,
        updatedAt: now
      })
      .where(and(eq(timeEntries.companyId, companyId), eq(timeEntries.id, entryId), isNull(timeEntries.deletedAt)))
      .returning();
    const updatedEntry = updatedEntries[0];

    if (!updatedEntry) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update time entry");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "job.updated",
      actorId: actor.id,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "time_entry",
      entityId: updatedEntry.id,
      jobId: updatedEntry.jobId,
      payload: {
        durationMinutes,
        entryType: updatedEntry.entryType
      },
      summary: "Time entry updated"
    });

    return toTimeEntry(updatedEntry);
  }));
}

export async function listTechnicianTime(
  companyId: string,
  technicianId: string,
  query: ListTechnicianTimeQuery
): Promise<PaginatedResult<TimeEntry>> {
  await getTechnicianRecord(companyId, technicianId, db);

  const startBoundary = parseDateBoundary(query.startDate, "start");
  const endBoundary = parseDateBoundary(query.endDate, "end");
  const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, MAX_LIMIT) : DEFAULT_LIMIT;

  const rows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.companyId, companyId),
        eq(timeEntries.technicianId, technicianId),
        isNull(timeEntries.deletedAt)
      )
    );

  const filteredRows = rows
    .filter((row) => {
      if (query.jobId && row.jobId !== query.jobId) {
        return false;
      }

      if (startBoundary && row.startedAt.getTime() < startBoundary.getTime()) {
        return false;
      }

      if (endBoundary && row.startedAt.getTime() > endBoundary.getTime()) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());

  const total = filteredRows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const pageOffset = (page - 1) * limit;

  return {
    data: filteredRows.slice(pageOffset, pageOffset + limit).map((row) => toTimeEntry(row)),
    total,
    page,
    limit,
    totalPages
  };
}

export async function sendOnTheWayNotification(
  companyId: string,
  actorId: string,
  jobId: string,
  input: SendOnTheWayInput
): Promise<OnTheWayNotification> {
  const result = await db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const technicianId = await resolveTechnicianId(companyId, actor, input.technicianId, tx);
    const [job, technician] = await Promise.all([
      getJobRecord(companyId, jobId, tx),
      getTechnicianRecord(companyId, technicianId, tx)
    ]);
    const customer = await getCustomerRecord(companyId, job.customerId, tx);

    const existingNotifications = await tx
      .select()
      .from(onTheWayNotifications)
      .where(
        and(
          eq(onTheWayNotifications.companyId, companyId),
          eq(onTheWayNotifications.jobId, jobId),
          isNull(onTheWayNotifications.deletedAt)
        )
      );
    const now = new Date();

    if (existingNotifications.some((notification) => notification.sentAt && sameUtcDay(notification.sentAt, now))) {
      throw new AppError(ErrorCode.CONFLICT, "On-the-way notification already sent for this job today");
    }

    const defaultMessage =
      input.estimatedArrivalMinutes && input.estimatedArrivalMinutes > 0
        ? `${technician.firstName} is on the way and should arrive in about ${input.estimatedArrivalMinutes} minutes.`
        : `${technician.firstName} is on the way to your appointment.`;

    const insertedNotifications = await tx
      .insert(onTheWayNotifications)
      .values({
        companyId,
        jobId: job.id,
        technicianId,
        customerId: job.customerId,
        sentAt: now,
        channel: "sms",
        message: normalizeOptionalString(input.message) ?? defaultMessage,
        estimatedArrivalMinutes: input.estimatedArrivalMinutes ?? null,
        technicianLat:
          input.technicianLat === undefined ? null : input.technicianLat.toFixed(7),
        technicianLng:
          input.technicianLng === undefined ? null : input.technicianLng.toFixed(7)
      })
      .returning();
    const notification = insertedNotifications[0];

    if (!notification) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create on-the-way notification");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "technician.on_the_way",
      actorId: actor.id,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "job",
      entityId: job.id,
      customerId: job.customerId,
      jobId: job.id,
      payload: {
        technicianId,
        notificationId: notification.id,
        estimatedArrivalMinutes: notification.estimatedArrivalMinutes
      },
      summary: `On-the-way update sent for ${job.jobNumber}`
    });

    return {
      notification: toOnTheWayNotification(notification),
      queueData: {
        companyId,
        jobId: job.id,
        customerId: job.customerId,
        technicianId,
        estimatedArrivalMinutes: notification.estimatedArrivalMinutes,
        notificationId: notification.id,
        message: notification.message,
        customerPhone: customer.phone
      }
    };
  });

  await notificationsQueue.add("send-otw-notification", result.queueData);
  logger.info({ companyId, jobId, technicianId: result.notification.technicianId }, "Queued OTW notification");
  return result.notification;
}

export async function getOnTheWayStatus(companyId: string, jobId: string): Promise<OnTheWayNotification | null> {
  await getJobRecord(companyId, jobId, db);

  const rows = await db
    .select()
    .from(onTheWayNotifications)
    .where(
      and(
        eq(onTheWayNotifications.companyId, companyId),
        eq(onTheWayNotifications.jobId, jobId),
        isNull(onTheWayNotifications.deletedAt)
      )
    );

  const latestNotification = rows
    .slice()
    .sort((left, right) => {
      const leftTimestamp = left.sentAt?.getTime() ?? left.createdAt.getTime();
      const rightTimestamp = right.sentAt?.getTime() ?? right.createdAt.getTime();
      return rightTimestamp - leftTimestamp;
    })[0];

  return latestNotification ? toOnTheWayNotification(latestNotification) : null;
}
