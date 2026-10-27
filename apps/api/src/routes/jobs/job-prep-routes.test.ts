import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handlerNames = vi.hoisted(() => [
  "addJobProductHandler", "addNoteHandler", "addPhotoHandler", "assignTechnicianHandler",
  "approveUpsellHandler", "completeJobHandler", "completeTaskHandler", "createTaskHandler",
  "createJobHandler", "deleteTaskHandler", "getJobHandler", "getJobPreparationStatusHandler",
  "getJobServiceBriefHandler", "listJobProductsHandler", "getJobTimelineHandler", "getNotesHandler",
  "getPhotosHandler", "listTasksHandler", "removeJobProductHandler", "reorderTasksHandler",
  "listJobsHandler", "scheduleJobHandler", "transitionStatusHandler", "updateJobProductHandler",
  "updateTaskHandler", "updateJobHandler"
]);

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

vi.mock("./handlers.js", () => {
  const out: Record<string, unknown> = {};
  for (const name of handlerNames) out[name] = async () => ({});
  out.getJobServiceBriefHandler = async (_req: unknown, reply: { send: (b: unknown) => unknown }) =>
    reply.send({
      brief: {
        contractVersion: "1.0.0",
        jobId,
        companyId,
        resourceVersion: "v1",
        sections: [{ id: "s1", title: "T", body: "B", sourceKind: "staff_entered", internalNote: "x" }],
        checklistSummary: { total: 1, requiredPending: 0, debug: true },
        approvedById: "should-not-leak"
      },
      extra: "should-not-leak"
    });
  out.getJobPreparationStatusHandler = async (_req: unknown, reply: { send: (b: unknown) => unknown }) =>
    reply.send({ preparation: { readyForField: true, blockers: [], jobRow: { secret: 1 } } });
  return out;
});

import jobRoutes from "./index.js";

let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  app = Fastify();
  app.decorate("authenticate", async (request: { headers: Record<string, string>; user?: unknown; company?: unknown }) => {
    request.user = { id: "u1", role: request.headers["x-role"] };
    request.company = { id: companyId };
  });
  await app.register(jobRoutes, { prefix: "/jobs" });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe("FS-25 job prep GET routes", () => {
  it.each(["owner", "admin", "dispatcher", "office", "technician"])("allows %s", async (role) => {
    const res = await app.inject({ method: "GET", url: `/jobs/${jobId}/preparation-status`, headers: { "x-role": role } });
    expect(res.statusCode).toBe(200);
  });

  it.each(["service-brief", "preparation-status"])("rejects users without a staff role on %s", async (path) => {
    const res = await app.inject({ method: "GET", url: `/jobs/${jobId}/${path}`, headers: { "x-role": "customer" } });
    expect(res.statusCode).not.toBe(200);
  });

  it("service-brief response schema strips unknown properties", async () => {
    const res = await app.inject({ method: "GET", url: `/jobs/${jobId}/service-brief`, headers: { "x-role": "technician" } });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      brief: {
        contractVersion: "1.0.0",
        jobId,
        companyId,
        resourceVersion: "v1",
        sections: [{ id: "s1", title: "T", body: "B", sourceKind: "staff_entered" }],
        checklistSummary: { total: 1, requiredPending: 0 }
      }
    });
  });

  it("preparation-status response schema strips unknown properties", async () => {
    const res = await app.inject({ method: "GET", url: `/jobs/${jobId}/preparation-status`, headers: { "x-role": "office" } });
    expect(res.json()).toEqual({ preparation: { readyForField: true, blockers: [] } });
  });
});
