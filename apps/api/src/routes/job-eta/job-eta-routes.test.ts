import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getJobEta: vi.fn() }));
vi.mock("../../services/geo/job-eta.service.js", () => mocks);

import routes from "./index.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const url = `/api/v1/jobs/${jobId}/eta?originLat=41.88&originLng=-87.63`;
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify();
  app.decorate("authenticate", async (request: { headers: Record<string, string>; user?: unknown; company?: unknown }) => {
    request.user = { id: "u1", role: request.headers["x-role"] };
    request.company = { id: companyId };
  });
  app.setErrorHandler((error: Error & { code?: string }, _req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "VALIDATION_ERROR" || error.name === "ZodError" ? 400 : 500;
    reply.code(status).send({ error: error.code ?? "ERR" });
  });
  await app.register(routes, { prefix: "/api/v1/jobs" });
  await app.ready();
  mocks.getJobEta.mockResolvedValue({
    jobId, provider: "straight_line", status: "estimated", method: "straight_line_estimate", confidence: "low",
    minutes: 12, distanceMiles: 4.2, assumedSpeedMph: 30, unavailableReason: null, secret: "x"
  });
});
afterEach(async () => {
  await app.close();
});

describe("FS-198 GET /jobs/:id/eta", () => {
  it.each(["office", "technician", undefined])("rejects role %s", async (role) => {
    const res = await app.inject({ method: "GET", url, headers: role ? { "x-role": role } : {} });
    expect(res.statusCode).toBe(403);
    expect(mocks.getJobEta).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin", "dispatcher"])("returns a tenant-scoped estimate for %s", async (role) => {
    const res = await app.inject({ method: "GET", url, headers: { "x-role": role } });
    expect(res.statusCode).toBe(200);
    expect(res.json().eta).toMatchObject({ provider: "straight_line", method: "straight_line_estimate", confidence: "low", minutes: 12 });
    expect(res.json().eta).not.toHaveProperty("secret");
    expect(mocks.getJobEta).toHaveBeenCalledWith(companyId, jobId, { lat: 41.88, lng: -87.63 });
  });

  it.each([
    `/api/v1/jobs/not-a-uuid/eta?originLat=1&originLng=1`,
    `/api/v1/jobs/${jobId}/eta?originLat=91&originLng=1`,
    `/api/v1/jobs/${jobId}/eta?originLat=1`,
    `/api/v1/jobs/${jobId}/eta?originLat=1&originLng=1&extra=1`
  ])("rejects invalid input %s", async (bad) => {
    const res = await app.inject({ method: "GET", url: bad, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(400);
  });

  it("passes through unavailable results without guessing", async () => {
    mocks.getJobEta.mockResolvedValueOnce({
      jobId, provider: "straight_line", status: "unavailable", method: null, confidence: null,
      minutes: null, distanceMiles: null, assumedSpeedMph: null, unavailableReason: "missing_destination_coordinates"
    });
    const res = await app.inject({ method: "GET", url, headers: { "x-role": "dispatcher" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().eta).toMatchObject({ status: "unavailable", minutes: null, unavailableReason: "missing_destination_coordinates" });
  });
});
