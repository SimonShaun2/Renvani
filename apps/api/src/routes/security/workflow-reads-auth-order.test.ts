import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const services = vi.hoisted(() => ({
  listEstimateGroups: vi.fn(async () => ({ data: [] })),
  getDispatchWeek: vi.fn(async () => ({ data: [] }))
}));

vi.mock("../../services/estimate-groups.service.js", () => ({ listEstimateGroups: services.listEstimateGroups }));
vi.mock("../../services/dispatch-week.service.js", () => ({ getDispatchWeek: services.getDispatchWeek }));

/** PR #445 review: auth -> role -> query validation, so malformed queries never leak a 400 before 401/403. */
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const role = request.headers["x-fixture-role"];
    if (typeof role !== "string") {
      await reply.code(401).send({ error: "UNAUTHORIZED" });
      return;
    }
    request.user = { id: "00000000-0000-4000-8000-000000000001", role } as typeof request.user;
    request.company = { id: "00000000-0000-4000-8000-000000000002" } as typeof request.company;
  });
  app.setErrorHandler((error, _request, reply) => {
    const e = error as Error & { code?: string };
    const status = e.code === "FORBIDDEN" ? 403 : e.name === "ZodError" || e.code === "VALIDATION_ERROR" ? 400 : 500;
    void reply.code(status).send({ error: e.code ?? e.name });
  });
  const { estimateGroupRoutes } = await import("../estimates/groups.js");
  const { dispatchWeekRoutes } = await import("../dispatch/week.js");
  await app.register(estimateGroupRoutes, { prefix: "/api/v1/estimates" });
  await app.register(dispatchWeekRoutes, { prefix: "/api/v1" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const cases = [
  { name: "estimate groups", url: "/api/v1/estimates/groups?limit=abc&bogus=1", allowed: "dispatcher", denied: "office" },
  { name: "dispatch week", url: "/api/v1/dispatch/week?date=not-a-date&technician=nope", allowed: "office", denied: "technician" }
] as const;

describe.each(cases)("$name malformed query ordering", ({ url, allowed, denied }) => {
  it("signed-out + malformed query -> 401, not 400", async () => {
    expect((await app.inject({ url })).statusCode).toBe(401);
  });

  it("disallowed role + malformed query -> 403, not 400", async () => {
    expect((await app.inject({ url, headers: { "x-fixture-role": denied } })).statusCode).toBe(403);
  });

  it("allowed role + malformed query -> 400", async () => {
    expect((await app.inject({ url, headers: { "x-fixture-role": allowed } })).statusCode).toBe(400);
  });

  it("never calls the service for a malformed query", () => {
    expect(services.listEstimateGroups).not.toHaveBeenCalled();
    expect(services.getDispatchWeek).not.toHaveBeenCalled();
  });
});
