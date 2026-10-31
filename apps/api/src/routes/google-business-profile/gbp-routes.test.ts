import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getGbpStatus: vi.fn(), setGbpOptIn: vi.fn(), readGbp: vi.fn() }));
vi.mock("../../services/growth/gbp.service.js", () => mocks);

import routes from "./index.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const base = "/api/v1/integrations/google-business-profile";
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify();
  app.decorate("authenticate", async (request: { headers: Record<string, string>; user?: unknown; company?: unknown }) => {
    request.user = { id: "u1", role: request.headers["x-role"] };
    request.company = { id: companyId };
  });
  app.setErrorHandler((error: Error & { code?: string }, _req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "VALIDATION_ERROR" || error.name === "ZodError" ? 400 : 500;
    reply.code(status).send({ error: error.code ?? "ERR" });
  });
  await app.register(routes, { prefix: base });
  await app.ready();
  mocks.getGbpStatus.mockResolvedValue({ optIn: false, provider: "disabled", configured: false, updatedAt: null });
  mocks.setGbpOptIn.mockResolvedValue({ optIn: true, provider: "disabled", configured: false, updatedAt: "2026-10-30T05:00:00.000Z" });
  mocks.readGbp.mockResolvedValue({ status: "not_configured", provider: "disabled", reason: "adapter_disabled" });
});
afterEach(async () => {
  await app.close();
});

describe("Growth GBP routes", () => {
  it.each(["office", "dispatcher", "technician", undefined])("rejects role %s on every route", async (role) => {
    const headers = role ? { "x-role": role } : {};
    for (const req of [
      { method: "GET" as const, url: base },
      { method: "PUT" as const, url: `${base}/opt-in`, payload: { optIn: true } },
      { method: "GET" as const, url: `${base}/reviews` }
    ]) {
      const res = await app.inject({ ...req, headers });
      expect(res.statusCode).toBe(403);
    }
    expect(mocks.setGbpOptIn).not.toHaveBeenCalled();
    expect(mocks.readGbp).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"])("returns tenant-scoped status for %s", async (role) => {
    const res = await app.inject({ method: "GET", url: base, headers: { "x-role": role } });
    expect(res.statusCode).toBe(200);
    expect(res.json().googleBusinessProfile).toMatchObject({ provider: "disabled", configured: false });
    expect(mocks.getGbpStatus).toHaveBeenCalledWith(companyId);
  });

  it("toggles opt-in for the caller's company only", async () => {
    const res = await app.inject({ method: "PUT", url: `${base}/opt-in`, payload: { optIn: true }, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(200);
    expect(mocks.setGbpOptIn).toHaveBeenCalledWith(companyId, "u1", true);
  });

  it.each([{}, { optIn: "yes" }, { optIn: true, companyId: "other" }])("rejects invalid opt-in body %j", async (payload) => {
    const res = await app.inject({ method: "PUT", url: `${base}/opt-in`, payload, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(400);
    expect(mocks.setGbpOptIn).not.toHaveBeenCalled();
  });

  it.each(["profile", "hours", "services", "reviews"])("read %s returns not_configured while disabled", async (resource) => {
    const res = await app.inject({ method: "GET", url: `${base}/${resource}`, headers: { "x-role": "admin" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().result).toEqual({ status: "not_configured", provider: "disabled", reason: "adapter_disabled" });
    expect(mocks.readGbp).toHaveBeenCalledWith(companyId, resource);
  });

  it("rejects unknown resource", async () => {
    const res = await app.inject({ method: "GET", url: `${base}/posts`, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(400);
  });
});
