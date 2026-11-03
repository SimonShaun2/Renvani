import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./handlers.js", () => ({
  createIntegrationOutboxOperationHandler: async (_r: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
    reply.code(201).send({ ok: true }),
  recordIntegrationOutboxRetryHandler: async (_r: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
    reply.code(201).send({ ok: true }),
  listIntegrationOutboxOperationsHandler: async (_r: unknown, reply: { send: (b: unknown) => unknown }) => reply.send({ data: [] }),
  listIntegrationOutboxAuditEventsHandler: async (_r: unknown, reply: { send: (b: unknown) => unknown }) => reply.send({ data: [] })
}));
vi.mock("./schemas.js", async (orig) => {
  const actual = await orig<typeof import("./schemas.js")>();
  const pass = async () => undefined;
  return {
    ...actual,
    // Role gating is under test here; body validation is covered by the schema tests below.
    createIntegrationOutboxOperationValidation: pass,
    recordIntegrationOutboxRetryValidation: pass,
    listIntegrationOutboxOperationsValidation: pass,
    listIntegrationOutboxAuditValidation: pass,
    createIntegrationOutboxOperationRouteSchema: {},
    recordIntegrationOutboxRetryRouteSchema: {},
    listIntegrationOutboxOperationsRouteSchema: {},
    listIntegrationOutboxAuditRouteSchema: {}
  };
});

import routes from "./index.js";
import {
  INTEGRATION_OUTBOX_ATTRIBUTION_MAX_BYTES,
  INTEGRATION_OUTBOX_PAYLOAD_MAX_BYTES,
  INTEGRATION_OUTBOX_PAYLOAD_MAX_KEYS,
  createIntegrationOutboxOperationBodySchema
} from "./schemas.js";

const opId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  app = Fastify();
  app.decorate("authenticate", async (request: { headers: Record<string, string>; user?: unknown; company?: unknown }) => {
    request.user = { id: "u1", role: request.headers["x-role"] };
    request.company = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
  });
  app.setErrorHandler((error: Error & { code?: string }, _req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    reply.code(error.code === "FORBIDDEN" ? 403 : 500).send({ error: error.code ?? "ERR" });
  });
  await app.register(routes);
  await app.ready();
});
afterEach(async () => {
  await app.close();
});

describe("integration-outbox write routes are owner/admin only", () => {
  const writes = [
    { method: "POST" as const, url: "/integration-outbox/operations" },
    { method: "POST" as const, url: `/integration-outbox/operations/${opId}/retry-receipts` }
  ];
  it.each(writes.flatMap((w) => ["owner", "admin"].map((role) => ({ ...w, role }))))("allows $role on $url", async ({ method, url, role }) => {
    const res = await app.inject({ method, url, headers: { "x-role": role }, payload: {} });
    expect(res.statusCode).toBe(201);
  });
  it.each(writes.flatMap((w) => ["office", "dispatcher", "technician"].map((role) => ({ ...w, role }))))("rejects $role on $url", async ({ method, url, role }) => {
    const res = await app.inject({ method, url, headers: { "x-role": role }, payload: {} });
    expect(res.statusCode).toBe(403);
  });
  it.each(["office", "dispatcher"])("keeps reads open to %s", async (role) => {
    const res = await app.inject({ method: "GET", url: "/integration-outbox/operations", headers: { "x-role": role } });
    expect(res.statusCode).toBe(200);
  });
});

describe("integration-outbox body size caps", () => {
  it("rejects payloads over the key or byte cap and oversized attribution", () => {
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: INTEGRATION_OUTBOX_PAYLOAD_MAX_KEYS + 1 }, (_, i) => [`k${i}`, 1])
    );
    const tooBig = { blob: "x".repeat(INTEGRATION_OUTBOX_PAYLOAD_MAX_BYTES) };
    const shape = createIntegrationOutboxOperationBodySchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(shape.payload!.safeParse(tooManyKeys).success).toBe(false);
    expect(shape.payload!.safeParse(tooBig).success).toBe(false);
    expect(shape.payload!.safeParse({ a: 1 }).success).toBe(true);
    expect(
      shape.attribution!.safeParse({ schemaVersion: 1, note: "x".repeat(INTEGRATION_OUTBOX_ATTRIBUTION_MAX_BYTES) }).success
    ).toBe(false);
  });
});
