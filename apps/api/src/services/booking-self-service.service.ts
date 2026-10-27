import { and, eq, isNull } from "drizzle-orm";

import {
  bookingRequests,
  bookingSettings,
  db,
  emitEventWithExecutor,
  jobs,
  scheduleSlots,
  technicians
} from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";
import {
  AppError,
  type BookingSelfServiceActionResult,
  type BookingSelfServiceView,
  type ConfirmBookingRequestInput,
  ErrorCode,
  type PublicBookingManageHoldInput,
  type PublicBookingManageRescheduleInput
} from "@fsm/types";

import {
  assertBookingManageTokenActive,
  BOOKING_MANAGE_TOKEN_TTL_SECONDS,
  verifyBookingManageToken,
  type BookingManageTokenPayload
} from "../lib/booking-manage-token.js";
import {
  claimBookingManageTokenHoldLock,
  claimBookingManageTokenUse,
  releaseBookingManageTokenHoldLock,
  releaseBookingManageTokenUse
} from "../lib/booking-manage-token-store.js";
import { getBookingAvailability, getPublicBookingSettingsBySlug } from "./booking.service.js";
import { invalidateDispatchCache } from "./dispatch.service.js";
import { notifyOperatorBookingSelfService } from "./scheduling-booking-self-service-inbox.service.js";

const BOOKING_SLOT_HOLD_NOTE_PREFIX = "booking_hold:";

type BookingRequestRow = typeof bookingRequests.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

function buildBookingSlotHoldNote(bookingRequestId: string): string {
  return `${BOOKING_SLOT_HOLD_NOTE_PREFIX}${bookingRequestId}`;
}

function parseIsoDateTime(value: string, field: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Invalid ${field}`);
  }

  return parsed;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function assertHoldSlotMatchesPublishedAvailability(
  slug: string,
  zip: string,
  technicianId: string,
  scheduledStart: Date,
  scheduledEnd: Date
): Promise<void> {
  const date = formatDateOnly(scheduledStart);
  const windows = await getBookingAvailability(slug, zip, date);
  const startIso = scheduledStart.toISOString();
  const endIso = scheduledEnd.toISOString();
  const matched = windows.some(
    (window) =>
      window.start === startIso && window.end === endIso && window.technicianIds.includes(technicianId)
  );

  if (!matched) {
    throw new AppError(ErrorCode.CONFLICT, "Selected slot is not available for this booking area");
  }
}

/**
 * MVP: the self-service cutoff is fixed at 24 hours. There is no settings write path;
 * the customer_self_service_cutoff_hours column keeps its default of 24 and is not read.
 */
export const BOOKING_SELF_SERVICE_CUTOFF_HOURS = 24;

function resolveCutoffHours(_settingsRow: { customerSelfServiceCutoffHours: number | null }): number {
  return BOOKING_SELF_SERVICE_CUTOFF_HOURS;
}

async function claimManageLinkOrThrow(claims: BookingManageTokenPayload): Promise<void> {
  const claimed = await claimBookingManageTokenUse(claims.jti, BOOKING_MANAGE_TOKEN_TTL_SECONDS);

  if (!claimed) {
    throw new AppError(ErrorCode.CONFLICT, "This manage link has already been used");
  }
}

function assertWithinCutoff(scheduledStart: Date | null, cutoffHours: number): void {
  if (!scheduledStart) {
    throw new AppError(ErrorCode.CONFLICT, "Appointment has no scheduled time");
  }

  const cutoffMs = cutoffHours * 60 * 60 * 1000;
  const deadline = scheduledStart.getTime() - cutoffMs;

  if (Date.now() > deadline) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Changes must be made at least ${cutoffHours} hours before the appointment`
    );
  }
}

async function loadSelfServiceContext(
  manageToken: string
): Promise<{
  claims: BookingManageTokenPayload;
  bookingRequest: BookingRequestRow;
  job: JobRow;
  settings: typeof bookingSettings.$inferSelect;
  companyName: string;
}> {
  const claims = verifyBookingManageToken(manageToken);
  await assertBookingManageTokenActive(claims);

  const [settings] = await db
    .select()
    .from(bookingSettings)
    .where(
      and(
        eq(bookingSettings.companyId, claims.companyId),
        eq(bookingSettings.bookingSlug, claims.bookingSlug),
        isNull(bookingSettings.deletedAt)
      )
    )
    .limit(1);

  if (!settings) {
    throw new AppError(ErrorCode.NOT_FOUND, "Booking page not found");
  }

  const publicSettings = await getPublicBookingSettingsBySlug(claims.bookingSlug);

  const [bookingRequest] = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, claims.companyId),
        eq(bookingRequests.id, claims.bookingRequestId),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);

  if (!bookingRequest || bookingRequest.referenceNumber !== claims.referenceNumber) {
    throw new AppError(ErrorCode.NOT_FOUND, "Booking not found");
  }

  if (bookingRequest.status !== "confirmed" || !bookingRequest.jobId) {
    throw new AppError(ErrorCode.CONFLICT, "Only confirmed bookings can be managed with this link");
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.companyId, claims.companyId), eq(jobs.id, claims.jobId), isNull(jobs.deletedAt))
    )
    .limit(1);

  if (!job || job.id !== bookingRequest.jobId) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  if (job.status === "cancelled" || job.status === "completed") {
    throw new AppError(ErrorCode.CONFLICT, "This appointment can no longer be changed online");
  }

  return {
    claims,
    bookingRequest,
    job,
    settings,
    companyName: publicSettings.companyName
  };
}

