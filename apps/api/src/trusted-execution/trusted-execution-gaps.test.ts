/**
 * Ticket A "Trusted Execution": REPRODUCIBLE FAILING TESTS for documented gaps. NO FIXES.
 *
 * TE-STALE-01/02/03, TE-DUP-01/02, TE-FAIL-01 and TE-RCPT-01/02 are fixed and now live in
 * trusted-execution.test.ts (default run). Only TE-AUTH-01/02 remain here (fixed by #382, not yet merged).
 * These remaining tests intentionally fail on dev: each one asserts the behaviour the trusted-execution contract
 * requires and that dev does not provide yet. They are excluded from the default `vitest run`
 * (see vitest.config.ts) and run only through `pnpm --filter @fsm/api test:trusted-execution-gaps`.
 * Each title starts with its gap id from docs/architecture/TRUSTED_EXECUTION_AUDIT.md.
 * Controls (CTRL-*) pass today and prove the setup works, so every TE-* failure is an assertion on
 * the missing behaviour, not a setup error. No network, no env reads, no provider send.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 0) },
  webhooksQueue: { add: vi.fn() }
}));

vi.mock("@fsm/ai/langfuse", () => ({
  recordAgentAuditObservation: vi.fn(async () => undefined)
}));

// Target record version is stable so execute reaches the executor (stale-target is not under test here).
vi.mock("../services/tenant-context.service.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveEntityRef: vi.fn(async (_companyId: string, entityType: string, entityId: string) => ({
    entityType,
    entityId,
    recordVersion: "rv1:1",
    source: { channel: "web" }
  }))
}));

// Consent/policy gate allows, so the outbound executor path runs without customer consent rows (#301).
vi.mock("../services/outbound-policy-engine.service.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  authorizeAgentActionExecution: vi.fn(async () => ({
    allowed: true,
    policyVersion: "outbound-policy-test",
    reason: "allowed in test"
  }))
}));

type AppInstance = Awaited<ReturnType<(typeof import("../app.js"))["buildApp"]>>;

let app: AppInstance;
let buildAppModule: typeof import("../app.js");
let fakeDb: typeof import("../test-support/fake-db.js");
let tokens: typeof import("../lib/tokens.js");

beforeAll(async () => {
  buildAppModule = await import("../app.js");
  fakeDb = await import("../test-support/fake-db.js");
  tokens = await import("../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

type Role = "owner" | "admin" | "dispatcher" | "technician";

function tenant(slug: string) {
  const company = fakeDb.seedCompany({ name: `TE ${slug}`, slug });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Casey", lastName: "Client" });
  const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, jobNumber: `J-${slug}`, title: "Furnace tune-up" });
  const auth = (role: Role) => {
    const user = fakeDb.seedUser({ companyId: company.id, email: `${role}@${slug}.test`, firstName: role, lastName: "T", role });
    return { user, header: `Bearer ${tokens.generateAccessToken({ userId: user.id, companyId: company.id, role })}` };
  };
  return { company, job, auth };
}

function seedAction(
  companyId: string,
  input: { actionType: string; agentProduct: string; state: string; parameters: Record<string, unknown>; target: { entityType: string; entityId: string } }
) {
  const record = fakeDb.seedAgentAction({
    companyId,
    agentProduct: input.agentProduct,
    actionType: input.actionType,
    requiresApproval: true,
    state: input.state,
    parameters: input.parameters,
    target: { ...input.target, recordVersion: "rv1:1", source: { channel: "web" } }
  } as never);
  if (input.state === "approved") Object.assign(record as object, { approvedParameters: input.parameters });
  return record;
}

const stored = (id: string) => fakeDb.getTestState().agentActions.find((row) => row.id === id)!;

function seedSchedulingAction(companyId: string, jobId: string, state: "awaiting_approval" | "approved") {
  return seedAction(companyId, {
    actionType: "scheduling.booking.self_service",
    agentProduct: "scheduling",
    state,
    parameters: { channel: "internal", action: "reschedule", jobId },
    target: { entityType: "job", entityId: jobId }
  });
}

describe("Trusted Execution gaps: controls (pass today; prove the harness works)", () => {
  it("CTRL-01 owner approves an awaiting action (200) and execute of an internal action succeeds", async () => {
    const { company, job, auth } = tenant("ctrl");
    const owner = auth("owner");
    const pending = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const approved = await request(app.server)
      .post(`/api/v1/agent-actions/${pending.id}/approve`)
      .set("Authorization", owner.header)
      .send({ expectedVersion: stored(pending.id).updatedAt.getTime() });
    expect(approved.status).toBe(200);
    const executed = await request(app.server)
      .post(`/api/v1/agent-actions/${pending.id}/execute`)
      .set("Authorization", owner.header)
      .send({ expectedVersion: approved.body.version });
    expect(executed.status).toBe(200);
    expect(executed.body.state).toBe("succeeded");
  });

  it("CTRL-02 wrong role (technician) gets 403 and cross-tenant owner gets 404 on approve/execute", async () => {
    const a = tenant("ctrl-a");
    const b = tenant("ctrl-b");
    const action = seedSchedulingAction(a.company.id, a.job.id, "awaiting_approval");
    const tech = a.auth("technician");
    const ownerB = b.auth("owner");
    for (const op of ["approve", "execute"]) {
      const body = { expectedVersion: stored(action.id).updatedAt.getTime() };
      expect((await request(app.server).post(`/api/v1/agent-actions/${action.id}/${op}`).set("Authorization", tech.header).send(body)).status).toBe(403);
      expect((await request(app.server).post(`/api/v1/agent-actions/${action.id}/${op}`).set("Authorization", ownerB.header).send(body)).status).toBe(404);
    }
    expect(stored(action.id).state).toBe("awaiting_approval");
  });
});

describe("Trusted Execution gaps: unauthorized actions", () => {
  it("TE-AUTH-01 unauthenticated approve with a malformed id must be 401 (auth before validation), not 400", async () => {
    const res = await request(app.server).post("/api/v1/agent-actions/not-a-uuid/approve").send({ expectedVersion: "x" });
    expect(res.status).toBe(401);
  });

  it("TE-AUTH-02 technician execute with a malformed body must be 403 (role before validation), not 400", async () => {
    const { company, job, auth } = tenant("auth2");
    const action = seedSchedulingAction(company.id, job.id, "approved");
    const res = await request(app.server)
      .post(`/api/v1/agent-actions/${action.id}/execute`)
      .set("Authorization", auth("technician").header)
      .send({ expectedVersion: "not-a-number" });
    expect(res.status).toBe(403);
  });
});
