import type { FastifyReply, FastifyRequest } from "fastify";

import {
  cancelJob,
  getJobSchedule,
  recordScheduleException,
  rescheduleJob,
  type CancelBody,
  type ExceptionBody,
  type RescheduleBody,
  type SchedulingActor
} from "../../services/scheduling-changes.service.js";
import type { JobScheduleParams } from "./changes-schemas.js";

const actorOf = (request: FastifyRequest): SchedulingActor => ({
  companyId: request.company.id,
  userId: request.user.id,
  role: request.user.role
});

export async function getJobScheduleHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as JobScheduleParams;
  return reply.send(await getJobSchedule(request.company.id, jobId));
}

export async function rescheduleJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as JobScheduleParams;
  return reply.send(await rescheduleJob(actorOf(request), jobId, request.body as RescheduleBody));
}

export async function cancelJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as JobScheduleParams;
  return reply.send(await cancelJob(actorOf(request), jobId, request.body as CancelBody));
}

export async function scheduleExceptionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = request.params as JobScheduleParams;
  return reply.send(await recordScheduleException(actorOf(request), jobId, request.body as ExceptionBody));
}