export async function getBookingSelfServiceView(manageToken: string): Promise<BookingSelfServiceView> {
  const { claims, bookingRequest, job, settings, companyName } = await loadSelfServiceContext(manageToken);
  const cutoffHours = resolveCutoffHours(settings);
  const scheduledStart = job.scheduledStart;
  let withinCutoff = true;

  try {
    assertWithinCutoff(scheduledStart, cutoffHours);
  } catch {
    withinCutoff = false;
  }

  const expiresAt = new Date(claims.exp * 1000).toISOString();

  return {
    bookingSlug: claims.bookingSlug,
    referenceNumber: claims.referenceNumber,
    companyName,
    confirmation: {
      referenceNumber: claims.referenceNumber,
      status: bookingRequest.status as BookingSelfServiceView["confirmation"]["status"],
      companyName,
      scheduledStart: job.scheduledStart?.toISOString() ?? null,
      scheduledEnd: job.scheduledEnd?.toISOString() ?? null
    },
    canReschedule: withinCutoff,
    canCancel: withinCutoff,
    cutoffHours,
    expiresAt
  };
}

export async function getBookingSelfServiceAvailability(
  manageToken: string,
  date: string
): Promise<Awaited<ReturnType<typeof getBookingAvailability>>> {
  const { claims, bookingRequest } = await loadSelfServiceContext(manageToken);
  return getBookingAvailability(claims.bookingSlug, bookingRequest.zip, date);
}

async function assertTechnicianScheduleSlotAvailableForReschedule(
  companyId: string,
  technicianId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  executor: TransactionExecutor,
  bookingRequestId: string,
  jobId: string
): Promise<void> {
  const companySlots = await executor
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.companyId, companyId),
        eq(scheduleSlots.technicianId, technicianId),
        isNull(scheduleSlots.deletedAt)
      )
    );

  const ignoreNote = buildBookingSlotHoldNote(bookingRequestId);
  const hasConflict = companySlots.some((slot) => {
    if (slot.notes === ignoreNote) {
      return false;
    }

    if (slot.jobId === jobId) {
      return false;
    }

    return (
      slot.startTime.getTime() < scheduledEnd.getTime() && slot.endTime.getTime() > scheduledStart.getTime()
    );
  });

  if (hasConflict) {
    throw new AppError(ErrorCode.CONFLICT, "Selected slot is no longer available");
  }
}

async function clearBookingSlotHolds(
  companyId: string,
  bookingRequestId: string,
  executor: TransactionExecutor
): Promise<void> {
  const holdNote = buildBookingSlotHoldNote(bookingRequestId);
  const existingHolds = await executor
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.companyId, companyId),
        eq(scheduleSlots.notes, holdNote),
        isNull(scheduleSlots.deletedAt)
      )
    );

  const now = new Date();

  for (const slot of existingHolds) {
    await executor
      .update(scheduleSlots)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(scheduleSlots.id, slot.id));
  }
}

async function assertActiveHoldMatchesSelection(
  companyId: string,
  bookingRequestId: string,
  input: ConfirmBookingRequestInput,
  executor: TransactionExecutor
): Promise<void> {
  const holdNote = buildBookingSlotHoldNote(bookingRequestId);
  const holds = await executor
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.companyId, companyId),
        eq(scheduleSlots.notes, holdNote),
        isNull(scheduleSlots.deletedAt)
      )
    );

  const activeHold = holds.find((slot) => !slot.isConfirmed);

  if (!activeHold) {
    throw new AppError(ErrorCode.CONFLICT, "Reschedule requires an active slot hold");
  }

  const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
  const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

  if (
    activeHold.technicianId !== input.technicianId ||
    activeHold.startTime.getTime() !== scheduledStart.getTime() ||
    activeHold.endTime.getTime() !== scheduledEnd.getTime()
  ) {
    throw new AppError(ErrorCode.CONFLICT, "Reschedule must match the active slot hold");
  }
}

