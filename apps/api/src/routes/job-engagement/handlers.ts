import type { FastifyReply, FastifyRequest } from "fastify";

import type {
  CreateReviewRequestInput,
  ReviewRequest,
  StartTimeEntryInput,
  StopTimeEntryInput,
  TimeEntry
} from "@fsm/types";

import {
  createReviewRequest
} from "../../services/review-request.service.js";
import {
  getOnTheWayStatus,
  listJobTimeEntries,
  sendOnTheWayNotification,
  startTimeEntry,
  stopTimeEntry,
  type OnTheWayNotification
} from "../../services/time-tracking.service.js";
import { TimesheetConflictError } from "../../services/timesheets.service.js";
import type {
  JobIdParams,
  OnTheWayBody
} from "./schemas.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toTimeEntryResponse(entry: TimeEntry) {
  return {
    id: entry.id,
    companyId: entry.companyId,
    jobId: entry.jobId,
    technicianId: entry.technicianId,
    startedAt: entry.startedAt.toISOString(),
    endedAt: toIsoString(entry.endedAt),
    durationMinutes: entry.durationMinutes,
    entryType: entry.entryType,
    notes: entry.notes,
    travelFromAddress: entry.travelFromAddress,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    deletedAt: toIsoString(entry.deletedAt)
  };
}

function toOnTheWayResponse(notification: OnTheWayNotification | null) {
  if (!notification) {
    return null;
  }

  return {
    id: notification.id,
    companyId: notification.companyId,
    jobId: notification.jobId,
    technicianId: notification.technicianId,
    customerId: notification.customerId,
    sentAt: toIsoString(notification.sentAt),
    channel: notification.channel,
    message: notification.message,
    estimatedArrivalMinutes: notification.estimatedArrivalMinutes,
    technicianLat: notification.technicianLat,
    technicianLng: notification.technicianLng,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
    deletedAt: toIsoString(notification.deletedAt)
  };
}

function toReviewRequestResponse(reviewRequest: ReviewRequest) {
  return {
    id: reviewRequest.id,
    companyId: reviewRequest.companyId,
    jobId: reviewRequest.jobId,
    customerId: reviewRequest.customerId,
    technicianId: reviewRequest.technicianId,
    referenceId: reviewRequest.referenceId,
    status: reviewRequest.status,
    channel: reviewRequest.channel,
    reviewUrl: reviewRequest.reviewUrl,
    sentAt: toIsoString(reviewRequest.sentAt),
    clickedAt: toIsoString(reviewRequest.clickedAt),
    completedAt: toIsoString(reviewRequest.completedAt),
    rating: reviewRequest.rating,
    reviewText: reviewRequest.reviewText,
    createdAt: reviewRequest.createdAt.toISOString(),
    updatedAt: reviewRequest.updatedAt.toISOString(),
    deletedAt: toIsoString(reviewRequest.deletedAt)
  };
}

export async function startTimeEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  let entry: TimeEntry;
  try {
    entry = await startTimeEntry(request.company.id, request.user.id, params.id, request.body as StartTimeEntryInput);
  } catch (error) {
    if (error instanceof TimesheetConflictError) {
      return reply.code(409).send({ error: "CONFLICT", reason: error.reason, message: error.message, current: error.current, requestId: request.id });
    }
    throw error;
  }

  return reply.status(201).send({
    timeEntry: toTimeEntryResponse(entry)
  });
}

export async function stopTimeEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const entry = await stopTimeEntry(request.company.id, request.user.id, params.id, request.body as StopTimeEntryInput);

  return reply.send({
    timeEntry: toTimeEntryResponse(entry)
  });
}

export async function listJobTimeEntriesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const entries = await listJobTimeEntries(request.company.id, params.id);

  return reply.send({
    timeEntries: entries.map((entry) => toTimeEntryResponse(entry))
  });
}

export async function sendOnTheWayHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const body = request.body as OnTheWayBody;
  const notification = await sendOnTheWayNotification(
    request.company.id,
    request.user.id,
    params.id,
    {
      ...(body.technicianId !== undefined ? { technicianId: body.technicianId } : {}),
      ...(body.estimatedArrivalMinutes !== undefined
        ? { estimatedArrivalMinutes: body.estimatedArrivalMinutes }
        : {}),
      ...(body.message !== undefined ? { message: body.message } : {}),
      ...(body.technicianLat !== undefined ? { technicianLat: body.technicianLat } : {}),
      ...(body.technicianLng !== undefined ? { technicianLng: body.technicianLng } : {})
    }
  );

  return reply.status(201).send({
    notification: toOnTheWayResponse(notification)
  });
}

export async function getOnTheWayStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const notification = await getOnTheWayStatus(request.company.id, params.id);

  return reply.send({
    notification: toOnTheWayResponse(notification)
  });
}

export async function createReviewRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const reviewRequest = await createReviewRequest(
    request.company.id,
    request.user.id,
    params.id,
    request.body as CreateReviewRequestInput
  );

  return reply.status(201).send({
    reviewRequest: toReviewRequestResponse(reviewRequest)
  });
}
