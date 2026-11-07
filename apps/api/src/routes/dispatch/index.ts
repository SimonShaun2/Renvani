import type { FastifyPluginAsync } from "fastify";

import { dispatchWeekRoutes } from "./week.js";
import { promoteQueryAccessTokenToHeader } from "../../lib/promote-query-access-token.js";
import {
  autoFitHandler,
  dispatchStreamHandler,
  getDispatchViewHandler,
  getDispatchWorkloadHandler,
  listApprovedUnconvertedEstimatesHandler,
  listUnscheduledJobsHandler
} from "./handlers.js";
import {
  autoFitValidation,
  autoFitRouteSchema,
  dispatchDateValidation,
  dispatchStreamDateValidation,
  dispatchViewRouteSchema,
  dispatchWorkloadRouteSchema,
  listApprovedUnconvertedEstimatesRouteSchema,
  listUnscheduledJobsRouteSchema
} from "./schemas.js";

const dispatchRoutes: FastifyPluginAsync = async (fastify) => {
  await dispatchWeekRoutes(fastify, {});
  fastify.get("/dispatch", {
    preHandler: [fastify.authenticate],
    preValidation: [dispatchDateValidation],
    schema: dispatchViewRouteSchema
  }, getDispatchViewHandler);

  fastify.get("/dispatch/stream", {
    preValidation: [dispatchStreamDateValidation],
    preHandler: [promoteQueryAccessTokenToHeader, fastify.authenticate]
  }, dispatchStreamHandler);

  fastify.get("/dispatch/workload", {
    preHandler: [fastify.authenticate],
    preValidation: [dispatchDateValidation],
    schema: dispatchWorkloadRouteSchema
  }, getDispatchWorkloadHandler);

  fastify.post("/dispatch/auto-fit", {
    preHandler: [fastify.authenticate],
    preValidation: [autoFitValidation],
    schema: autoFitRouteSchema
  }, autoFitHandler);

  fastify.get("/jobs/unscheduled", {
    preHandler: [fastify.authenticate],
    schema: listUnscheduledJobsRouteSchema
  }, listUnscheduledJobsHandler);

  fastify.get("/estimates/approved-unconverted", {
    preHandler: [fastify.authenticate],
    schema: listApprovedUnconvertedEstimatesRouteSchema
  }, listApprovedUnconvertedEstimatesHandler);
};

export default dispatchRoutes;