export async function holdBookingSelfServiceSlot(
  manageToken: string,
  input: PublicBookingManageHoldInput
): Promise<{ hold: { technicianId: string; scheduledStart: string; scheduledEnd: string } }> {
  const { claims, bookingRequest, job, settings } = await loadSelfServiceContext(manageToken);
  const cutoffHours = resolveCutoffHours(settings);
  assertWithinCutoff(job.scheduledStart, cutoffHours);

  const locked = await claimBookingManageTokenHoldLock(claims.jti, 15 * 60);

  if (!locked) {
    throw new AppError(ErrorCode.CONFLICT, "Another reschedule action is in progress");
  }

  try {
    const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
    const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

    if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "scheduledEnd must be after scheduledStart");
    }

    await assertHoldSlotMatchesPublishedAvailability(
      claims.bookingSlug,
      bookingRequest.zip,
      input.technicianId,
      scheduledStart,
      scheduledEnd
    );

    await db.transaction(async (tx) => {
      const [technician] = await tx
        .select()
        .from(technicians)
        .where(
          and(
            eq(technicians.companyId, claims.companyId),
            eq(technicians.id, input.technicianId),
            isNull(technicians.deletedAt)
          )
        )
        .limit(1);

      if (!technician) {
        throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
      }

      await assertTechnicianScheduleSlotAvailableForReschedule(
        claims.companyId,
        input.technicianId,
        scheduledStart,
        scheduledEnd,
        tx,
        bookingRequest.id,
        job.id
      );

      await clearBookingSlotHolds(claims.companyId, bookingRequest.id, tx);

      await tx.insert(scheduleSlots).values({
        companyId: claims.companyId,
        technicianId: input.technicianId,
        jobId: null,
        startTime: scheduledStart,
        endTime: scheduledEnd,
        isConfirmed: false,
        notes: buildBookingSlotHoldNote(bookingRequest.id)
      });
    });

    return {
      hold: {
        technicianId: input.technicianId,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd
      }
    };
  } catch (error) {
    await releaseBookingManageTokenHoldLock(claims.jti);
    throw error;
  }
}

export async function rescheduleBookingSelfService(
  manageToken: string,
  input: PublicBookingManageRescheduleInput
): Promise<BookingSelfServiceActionResult> {
  const { claims, bookingRequest, job, settings, companyName } = await loadSelfServiceContext(manageToken);
  const cutoffHours = resolveCutoffHours(settings);
  assertWithinCutoff(job.scheduledStart, cutoffHours);

  const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
  const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

  await claimManageLinkOrThrow(claims);

  let result: JobRow;
  try {
  result = await db.transaction(async (tx) => {
    await assertActiveHoldMatchesSelection(claims.companyId, bookingRequest.id, input, tx);

    await assertTechnicianScheduleSlotAvailableForReschedule(
      claims.companyId,
      input.technicianId,
      scheduledStart,
      scheduledEnd,
      tx,
      bookingRequest.id,
      job.id
    );

    const jobSlots = await tx
      .select()
      .from(scheduleSlots)
      .where(
        and(
          eq(scheduleSlots.companyId, claims.companyId),
          eq(scheduleSlots.jobId, job.id),
          isNull(scheduleSlots.deletedAt)
        )
      );

    const now = new Date();

    for (const slot of jobSlots) {
      await tx
        .update(scheduleSlots)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(scheduleSlots.id, slot.id));
    }

    await clearBookingSlotHolds(claims.companyId, bookingRequest.id, tx);

    const updatedJobs = await tx
      .update(jobs)
      .set({
        technicianId: input.technicianId,
        scheduledStart,
        scheduledEnd,
        updatedAt: now
      })
      .where(and(eq(jobs.companyId, claims.companyId), eq(jobs.id, job.id), isNull(jobs.deletedAt)))
      .returning();

    const updatedJob = updatedJobs[0];

    if (!updatedJob) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to reschedule job");
    }

    await tx.insert(scheduleSlots).values({
      companyId: claims.companyId,
      technicianId: input.technicianId,
      jobId: job.id,
      startTime: scheduledStart,
      endTime: scheduledEnd,
      isConfirmed: true
    });

    const claimedRequests = await tx
      .update(bookingRequests)
      .set({
        assignedTechnicianId: input.technicianId,
        preferredDate: formatDateOnly(scheduledStart),
        updatedAt: now
      })
      .where(and(eq(bookingRequests.id, bookingRequest.id), eq(bookingRequests.status, "confirmed")))
      .returning();

    if (claimedRequests.length === 0) {
      throw new AppError(ErrorCode.CONFLICT, "This appointment can no longer be changed online");
    }

    await emitEventWithExecutor(tx, {
      companyId: claims.companyId,
      eventType: "job.rescheduled",
      actorType: "customer",
      actorName: `${bookingRequest.firstName} ${bookingRequest.lastName}`.trim(),
      entityType: "job",
      entityId: job.id,
      customerId: bookingRequest.customerId ?? undefined,
      jobId: job.id,
      payload: {
        bookingRequestId: bookingRequest.id,
        technicianId: input.technicianId,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        source: "customer_self_service"
      },
      summary: `Customer rescheduled booking ${claims.referenceNumber}`
    });

    return updatedJob;
  });
  } catch (error) {
    await releaseBookingManageTokenUse(claims.jti);
    throw error;
  }

  await releaseBookingManageTokenHoldLock(claims.jti);

  const summary = `${companyName}: customer rescheduled booking ${claims.referenceNumber} to ${scheduledStart.toLocaleString("en-US")}.`;

  await notifyOperatorBookingSelfService({
    companyId: claims.companyId,
    claims,
    action: "reschedule",
    summary,
    scheduledStart: result.scheduledStart?.toISOString() ?? null,
    scheduledEnd: result.scheduledEnd?.toISOString() ?? null
  });

  if (result.scheduledStart) {
    await invalidateDispatchCache(claims.companyId, formatDateOnly(result.scheduledStart));
  }

  return {
    referenceNumber: claims.referenceNumber,
    status: "confirmed",
    scheduledStart: result.scheduledStart?.toISOString() ?? null,
    scheduledEnd: result.scheduledEnd?.toISOString() ?? null
  };
}

