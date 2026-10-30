import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCrews: vi.fn(),
  createCrew: vi.fn(),
  updateCrew: vi.fn(),
  replaceCrewMembers: vi.fn(),
  deleteCrew: vi.fn(),
  assignJobCrew: vi.fn(),
  getTechnicianDriveTime: vi.fn()
}));
vi.mock("../../services/crews/crews.service.js", () => mocks);

import routes from "./index.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const crewId = "11111111-1111-4111-8111-111111111111";
const techId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const crew = { id: crewId, name: "A Team", color: "#112233", isActive: true, version: 2, members: [{ technicianId: techId, role: "lead", secret: 1 }], companyId };
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify();
  app.decorate("authenticate", async (request: { headers: Record<string, string>; user?: unknown; company?: unknown }) => {
    request.user = { id: "u1", role: request.headers["x-role"] };
    request.company = { id: companyId };
  });
  app.setErrorHandler((error: Error & { code?: string; statusCode?: number }, _req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    const status = error.code === "FORBIDDEN" ? 403
      : error.code === "VALIDATION_ERROR" || error.name === "ZodError" ? 400
      : error.code === "CONFLICT" ? 409
      : error.statusCode ?? 500;
    reply.code(status).send({ error: error.code ?? "ERR" });
  });
  await app.register(routes, { prefix: "/api/v1" });
  await app.ready();
  mocks.listCrews.mockResolvedValue([crew]);
  mocks.createCrew.mockResolvedValue(crew);
  mocks.updateCrew.mockResolvedValue(crew);
  mocks.replaceCrewMembers.mockResolvedValue(crew);
  mocks.deleteCrew.mockResolvedValue(undefined);
  mocks.assignJobCrew.mockResolvedValue({ jobId, crewId });
  mocks.getTechnicianDriveTime.mockResolvedValue({
    technicianId: techId, date: "2026-10-28", estimator: "straight_line", method: "straight_line_estimate", confidence: "low",
    totalMinutes: 12, legs: [{ fromJobId: jobId, toJobId: crewId, status: "estimated", minutes: 12, distanceMiles: 4.5, unavailableReason: null }]
  });
});
afterEach(async () => {
  await app.close();
});

const writeCalls = [
  { method: "POST" as const, url: "/api/v1/crews", payload: { name: "A Team" } },
  { method: "PATCH" as const, url: `/api/v1/crews/${crewId}`, payload: { expectedVersion: 1, name: "B" } },
  { method: "PUT" as const, url: `/api/v1/crews/${crewId}/members`, payload: { expectedVersion: 1, members: [] } },
  { method: "DELETE" as const, url: `/api/v1/crews/${crewId}?expectedVersion=1` }
];
const readCalls = [
  { method: "GET" as const, url: "/api/v1/crews" },
  { method: "PUT" as const, url: `/api/v1/jobs/${jobId}/crew`, payload: { crewId } },
  { method: "GET" as const, url: `/api/v1/dispatch/technicians/${techId}/drive-time?date=2026-10-28` }
];

describe("FS-195 crew routes — auth", () => {
  it.each(writeCalls.flatMap((c) => ["dispatcher", "office", "technician"].map((role) => ({ ...c, role }))))("$method $url rejects $role", async ({ role, ...call }) => {
    const res = await app.inject({ ...call, headers: { "x-role": role } });
    expect(res.statusCode).toBe(403);
  });
  it.each(readCalls.flatMap((c) => ["office", "technician"].map((role) => ({ ...c, role }))))("$method $url rejects $role", async ({ role, ...call }) => {
    const res = await app.inject({ ...call, headers: { "x-role": role } });
    expect(res.statusCode).toBe(403);
  });
  it.each(readCalls)("dispatcher can $method $url", async (call) => {
    const res = await app.inject({ ...call, headers: { "x-role": "dispatcher" } });
    expect(res.statusCode).toBe(200);
  });
});

describe("FS-195 crew routes — behaviour", () => {
  it("lists crews tenant-scoped and strips unknown fields", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/crews", headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(200);
    expect(mocks.listCrews).toHaveBeenCalledWith(companyId);
    expect(res.json().crews[0]).not.toHaveProperty("companyId");
    expect(res.json().crews[0].members[0]).toEqual({ technicianId: techId, role: "lead" });
  });

  it("creates a crew with default member role", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/crews", headers: { "x-role": "admin" }, payload: { name: " A Team ", members: [{ technicianId: techId }] } });
    expect(res.statusCode).toBe(201);
    expect(mocks.createCrew).toHaveBeenCalledWith(companyId, { name: "A Team", members: [{ technicianId: techId, role: "member" }] });
  });

  it.each([
    { name: "" },
    { name: "x".repeat(101) },
    { name: "ok", extra: 1 },
    { name: "ok", color: "red" },
    { name: "ok", members: Array.from({ length: 51 }, () => ({ technicianId: techId })) },
    { name: "ok", members: [{ technicianId: "nope" }] }
  ])("rejects invalid create body %#", async (payload) => {
    const res = await app.inject({ method: "POST", url: "/api/v1/crews", headers: { "x-role": "owner" }, payload });
    expect(res.statusCode).toBe(400);
    expect(mocks.createCrew).not.toHaveBeenCalled();
  });

  it("requires expectedVersion on updates/deletes", async () => {
    for (const call of [
      { method: "PATCH" as const, url: `/api/v1/crews/${crewId}`, payload: { name: "B" } },
      { method: "PUT" as const, url: `/api/v1/crews/${crewId}/members`, payload: { members: [] } },
      { method: "DELETE" as const, url: `/api/v1/crews/${crewId}` }
    ]) {
      const res = await app.inject({ ...call, headers: { "x-role": "owner" } });
      expect(res.statusCode).toBe(400);
    }
  });

  it("surfaces version conflicts as 409", async () => {
    mocks.updateCrew.mockRejectedValueOnce(Object.assign(new Error("stale"), { code: "CONFLICT" }));
    const res = await app.inject({ method: "PATCH", url: `/api/v1/crews/${crewId}`, headers: { "x-role": "owner" }, payload: { expectedVersion: 1, name: "B" } });
    expect(res.statusCode).toBe(409);
  });

  it("deletes with expectedVersion → 204", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/crews/${crewId}?expectedVersion=3`, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(204);
    expect(mocks.deleteCrew).toHaveBeenCalledWith(companyId, crewId, 3);
  });

  it("assigns or clears a job crew", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/jobs/${jobId}/crew`, headers: { "x-role": "owner" }, payload: { crewId: null } });
    expect(res.statusCode).toBe(200);
    expect(mocks.assignJobCrew).toHaveBeenCalledWith(companyId, jobId, null);
    const bad = await app.inject({ method: "PUT", url: `/api/v1/jobs/${jobId}/crew`, headers: { "x-role": "owner" }, payload: {} });
    expect(bad.statusCode).toBe(400);
  });

  it("returns drive-time legs and validates date", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/dispatch/technicians/${techId}/drive-time?date=2026-10-28`, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ estimator: "straight_line", method: "straight_line_estimate", totalMinutes: 12 });
    expect(mocks.getTechnicianDriveTime).toHaveBeenCalledWith(companyId, techId, "2026-10-28");
    const bad = await app.inject({ method: "GET", url: `/api/v1/dispatch/technicians/${techId}/drive-time?date=10/28/2026`, headers: { "x-role": "owner" } });
    expect(bad.statusCode).toBe(400);
  });
});
