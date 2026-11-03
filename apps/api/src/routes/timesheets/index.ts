/**
 * FS-171 — timesheets & payroll routes (prefix /api/v1). Contract: packages/types timesheets/v1.
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  ClockInBodySchema,
  ClockOutBodySchema,
  CreatePayRateBodySchema,
  CreateTimeEntryBodySchema,
  CreateTimesheetBodySchema,
  DeleteTimeEntryBodySchema,
  ListPayRatesQuerySchema,
  ListTimeEntriesQuerySchema,
  ListTimesheetsQuerySchema,
  PayrollQuerySchema,
  TimesheetIdParamsSchema,
  TimesheetReasonBodySchema,
  TimesheetTransitionBodySchema,
  UpdateTimeEntryBodySchema,
  type ClockInBody,
  type ClockOutBody,
  type CreatePayRateBody,
  type CreateTimeEntryBody,
  type CreateTimesheetBody,
  type DeleteTimeEntryBody,
  type ListPayRatesQuery,
  type ListTimeEntriesQuery,
  type ListTimesheetsQuery,
  type PayrollQuery,
  type TimesheetReasonBody,
  type TimesheetTransitionBody,
  type UpdateTimeEntryBody
} from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import {
  TimesheetConflictError,
  buildPayrollSummary,
  clockIn,
  clockOut,
  createPayRate,
  createTimeEntry,
  createTimesheet,
  deleteTimeEntryV1,
  getTimesheet,
  listPayRates,
  listTimeEntries,
  listTimesheetAudit,
  listTimesheets,
  payrollToCsv,
  transitionTimesheet,
  updateTimeEntryV1,
  type TimesheetActor
} from "../../services/timesheets.service.js";
import { withZodValidation } from "../shared/validation.js";

const anyStaff = requireRole(["owner", "admin", "dispatcher", "office", "technician"]);
const managers = requireRole(["owner", "admin", "dispatcher", "office"]);
const payrollAdmins = requireRole(["owner", "admin"]);

function actorOf(request: FastifyRequest): TimesheetActor {
  return { companyId: request.company.id, userId: request.user.id, role: request.user.role };
}

async function withConflict<T>(reply: FastifyReply, work: () => Promise<T>, code = 200) {
  try {
    const result = await work();
    return code === 204 ? reply.code(204).send() : reply.code(code).send(result);
  } catch (error) {
    if (error instanceof TimesheetConflictError) {
      return reply.code(409).send({ error: "CONFLICT", reason: error.reason, message: error.message, current: error.current });
    }
    throw error;
  }
}

const idOf = (request: FastifyRequest) => (request.params as { id: string }).id;
const idParams = withZodValidation({ params: TimesheetIdParamsSchema });

const timesheetRoutes: FastifyPluginAsync = async (fastify) => {
  const staff = [fastify.authenticate, anyStaff];
  const manage = [fastify.authenticate, managers];
  const payroll = [fastify.authenticate, payrollAdmins];

  // Time entries
  fastify.get("/time/entries", { onRequest: staff, preValidation: [withZodValidation({ query: ListTimeEntriesQuerySchema })] },
    async (request, reply) => reply.send(await listTimeEntries(actorOf(request), request.query as ListTimeEntriesQuery)));

  fastify.post("/time/clock-in", { onRequest: staff, preValidation: [withZodValidation({ body: ClockInBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ entry: await clockIn(actorOf(request), request.body as ClockInBody) }), 201));

  fastify.post("/time/clock-out", { onRequest: staff, preValidation: [withZodValidation({ body: ClockOutBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ entry: await clockOut(actorOf(request), (request.body ?? {}) as ClockOutBody) })));

  fastify.post("/time/entries", { onRequest: staff, preValidation: [withZodValidation({ body: CreateTimeEntryBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ entry: await createTimeEntry(actorOf(request), request.body as CreateTimeEntryBody) }), 201));

  fastify.patch("/time/entries/:id", { onRequest: staff, preValidation: [withZodValidation({ params: TimesheetIdParamsSchema, body: UpdateTimeEntryBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ entry: await updateTimeEntryV1(actorOf(request), idOf(request), request.body as UpdateTimeEntryBody) })));

  fastify.delete("/time/entries/:id", { onRequest: staff, preValidation: [withZodValidation({ params: TimesheetIdParamsSchema, body: DeleteTimeEntryBodySchema })] },
    async (request, reply) => withConflict(reply, () => deleteTimeEntryV1(actorOf(request), idOf(request), (request.body as DeleteTimeEntryBody | undefined)?.recordVersion), 204));

  // Timesheets
  fastify.get("/timesheets", { onRequest: staff, preValidation: [withZodValidation({ query: ListTimesheetsQuerySchema })] },
    async (request, reply) => reply.send(await listTimesheets(actorOf(request), request.query as ListTimesheetsQuery)));

  fastify.post("/timesheets", { onRequest: staff, preValidation: [withZodValidation({ body: CreateTimesheetBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ timesheet: await createTimesheet(actorOf(request), request.body as CreateTimesheetBody) }), 201));

  fastify.get("/timesheets/:id", { onRequest: staff, preValidation: [idParams] },
    async (request, reply) => reply.send(await getTimesheet(actorOf(request), idOf(request))));

  fastify.get("/timesheets/:id/audit", { onRequest: manage, preValidation: [idParams] },
    async (request, reply) => reply.send({ events: await listTimesheetAudit(actorOf(request), idOf(request)) }));

  fastify.post("/timesheets/:id/submit", { onRequest: staff, preValidation: [withZodValidation({ params: TimesheetIdParamsSchema, body: TimesheetTransitionBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ timesheet: await transitionTimesheet(actorOf(request), idOf(request), "submit", (request.body ?? {}) as TimesheetTransitionBody) })));

  fastify.post("/timesheets/:id/approve", { onRequest: manage, preValidation: [withZodValidation({ params: TimesheetIdParamsSchema, body: TimesheetTransitionBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ timesheet: await transitionTimesheet(actorOf(request), idOf(request), "approve", (request.body ?? {}) as TimesheetTransitionBody) })));

  fastify.post("/timesheets/:id/reject", { onRequest: manage, preValidation: [withZodValidation({ params: TimesheetIdParamsSchema, body: TimesheetReasonBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ timesheet: await transitionTimesheet(actorOf(request), idOf(request), "reject", request.body as TimesheetReasonBody) })));

  fastify.post("/timesheets/:id/reopen", { onRequest: payroll, preValidation: [withZodValidation({ params: TimesheetIdParamsSchema, body: TimesheetReasonBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ timesheet: await transitionTimesheet(actorOf(request), idOf(request), "reopen", request.body as TimesheetReasonBody) })));

  // Pay rates & payroll (owner/admin)
  fastify.get("/payroll/pay-rates", { onRequest: payroll, preValidation: [withZodValidation({ query: ListPayRatesQuerySchema })] },
    async (request, reply) => reply.send({ payRates: await listPayRates(actorOf(request), request.query as ListPayRatesQuery) }));

  fastify.post("/payroll/pay-rates", { onRequest: payroll, preValidation: [withZodValidation({ body: CreatePayRateBodySchema })] },
    async (request, reply) => withConflict(reply, async () => ({ payRate: await createPayRate(actorOf(request), request.body as CreatePayRateBody) }), 201));

  fastify.get("/payroll/summary", { onRequest: payroll, preValidation: [withZodValidation({ query: PayrollQuerySchema })] },
    async (request, reply) => reply.send({ summary: await buildPayrollSummary(actorOf(request), request.query as PayrollQuery) }));

  fastify.get("/payroll/export", { onRequest: payroll, preValidation: [withZodValidation({ query: PayrollQuerySchema })] },
    async (request, reply) => {
      const query = request.query as PayrollQuery;
      const summary = await buildPayrollSummary(actorOf(request), query);
      if (query.format === "json") return reply.send({ summary });
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="payroll-${query.periodStart}-to-${query.periodEnd}.csv"`)
        .send(payrollToCsv(summary));
    });
};

export default timesheetRoutes;