export async function cancelBookingSelfService(manageToken: string): Promise<BookingSelfServiceActionResult> {
  const { claims, bookingRequest, job, settings, companyName } = await loadSelfServiceContext(manageToken);
  const cutoffHours = resolveCutoffHours(settings);
  assertWithinCutoff(job.scheduledStart, cutoffHours);

  await claimManageLinkOrThrow(claims);

  try {
  await db.transaction(async (tx) => {
    const now = new Date();

    const cancelledRequests = await tx
      .update(bookingRequests)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancellationReason: "Customer self-service cancel",
        updatedAt: now
      })
      .where(and(eq(bookingRequests.id, bookingRequest.id), eq(bookingRequests.status, "confirmed")))
      .returning();

    if (cancelledRequests.length === 0) {
      throw new AppError(ErrorCode.CONFLICT, "This appointment can no longer be changed online");
    }

    await tx
      .update(jobs)
      .set({
        status: "cancelled",
        updatedAt: now
      })
      .where(and(eq(jobs.companyId, claims.companyId), eq(jobs.id, job.id), isNull(jobs.deletedAt)));

    await emitEventWithExecutor(tx, {
      companyId: claims.companyId,
      eventType: "booking.cancelled",
      actorType: "customer",
      actorName: `${bookingRequest.firstName} ${bookingRequest.lastName}`.trim(),
      entityType: "booking_request",
      entityId: bookingRequest.id,
      customerId: bookingRequest.customerId ?? undefined,
      jobId: job.id,
      payload: {
        source: "customer_self_service"
      },
      summary: `Customer cancelled booking ${claims.referenceNumber}`
    });

    await emitEventWithExecutor(tx, {
      companyId: claims.companyId,
      eventType: "job.cancelled",
      actorType: "customer",
      actorName: `${bookingRequest.firstName} ${bookingRequest.lastName}`.trim(),
      entityType: "job",
      entityId: job.id,
      customerId: bookingRequest.customerId ?? undefined,
      jobId: job.id,
      payload: {
        source: "customer_self_service"
      },
      summary: `Job cancelled via customer self-service (${claims.referenceNumber})`
    });
  });
  } catch (error) {
    await releaseBookingManageTokenUse(claims.jti);
    throw error;
  }

  const summary = `${companyName}: customer cancelled booking ${claims.referenceNumber}.`;

  await notifyOperatorBookingSelfService({
    companyId: claims.companyId,
    claims,
    action: "cancel",
    summary,
    scheduledStart: job.scheduledStart?.toISOString() ?? null,
    scheduledEnd: job.scheduledEnd?.toISOString() ?? null
  });

  if (settings.notifyOnNewBooking) {
    await notificationsQueue.add("send-booking-request-alert", {
      companyId: claims.companyId,
      bookingRequestId: bookingRequest.id,
      body: summary
    });
  }

  if (job.scheduledStart) {
    await invalidateDispatchCache(claims.companyId, formatDateOnly(job.scheduledStart));
  }

  return {
    referenceNumber: claims.referenceNumber,
    status: "cancelled",
    scheduledStart: null,
    scheduledEnd: null
  };
}
