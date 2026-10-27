import type { FastifyReply, FastifyRequest } from "fastify";

import type { UpdateTimeEntryInput } from "@fsm/types";

import { updateTimeEntry } from "../../services/time-tracking.service.js";
import { TimesheetConflictError } from "../../services/timesheets.service.js";
import type { TimeEntryIdParams } from "./schemas.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toTimeEntryResponse(entry: Awaited<ReturnType<typeof updateTimeEntry>>) {
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

export async function updateTimeEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TimeEntryIdParams;
  let entry: Awaited<ReturnType<typeof updateTimeEntry>>;
  try {
    entry = await updateTimeEntry(
      request.company.id,
      request.user.id,
      params.entryId,
      request.body as UpdateTimeEntryInput
    );
  } catch (error) {
    if (error instanceof TimesheetConflictError) {
      return reply.code(409).send({ error: "CONFLICT", message: error.message, requestId: request.id });
    }
    throw error;
  }

  return reply.send({
    timeEntry: toTimeEntryResponse(entry)
  });
}
