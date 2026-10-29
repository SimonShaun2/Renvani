import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ verify: vi.fn() }));
const service = vi.hoisted(() => ({ get: vi.fn(), reserve: vi.fn() }));
vi.mock("../../lib/clerk-auth.js", () => ({ verifyClerkBearerToken: auth.verify }));
vi.mock("../../services/clerk-workspace-intent.service.js", () => ({
  getClerkWorkspaceIntent: service.get,
  reserveClerkWorkspaceIntent: service.reserve
}));

import routes from "./index.js";
import errorHandlerPlugin from "../../plugins/error-handler.js";

describe("FS-235 workspace intent route", () => {
  beforeEach(() => {
    auth.verify.mockReset().mockResolvedValue({ clerkUserId: "user_a", clerkOrganizationId: null });
    service.get.mockReset().mockResolvedValue(null);
    service.reserve.mockReset().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", status: "pending" });
  });

  async function app() {
    const fastify = Fastify();
    await fastify.register(errorHandlerPlugin);
    await fastify.register(routes, { prefix: "/api/v1/onboarding" });
    return fastify;
  }

  it("accepts a verified Clerk user whose token has no organization claim", async () => {
    const fastify = await app();
    try {
      const response = await fastify.inject({ method: "POST", url: "/api/v1/onboarding/workspace-intent", headers: { authorization: "Bearer token" }, payload: { name: "  Acme Plumbing  " } });
      expect(response.statusCode).toBe(200);
      expect(auth.verify).toHaveBeenCalledWith("token", { requireOrganization: false });
      expect(service.reserve).toHaveBeenCalledWith("user_a", "Acme Plumbing");
    } finally { await fastify.close(); }
  });

  it("denies unauthenticated access before reading or writing", async () => {
    const fastify = await app();
    try {
      const response = await fastify.inject({ method: "GET", url: "/api/v1/onboarding/workspace-intent" });
      expect(response.statusCode).toBe(401);
      expect(service.get).not.toHaveBeenCalled();
    } finally { await fastify.close(); }
  });

  it("rejects invalid body before service write", async () => {
    const fastify = await app();
    try {
      const response = await fastify.inject({ method: "POST", url: "/api/v1/onboarding/workspace-intent", headers: { authorization: "Bearer token" }, payload: { name: "" } });
      expect(response.statusCode).toBe(400);
      expect(service.reserve).not.toHaveBeenCalled();
    } finally { await fastify.close(); }
  });
});
