import type { FastifyReply, FastifyRequest } from "fastify";

import type { JobSourceReportingQuery } from "@fsm/types";

import { getDirectDemandSummary, getJobSourceReportingSummary } from "../../services/job-source-reporting.service.js";

export async function getJobSourceReportingHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const query = request.query as JobSourceReportingQuery;
  const summary = await getJobSourceReportingSummary(
    request.company.id,
    request.company.timezone,
    query
  );

  return reply.send(summary);
}

export async function getDirectDemandHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const query = request.query as Pick<JobSourceReportingQuery, "startDate" | "endDate">;
  const summary = await getDirectDemandSummary(request.company.id, request.company.timezone, query);

  return reply.send(summary);
}
