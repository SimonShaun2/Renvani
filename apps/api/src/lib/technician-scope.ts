import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import { and, eq, isNull } from "drizzle-orm";

import { db, invoices, jobs, technicians } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { requireRole } from "./authorize.js";

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

const jobIdParam = (request: FastifyRequest): string => (request.params as { id: string }).id;

/**
 * Route preHandler: technicians may only touch jobs assigned to them (`:id` param).
 * Mutations -> 403 on mismatch; reads -> 404 so other techs' jobs are not revealed.
 */
export function technicianOwnJob(onUnassigned: "forbidden" | "not_found"): preHandlerHookHandler {
  return async (request) => assertTechnicianAssignedToJob(request, jobIdParam(request), { onUnassigned });
}

/** Route preHandler for actions technicians never perform (assign, schedule, reassign). */
export const denyTechnician: preHandlerHookHandler = requireRole(["owner", "admin", "dispatcher", "office"]);

/**
 * Route preHandler for invoice-scoped reads (`:id` = invoice id): technicians see the invoice's data
 * only when its job is assigned to them; anything else is 404 (same as GET /jobs/:id).
 */
export const technicianOwnInvoiceJob: preHandlerHookHandler = async (request) => {
  if (!isTechnicianCaller(request)) {
    return;
  }
  const [invoice] = await db
    .select({ companyId: invoices.companyId, jobId: invoices.jobId })
    .from(invoices)
    .where(and(eq(invoices.companyId, request.company.id), eq(invoices.id, jobIdParam(request))))
    .limit(1);
  if (!invoice || invoice.companyId !== request.company.id || !invoice.jobId) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }
  await assertTechnicianAssignedToJob(request, invoice.jobId, { onUnassigned: "not_found" }).catch(() => {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  });
};
