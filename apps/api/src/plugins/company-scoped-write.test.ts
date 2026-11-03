import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

const JWT_SECRET = "jwt_secret";

setupTestEnv();

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
  app.get(
    "/_test/company-scope",
    { preHandler: app.authenticate },
    async (request) => ({
      result: await request.runCompanyScopedTransaction(async () => "scoped-ok")
    })
  );
  await app.ready();
});

describe("company-scoped-write plugin", () => {
  it("exposes runCompanyScopedTransaction on authenticated requests", async () => {
    const company = fakeDb.seedCompany({ name: "Scoped Co", slug: "scoped-co" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@scoped.com",
      firstName: "Owner",
      lastName: "User",
      role: "owner"
    });

    const token = jwt.sign(
      { userId: user.id, companyId: company.id, role: "owner", tokenType: "access" },
      JWT_SECRET,
      { expiresIn: 3600 }
    );

    const response = await app.inject({
      method: "GET",
      url: "/_test/company-scope",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ result: "scoped-ok" });
  });
});
