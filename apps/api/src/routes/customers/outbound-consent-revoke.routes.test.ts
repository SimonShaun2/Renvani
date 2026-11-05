import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const revoke = vi.hoisted(() => vi.fn());

// App startup must not call Stripe from an HTTP authorization test.
vi.mock("../../plugins/stripe-platform-sync.js", () => ({ default: async () => {} }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({ aiQueue: { add: vi.fn() } }));

vi.mock("../../services/outbound-consent.service.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../services/outbound-consent.service.js")>(),
  revokeOperatorOutboundConsent: revoke,
}));

type AppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<AppModule["buildApp"]>>;

let appModule: AppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  appModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
}, 30_000);

beforeEach(async () => {
  fakeDb.resetTestState();
  revoke.mockReset().mockResolvedValue({ id: randomUUID(), version: 1, currentState: "revoked" });
  app = await appModule.buildApp();
  await app.ready();
});

afterEach(async () => app.close());

function auth(role: "owner" | "admin" | "technician", slug: string) {
  const company = fakeDb.seedCompany({ name: slug, slug });
  const user = fakeDb.seedUser({
    companyId: company.id, email: `${role}-${slug}@example.test`,
    firstName: "Test", lastName: "Operator", role,
  });
  const accessToken = tokens.generateAccessToken({ userId: user.id, companyId: company.id, role });
  return { company, user, authorization: `Bearer ${accessToken}` };
}

const body = { channel: "email", purpose: "marketing", idempotencyKey: "fs234-route-1" };
const path = (id: string) => `/api/v1/customers/${id}/outbound-consent/revoke`;

describe("FS-234 operator consent revocation HTTP boundary", () => {
  it("requires authentication and blocks technician access before the service", async () => {
    const tech = auth("technician", "fs234-tech");
    const customerId = randomUUID();
    expect((await request(app.server).post(path(customerId)).send(body)).status).toBe(401);
    expect((await request(app.server).post(path(customerId))
      .set("Authorization", tech.authorization).send(body)).status).toBe(403);
    expect(revoke).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"] as const)("binds %s to the authenticated tenant and actor", async (role) => {
    const session = auth(role, `fs234-${role}`);
    const customerId = randomUUID();
    const response = await request(app.server).post(path(customerId))
      .set("Authorization", session.authorization).send(body);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ version: 1, state: "revoked" });
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith(
      { companyId: session.company.id, actorType: "user", actorId: session.user.id, role },
      { customerId, ...body },
    );
  });

  it("rejects forged consent evidence and malformed identifiers at the route", async () => {
    const session = auth("owner", "fs234-invalid");
    const customerId = randomUUID();
    for (const [id, input] of [
      [customerId, { ...body, contact: "forged@example.test" }],
      [customerId, { ...body, decision: "grant" }],
      [customerId, { ...body, idempotencyKey: "" }],
      ["not-a-uuid", body],
    ] as const) {
      const response = await request(app.server).post(path(id))
        .set("Authorization", session.authorization).send(input);
      expect(response.status).toBe(400);
    }
    expect(revoke).not.toHaveBeenCalled();
  });

  it("does not substitute a foreign customer's company for the authenticated tenant", async () => {
    const owner = auth("owner", "fs234-tenant-a");
    const other = auth("owner", "fs234-tenant-b");
    const foreign = fakeDb.seedCustomer({ companyId: other.company.id,
      firstName: "Other", lastName: "Customer", email: "other@example.test" });
    revoke.mockRejectedValueOnce(new AppError(ErrorCode.NOT_FOUND, "Active customer unavailable"));
    const response = await request(app.server).post(path(foreign.id))
      .set("Authorization", owner.authorization).send(body);
    expect(response.status).toBe(404);
    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: owner.company.id, actorId: owner.user.id }),
      expect.objectContaining({ customerId: foreign.id }),
    );
  });
});
