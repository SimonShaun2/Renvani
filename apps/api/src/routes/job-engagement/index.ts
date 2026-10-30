import type { FastifyPluginAsync } from "fastify";

import { technicianOwnJob } from "../../lib/technician-scope.js";

import {
  createReviewRequestHandler,
  getOnTheWayStatusHandler,
  listJobTimeEntriesHandler,
  sendOnTheWayHandler,
  startTimeEntryHandler,
  stopTimeEntryHandler
} from "./handlers.js";
import {
  createReviewRequestRouteSchema,
  createReviewRequestValidation,
  createTimeEntryRouteSchema,
  getOnTheWayRouteSchema,
  jobIdValidation,
  listTimeEntriesRouteSchema,
  onTheWayRouteSchema,
  onTheWayValidation,
  startTimeEntryValidation,
  stopTimeEntryValidation,
  updateTimeEntryRouteSchema
} from "./schemas.js";

const jobEngagementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/:id/time/start", {
    preHandler: [fastify.authenticate, technicianOwnJob("forbidden")],
    preValidation: [startTimeEntryValidation],
    schema: createTimeEntryRouteSchema
  }, startTimeEntryHandler);

  fastify.post("/:id/time/stop", {
    preHandler: [fastify.authenticate, technicianOwnJob("forbidden")],
    preValidation: [stopTimeEntryValidation],
    schema: updateTimeEntryRouteSchema
  }, stopTimeEntryHandler);

  fastify.get("/:id/time", {
    preHandler: [fastify.authenticate, technicianOwnJob("not_found")],
    preValidation: [jobIdValidation],
    schema: listTimeEntriesRouteSchema
  }, listJobTimeEntriesHandler);

  fastify.post("/:id/on-the-way", {
    preHandler: [fastify.authenticate, technicianOwnJob("forbidden")],
    preValidation: [onTheWayValidation],
    schema: onTheWayRouteSchema
  }, sendOnTheWayHandler);

  fastify.get("/:id/on-the-way", {
    preHandler: [fastify.authenticate, technicianOwnJob("not_found")],
    preValidation: [jobIdValidation],
    schema: getOnTheWayRouteSchema
  }, getOnTheWayStatusHandler);

  fastify.post("/:id/review-request", {
    preHandler: [fastify.authenticate, technicianOwnJob("forbidden")],
    preValidation: [createReviewRequestValidation],
    schema: createReviewRequestRouteSchema
  }, createReviewRequestHandler);
};

export default jobEngagementRoutes;
