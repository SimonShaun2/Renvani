import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { cancelJobHandler, getJobScheduleHandler, rescheduleJobHandler, scheduleExceptionHandler } from "./changes-handlers.js";
import { cancelJobValidation, getJobScheduleValidation, rescheduleJobValidation, scheduleExceptionValidation } from "./changes-schemas.js";
import {
  confirmSchedulingOptionHandler,
  listSchedulingOptionsHandler,
  selectSchedulingOptionHandler
} from "./handlers.js";
import {
  confirmSchedulingOptionValidation,
  listSchedulingOptionsValidation,
  selectSchedulingOptionValidation
} from "./schemas.js";
import { executeSeriesChangeHandler, getSeriesHandler, previewSeriesChangeHandler } from "./series-handlers.js";
import { executeSeriesChangeValidation, getSeriesValidation, previewSeriesChangeValidation } from "./series-schemas.js";

const schedulingAgentRoles = requireRole(["owner", "admin", "dispatcher"]);

const schedulingAgentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/scheduling-agent/booking-requests/:bookingRequestId/options", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [listSchedulingOptionsValidation]
  }, listSchedulingOptionsHandler);

  fastify.post("/scheduling-agent/booking-requests/:bookingRequestId/select-option", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [selectSchedulingOptionValidation]
  }, selectSchedulingOptionHandler);

  fastify.post("/scheduling-agent/booking-requests/:bookingRequestId/confirm", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [confirmSchedulingOptionValidation]
  }, confirmSchedulingOptionHandler);

  // FS-60 recurring series controls: preview -> approve (previewHash) -> execute.
  fastify.get("/scheduling-agent/recurring-series/:seriesId", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [getSeriesValidation]
  }, getSeriesHandler);

  fastify.post("/scheduling-agent/recurring-series/:seriesId/changes/preview", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [previewSeriesChangeValidation]
  }, previewSeriesChangeHandler);

  fastify.post("/scheduling-agent/recurring-series/:seriesId/changes", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [executeSeriesChangeValidation]
  }, executeSeriesChangeHandler);

  // FS-24 changes and exceptions (same roles as the rest of the Scheduling Agent).
  fastify.get("/scheduling-agent/jobs/:jobId/schedule", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [getJobScheduleValidation]
  }, getJobScheduleHandler);

  fastify.post("/scheduling-agent/jobs/:jobId/reschedule", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [rescheduleJobValidation]
  }, rescheduleJobHandler);

  fastify.post("/scheduling-agent/jobs/:jobId/cancel", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [cancelJobValidation]
  }, cancelJobHandler);

  fastify.post("/scheduling-agent/jobs/:jobId/exceptions", {
    preHandler: [fastify.authenticate, schedulingAgentRoles],
    preValidation: [scheduleExceptionValidation]
  }, scheduleExceptionHandler);
};

export default schedulingAgentRoutes;
