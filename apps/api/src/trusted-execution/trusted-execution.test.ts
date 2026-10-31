/**
 * Ticket A "Trusted Execution", fix PR 1: stale-version and idempotent-replay guarantees for
 * agent-action approve/execute and operator edit (TE-STALE-*, TE-DUP-*), and auth-before-validation (TE-AUTH-*). Runs in the default suite.
 * Gap ids refer to docs/architecture/TRUSTED_EXECUTION_AUDIT.md. No network, no env reads, no provider send.
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

function seedMessageAction(companyId: string, customerId: string, state: "awaiting_approval" | "approved") {
  return seedAction(companyId, {
    actionType: "message.send_proposed",
    agentProduct: "revenue",
    state,
    parameters: { channel: "sms", body: "Your technician is on the way.", customerId },
    target: { entityType: "customer", entityId: customerId }
  });
}
describe("Trusted Execution: stale records (expectedVersion)", () => {
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

  it("TE-STALE-04 approve with a stale expectedVersion is 409; with the current version it applies", async () => {
    const { company, job, auth } = tenant("stale4");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const current = stored(action.id).updatedAt.getTime();
    const stale = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).send({ expectedVersion: current - 1 });
    expect(stale.status).toBe(409);
    expect(stored(action.id).state).toBe("awaiting_approval");
    const ok = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).send({ expectedVersion: current });
    expect(ok.status).toBe(200);
    expect(ok.body.state).toBe("approved");
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

describe("Trusted Execution: duplicate operations (idempotency)", () => {
  it("TE-DUP-01 double approve with the same Idempotency-Key replays the first result (200, same version)", async () => {
    const { company, job, auth } = tenant("dup1");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const body = { expectedVersion: stored(action.id).updatedAt.getTime() };
    const first = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-approve-1").send(body);
    expect(first.status).toBe(200);
    const second = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-approve-1").send(body);
    expect(second.status, "same-key approve should replay, not 409").toBe(200);
    expect(second.body.version).toBe(first.body.version);
    expect(second.body.replayed).toBe(true);
    expect(first.body.replayed).toBeUndefined();
  });

  it("TE-DUP-02 double execute with the same Idempotency-Key replays the same receipt (200)", async () => {
    const { company, job, auth } = tenant("dup2");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "approved");
    const body = { expectedVersion: stored(action.id).updatedAt.getTime() };
    const first = await request(app.server).post(`/api/v1/agent-actions/${action.id}/execute`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-exec-1").send(body);
    expect(first.status).toBe(200);
    const second = await request(app.server).post(`/api/v1/agent-actions/${action.id}/execute`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-exec-1").send(body);
    expect(second.status, "same-key execute should replay, not 409").toBe(200);
    expect(second.body.executionReceipt).toEqual(first.body.executionReceipt);
    expect(second.body.replayed).toBe(true);
  });

  it("TE-DUP-03 same Idempotency-Key with a different request body stays 409", async () => {
    const { company, job, auth } = tenant("dup3");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const version = stored(action.id).updatedAt.getTime();
    const first = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-3").send({ expectedVersion: version });
    expect(first.status).toBe(200);
    const second = await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).set("Idempotency-Key", "te-dup-3").send({ expectedVersion: version + 1 });
    expect(second.status).toBe(409);
  });

  it("TE-DUP-04 a second approve without a key is still a 409 (no blind re-apply)", async () => {
    const { company, job, auth } = tenant("dup4");
    const owner = auth("owner");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const body = { expectedVersion: stored(action.id).updatedAt.getTime() };
    expect((await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).send(body)).status).toBe(200);
    expect((await request(app.server).post(`/api/v1/agent-actions/${action.id}/approve`).set("Authorization", owner.header).send(body)).status).toBe(409);
  });
});

describe("Trusted Execution: auth runs before validation (onRequest)", () => {
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

describe("Trusted Execution: auth before validation on the operator surface", () => {
  it("TE-AUTH-03 unauthenticated operator inbox edit with a malformed id is 401, not 400", async () => {
    const res = await request(app.server).patch("/api/v1/operator/inbox/not-a-uuid").send({});
    expect(res.status).toBe(401);
  });

  it("TE-AUTH-04 technician escalate with a malformed body is 403, not 400", async () => {
    const { company, job, auth } = tenant("auth4");
    const action = seedSchedulingAction(company.id, job.id, "awaiting_approval");
    const res = await request(app.server)
      .post(`/api/v1/agent-actions/${action.id}/escalate`)
      .set("Authorization", auth("technician").header)
      .send({ expectedVersion: "not-a-number" });
    expect(res.status).toBe(403);
  });

  it("TE-AUTH-05 an authorised owner with a malformed body still gets 400 (validation still runs)", async () => {
    const { company, job, auth } = tenant("auth5");
    const action = seedSchedulingAction(company.id, job.id, "approved");
    const res = await request(app.server)
      .post(`/api/v1/agent-actions/${action.id}/execute`)
      .set("Authorization", auth("owner").header)
      .send({ expectedVersion: "not-a-number" });
    expect(res.status).toBe(400);
  });
});
