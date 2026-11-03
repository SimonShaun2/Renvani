import type { FastifyReply, FastifyRequest } from "fastify";

import type { PublicBookingManageHoldInput, PublicBookingManageRescheduleInput } from "@fsm/types";

import {
  cancelBookingSelfService,
  getBookingSelfServiceAvailability,
  getBookingSelfServiceView,
  holdBookingSelfServiceSlot,
  rescheduleBookingSelfService
} from "../../../services/booking-self-service.service.js";
import type { BookingManageTokenParams, BookingManageAvailabilityQuery } from "./manage-schemas.js";

export async function getBookingSelfServiceHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingManageTokenParams;
  const view = await getBookingSelfServiceView(params.token);

  return reply.send({ selfService: view });
}

export async function getBookingSelfServiceAvailabilityHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingManageTokenParams;
  const query = request.query as BookingManageAvailabilityQuery;
  const availability = await getBookingSelfServiceAvailability(params.token, query.date);

  return reply.send({ availability });
}

export async function holdBookingSelfServiceSlotHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingManageTokenParams;
  const result = await holdBookingSelfServiceSlot(params.token, request.body as PublicBookingManageHoldInput);

  return reply.send(result);
}

export async function rescheduleBookingSelfServiceHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingManageTokenParams;
  const result = await rescheduleBookingSelfService(
    params.token,
    request.body as PublicBookingManageRescheduleInput
  );

  return reply.send({ result });
}

export async function cancelBookingSelfServiceHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as BookingManageTokenParams;
  const result = await cancelBookingSelfService(params.token);

  return reply.send({ result });
}
