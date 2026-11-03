import jwt from "jsonwebtoken";
import type { FastifyRequest } from "fastify";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

const JWT_SECRET = "jwt_secret";

setupTestEnv();

vi.mock("../lib/clerk-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/clerk-auth.js")>();
  return {
    ...actual,
    isClerkParallelAuthAvailable: vi.fn(() => true),
    verifyClerkBearerToken: vi.fn(async () => ({
      clerkUserId: "clerk_user_1",
      clerkOrganizationId: "org_mapped",
      email: "clerk-staff@example.com"
    }))
  };
});

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

type BuildAppModule = typeof import("../app.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

beforeAll(async () => {
  buildAppModule = await import("../app.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  app = await buildAppModule.buildApp();
  await app.ready();
});

function buildRequest(authorization?: string): FastifyRequest {
  return {
    headers: authorization ? { authorization } : {}
  } as FastifyRequest;
}

describe("authenticate plugin", () => {
  it("rejects missing authorization header", async () => {
    const request = buildRequest();

    await expect(app.authenticate(request, {} as never)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("rejects malformed bearer tokens", async () => {
    const request = buildRequest("Bearer");

    await expect(app.authenticate(request, {} as never)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("rejects access tokens with a companyId that does not match the user row", async () => {
    const companyA = fakeDb.seedCompany({ name: "Company A", slug: "company-a" });
    const companyB = fakeDb.seedCompany({ name: "Company B", slug: "company-b" });
    const user = fakeDb.seedUser({
      companyId: companyA.id,
      email: "staff@example.com",
      firstName: "Staff",
      lastName: "User",
      role: "owner"
    });

    const token = jwt.sign(
      {
        userId: user.id,
        companyId: companyB.id,
        role: "owner",
        tokenType: "access"
      },
      JWT_SECRET,
      { expiresIn: 3600 }
    );

    const request = buildRequest(`Bearer ${token}`);

    await expect(app.authenticate(request, {} as never)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN
    });
  });

  it("derives role from the database, not from JWT claims", async () => {
    const company = fakeDb.seedCompany({ name: "Company A", slug: "company-a" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "tech@example.com",
      firstName: "Tech",
      lastName: "User",
      role: "technician"
    });

    const token = jwt.sign(
      {
        userId: user.id,
        companyId: company.id,
        role: "owner",
        tokenType: "access"
      },
      JWT_SECRET,
      { expiresIn: 3600 }
    );

    const request = buildRequest(`Bearer ${token}`);
    await app.authenticate(request, {} as never);

    expect(request.user.role).toBe("technician");
  });

  it("authenticates via Clerk when JWT fails and parallel auth is enabled", async () => {
    const company = fakeDb.seedCompany({
      name: "Clerk Co",
      slug: "clerk-co",
      settings: { clerk: { organizationId: "org_mapped" } }
    });
    fakeDb.seedUser({
      companyId: company.id,
      email: "clerk-staff@example.com",
      firstName: "Clerk",
      lastName: "Staff",
      role: "admin"
    });

    const request = buildRequest("Bearer not-a-jwt-token");
    await app.authenticate(request, {} as never);

    expect(request.authProvider).toBe("clerk");
    expect(request.company.id).toBe(company.id);
    expect(request.user.email).toBe("clerk-staff@example.com");
    expect(request.user.role).toBe("admin");
  });

  it("rejects Clerk token when organization is not linked to a company", async () => {
    const request = buildRequest("Bearer orphan-clerk-token");

    await expect(app.authenticate(request, {} as never)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });
});
