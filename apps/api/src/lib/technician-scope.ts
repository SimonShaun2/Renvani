import type { FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";

import { db, jobs, technicians } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

/**
 * Technician-role data scoping. Only the "technician" role is narrowed; every other role keeps
 * its existing company-wide access. A technician is scoped to jobs assigned to the technician
 * record linked to their login (same company).
 */
export const isTechnicianCaller = (request: FastifyRequest): boolean => request.user?.role === "technician";

/** Caller's own technician id (null when the login has no linked technician record). */
export async function resolveCallerTechnicianId(request: FastifyRequest): Promise<string | null> {
  const [row] = await db
    .select({ id: technicians.id, companyId: technicians.companyId })
    .from(technicians)
    .where(
      and(
        eq(technicians.companyId, request.company.id),
        eq(technicians.userId, request.user.id),
        isNull(technicians.deletedAt)
      )
    )
    .limit(1);
  return row && row.companyId === request.company.id ? row.id : null;
}

/**
 * Technicians may act on / read a job only when it is assigned to them.
 * No-op for non-technician roles. Unknown or other-tenant jobs are left to the service (404).
 */
export async function assertTechnicianAssignedToJob(
  request: FastifyRequest,
  jobId: string,
  options: { onUnassigned: "forbidden" | "not_found" } = { onUnassigned: "forbidden" }
): Promise<void> {
  if (!isTechnicianCaller(request)) {
    return;
  }
  const [job] = await db
    .select({ id: jobs.id, companyId: jobs.companyId, technicianId: jobs.technicianId })
    .from(jobs)
    .where(and(eq(jobs.companyId, request.company.id), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);
  if (!job || job.companyId !== request.company.id) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }
  const ownTechnicianId = await resolveCallerTechnicianId(request);
  if (!ownTechnicianId || job.technicianId !== ownTechnicianId) {
    throw options.onUnassigned === "not_found"
      ? new AppError(ErrorCode.NOT_FOUND, "Job not found")
      : new AppError(ErrorCode.FORBIDDEN, "Only the assigned technician can do this");
  }
}
