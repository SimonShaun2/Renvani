/**
 * Ticket A "Trusted Execution": REPRODUCIBLE FAILING TESTS for documented gaps. NO FIXES.
 *
 * These tests intentionally fail on dev: each one asserts the behaviour the trusted-execution contract
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
let service: typeof import("../services/agent-action.service.js");
let registry: typeof import("../services/agent-action.registry.js");
let executors: typeof import("../services/agent-action.executors.js");

const THROWING_ACTION_TYPE = "te_gap.adapter_throws";
const PROVIDER_ERROR = "provider adapter unavailable (test)";

beforeAll(async () => {
  buildAppModule = await import("../app.js");
  fakeDb = await import("../test-support/fake-db.js");
  tokens = await import("../lib/tokens.js");
  service = await import("../services/agent-action.service.js");
  registry = await import("../services/agent-action.registry.js");
  executors = await import("../services/agent-action.executors.js");
  // Test-only action type whose provider adapter throws during execute (no network).
  registry.registerAgentActionType({ actionType: THROWING_ACTION_TYPE, agentProduct: "revenue", aiMayPropose: true });
  executors.registerAgentActionExecutor(THROWING_ACTION_TYPE, {
    applyInTransaction: async () => {
      throw new Error(PROVIDER_ERROR);
    }
  });
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

function seedMessageAction(companyId: string, customerId: string, state: "awaiting_approval" | "approved") {
  return seedAction(companyId, {
    actionType: "message.send_proposed",
    agentProduct: "revenue",
    state,
    parameters: { channel: "sms", body: "Your technician is on the way.", customerId },
    target: { entityType: "customer", entityId: customerId }
  });
}

describe("Trusted Execution gaps: controls (pass today; prove the harness works)", () => {
  it("CTRL-01 owner approves an awaiting action (200) and execute of an internal action succeeds", async () => {
    const { company, job, auth } = tenant("ctrl");
    const owner = auth("owner");
    const pending = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const approved = await request(app.server).post(`/api/v1/agent-actions/${pending.id}/approve`).set("Authorization", owner.header).send({});
    expect(approved.status).toBe(200);
    const executed = await request(app.server).post(`/api/v1/agent-actions/${pending.id}/execute`).set("Authorization", owner.header).send({});
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
      expect((await request(app.server).post(`/api/v1/agent-actions/${action.id}/${op}`).set("Authorization", tech.header).send({})).status).toBe(403);
      expect((await request(app.server).post(`/api/v1/agent-actions/${action.id}/${op}`).set("Authorization", ownerB.header).send({})).status).toBe(404);
    }
    expect(stored(action.id).state).toBe("awaiting_approval");
  });
});

describe("Trusted Execution gaps: stale records (expectedVersion)", () => {
  it("TE-STALE-01 approve without expectedVersion must be rejected (400), not applied blind", async () => {
    const { company, job, auth } = tenant("stale1");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const res = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", auth("owner").header).send({});
    expect(res.status, "approve must require expectedVersion").toBe(400);
    expect(stored(action.id).state).toBe("awaiting_approval");
  });

  it("TE-STALE-02 execute without expectedVersion must be rejected (400), not applied blind", async () => {
    const { company, job, auth } = tenant("stale2");
    const action = seedSchedulingAction(company.id, job.id, "approved");
    const res = await request(app.server).post(`/api/v1/agent-actions/${action.id}/execute`).set("Authorization", auth("owner").header).send({});
    expect(res.status, "execute must require expectedVersion").toBe(400);
    expect(stored(action.id).state).toBe("approved");
  });

  it("TE-STALE-03 operator edit with a stale expectedVersion must be 409 and leave the body unchanged", async () => {
    const { company, customer, auth } = (() => {
      const t = tenant("stale3");
      const c = fakeDb.seedCustomer({ companyId: t.company.id, firstName: "Pat", lastName: "Doe" });
      return { ...t, customer: c };
    })();
    const action = seedMessageAction(company.id, customer.id, "awaiting_approval");
    const staleVersion = stored(action.id).updatedAt.getTime() - 60_000;
    const res = await request(app.server)
      .patch(`/api/v1/operator/inbox/${action.id}`)
      .set("Authorization", auth("owner").header)
      .send({ body: "Edited against a stale copy", expectedVersion: staleVersion });
    expect(res.status, "edit must honour expectedVersion").toBe(409);
    expect((stored(action.id).parameters as Record<string, unknown>).body).toBe("Your technician is on the way.");
  });
});

describe("Trusted Execution gaps: duplicate operations (idempotency)", () => {
  it("TE-DUP-01 double approve with the same Idempotency-Key replays the first result (200, same version)", async () => {
    const { company, job, auth } = tenant("dup1");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const first = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-approve-1").send({});
    expect(first.status).toBe(200);
    const second = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-approve-1").send({});
    expect(second.status, "same-key approve should replay, not 409").toBe(200);
    expect(second.body.version).toBe(first.body.version);
  });

  it("TE-DUP-02 double execute with the same Idempotency-Key replays the same receipt (200)", async () => {
    const { company, job, auth } = tenant("dup2");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "approved");
    const first = await request(app.server).post(`/api/v1/agent-actions/${action.id}/execute`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-exec-1").send({});
    expect(first.status).toBe(200);
    const second = await request(app.server).post(`/api/v1/agent-actions/${action.id}/execute`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-exec-1").send({});
    expect(second.status, "same-key execute should replay, not 409").toBe(200);
    expect(second.body.executionReceipt).toEqual(first.body.executionReceipt);
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

describe("Trusted Execution gaps: failed execution and receipt states", () => {
  it("TE-FAIL-01 provider/adapter throw during execute yields a persisted failed receipt, not a silent rollback to approved", async () => {
    const { company, job } = tenant("fail1");
    const action = seedAction(company.id, {
      actionType: THROWING_ACTION_TYPE,
      agentProduct: "revenue",
      state: "approved",
      parameters: { jobId: job.id },
      target: { entityType: "job", entityId: job.id }
    });
    await expect(service.executeAgentAction(company.id, action.id, "reviewer-1")).rejects.toThrow(PROVIDER_ERROR);
    const row = stored(action.id);
    expect(row.state, "a failed execution must be recorded as failed").toBe("failed");
    expect((row.executionReceipt as Record<string, unknown> | null)?.outcome).toBe("failed");
  });

  it("TE-RCPT-01 executing message.send_proposed with no live provider must not read as done (succeeded)", async () => {
    const t = tenant("rcpt1");
    const customer = fakeDb.seedCustomer({ companyId: t.company.id, firstName: "Pat", lastName: "Doe" });
    const action = seedMessageAction(t.company.id, customer.id, "approved");
    const executed = await service.executeAgentAction(t.company.id, action.id, "reviewer-1");
    expect(executed.state, "no provider send happened, so the action is not done").not.toBe("succeeded");
  });

  it("TE-RCPT-02 receipt for an outbound send carries a distinct delivery state (queued | provider_accepted | delivered | failed)", async () => {
    const t = tenant("rcpt2");
    const customer = fakeDb.seedCustomer({ companyId: t.company.id, firstName: "Pat", lastName: "Doe" });
    const action = seedMessageAction(t.company.id, customer.id, "approved");
    const executed = await service.executeAgentAction(t.company.id, action.id, "reviewer-1");
    expect(["queued", "provider_accepted", "delivered", "failed"]).toContain(
      (executed.executionReceipt as Record<string, unknown> | null)?.deliveryState
    );
  });
});
