import type { FastifyReply, FastifyRequest } from "fastify";

import type { ConfirmBookingRequestInput, PublicHoldBookingSlotInput, SubmitBookingRequestInput } from "@fsm/types";

import {
  captureBookingInterest,
  checkZipCoverage,
  confirmPublicBookingSlot,
  getBookingAvailability,
  getBookingConfirmation,
  getPublicBookingSettingsBySlug,
  holdPublicBookingSlot,
  inspectPublicBookingHoldToken
} from "../../../services/booking.service.js";
import { submitPublicInquiryIntake } from "../../../services/revenue-inquiry-intake.service.js";
import type {
  BookingConfirmationParams,
  BookingSlugParams,
  BookingSubmitQuery,
  PublicAvailabilityQuery,
  ZipCheckBody
} from "./schemas.js";

export async function getPublicBookingSettingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingSlugParams;
  const settings = await getPublicBookingSettingsBySlug(params.slug);

  return reply.send({
    booking: settings
  });
}

export async function checkZipCoverageHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingSlugParams;
  const body = request.body as ZipCheckBody;
  const coverage = await checkZipCoverage(params.slug, body.zip);

  return reply.send(coverage);
}

export async function getPublicAvailabilityHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingSlugParams;
  const query = request.query as PublicAvailabilityQuery;
  const availability = await getBookingAvailability(params.slug, query.zip, query.date);

  return reply.send({
    availability
  });
}

export async function submitBookingRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingSlugParams;
  const query = request.query as BookingSubmitQuery;
  const idempotencyKey = typeof request.headers["idempotency-key"] === "string"
    ? request.headers["idempotency-key"]
    : undefined;
  const { created, result } = await submitPublicInquiryIntake(
    params.slug,
    request.body as SubmitBookingRequestInput,
    query.src,
    idempotencyKey
  );

  return reply.status(created ? 201 : 200).send(result);
}

export async function captureBookingInterestHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingSlugParams;
  const body = request.body as { zip: string; email: string };
  const result = await captureBookingInterest(params.slug, body.zip, body.email);

  return reply.send(result);
}

export async function getBookingConfirmationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingConfirmationParams;
  const confirmation = await getBookingConfirmation(params.slug, params.ref);

  return reply.send({
    confirmation
  });
}

export async function inspectPublicBookingHoldTokenHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingSlugParams;
  const body = request.body as { holdToken: string };
  const inspection = await inspectPublicBookingHoldToken(params.slug, body.holdToken);

  return reply.send({
    inspection
  });
}

export async function holdPublicBookingSlotHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingConfirmationParams;
  const result = await holdPublicBookingSlot(
    params.slug,
    params.ref,
    request.body as PublicHoldBookingSlotInput
  );

  return reply.send({
    bookingRequest: {
      id: result.bookingRequest.id,
      referenceNumber: result.bookingRequest.referenceNumber,
      status: result.bookingRequest.status,
      assignedTechnicianId: result.bookingRequest.assignedTechnicianId
    },
    hold: result.hold
  });
}

export async function confirmPublicBookingSlotHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingConfirmationParams;
  const result = await confirmPublicBookingSlot(params.slug, params.ref, request.body as ConfirmBookingRequestInput);

  return reply.send({
    bookingRequest: {
      id: result.bookingRequest.id,
      referenceNumber: result.bookingRequest.referenceNumber,
      status: result.bookingRequest.status,
      jobId: result.jobId
    },
    jobId: result.jobId,
    recurringSchedule: result.recurringSchedule,
    manageToken: result.manageToken
  });
}
