import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { AGENT_POLICY_V1 } from "./agent-action.policy.js";
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

vi.mock("./tenant-context.service.js", () => ({
  resolveEntityRef: vi.fn(async (_companyId: string, entityType: string, entityId: string) => ({
    entityType,
    entityId,
    recordVersion: "rv1:1",
    source: { channel: "web" }
  }))
}));

vi.mock("@fsm/ai/langfuse", () => ({
  recordAgentAuditObservation: vi.fn(async () => undefined)
}));

type AgentActionServiceModule = typeof import("./agent-action.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let agentActionService: AgentActionServiceModule;
let executorsModule: typeof import("./agent-action.executors.js");
let registryModule: typeof import("./agent-action.registry.js");
let fakeDb: FakeDbModule;

beforeAll(async () => {
  await import("./revenue-agent/revenue-proposal.kinds.js");
  agentActionService = await import("./agent-action.service.js");
  executorsModule = await import("./agent-action.executors.js");
  registryModule = await import("./agent-action.registry.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
});

function seedTenantWithJob(slug: string) {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Casey", lastName: "Client" });
  const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, jobNumber: `J-${slug}`, title: "Visit" });
  const booking = fakeDb.seedBookingRequest({
    companyId: company.id,
    firstName: "Jamie",
    lastName: "Stone",
    phone: "555-0200",
    addressLine1: "500 Oak Ave",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    status: "pending",
    referenceNumber: `BK-${slug}`
  });
  return { company, job, booking };
}

function seedAction(
  companyId: string,
  input: { actionType: string; agentProduct: string; state?: string; parameters: Record<string, unknown>; target: { entityType: string; entityId: string } }
) {
  const record = fakeDb.seedAgentAction({
    companyId,
    agentProduct: input.agentProduct,
    actionType: input.actionType,
    idempotencyKey: `idem-${input.actionType}-${Math.random()}`,
    payloadHash: "hash-x",
    policyVersion: AGENT_POLICY_V1,
    requiresApproval: true,
    state: input.state ?? "approved",
    parameters: input.parameters,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    target: { ...input.target, recordVersion: "rv1:1", source: { channel: "web" } }
  } as never);
  Object.assign(record as object, { approvedParameters: input.parameters });
  return record;
}

const stored = (id: string) => fakeDb.getTestState().agentActions.find((row) => row.id === id);

describe("agent-action executors registry", () => {
  it("every human-approved action type has a registered executor (revenue, scheduling, service, loyalty)", () => {
    const executable = registryModule
      .listAgentActionTypeDefinitions()
      .filter((definition) => !definition.autoApproved)
      .map((definition) => definition.actionType);
    expect(executable).toEqual(expect.arrayContaining(["scheduling.booking.self_service", "revenue.inquiry.qualify", "revenue.invoice_reminder.propose"]));
    for (const actionType of executable) {
      expect(executorsModule.getAgentActionExecutor(actionType), actionType).toBeDefined();
    }
  });
});

describe("scheduling.booking.self_service executor", () => {
  it("executes inside the tenant transaction when the job still exists", async () => {
    const { company, job } = seedTenantWithJob("sched-ok");
    const action = seedAction(company.id, {
      actionType: "scheduling.booking.self_service",
      agentProduct: "scheduling",
      parameters: { channel: "internal", action: "reschedule", jobId: job.id },
      target: { entityType: "job", entityId: job.id }
    });

    const executed = await agentActionService.executeAgentAction(company.id, action.id, "reviewer-1");

    expect(executed.state).toBe("succeeded");
    expect(executed.executionReceipt).toMatchObject({ outcome: "succeeded" });
  });

  it("refuses a job from another tenant and leaves the action approved", async () => {
    const a = seedTenantWithJob("sched-a");
    const b = seedTenantWithJob("sched-b");
    const action = seedAction(a.company.id, {
      actionType: "scheduling.booking.self_service",
      agentProduct: "scheduling",
      parameters: { channel: "internal", action: "cancel", jobId: b.job.id },
      target: { entityType: "job", entityId: b.job.id }
    });

    await expect(agentActionService.executeAgentAction(a.company.id, action.id, "reviewer-1")).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
    expect(stored(action.id)?.state).toBe("approved");
  });
});

describe("revenue.inquiry.qualify executor", () => {
  it("executes when the booking request exists in the tenant", async () => {
    const { company, booking } = seedTenantWithJob("qual-ok");
    const action = seedAction(company.id, {
      actionType: "revenue.inquiry.qualify",
      agentProduct: "revenue",
      parameters: { bookingRequestId: booking.id },
      target: { entityType: "booking_request", entityId: booking.id }
    });

    expect((await agentActionService.executeAgentAction(company.id, action.id, "reviewer-1")).state).toBe("succeeded");
  });

  it("fails validation when the proposal has no booking request", async () => {
    const { company, booking } = seedTenantWithJob("qual-missing");
    const action = seedAction(company.id, {
      actionType: "revenue.inquiry.qualify",
      agentProduct: "revenue",
      parameters: {},
      target: { entityType: "booking_request", entityId: booking.id }
    });

    await expect(agentActionService.executeAgentAction(company.id, action.id, "reviewer-1")).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR
    });
    expect(stored(action.id)?.state).toBe("approved");
  });
});

describe("execute fails closed and honours expectedVersion", () => {
  it("rejects an action type with no registered executor without changing state", async () => {
    const { company, job } = seedTenantWithJob("no-exec");
    const action = seedAction(company.id, {
      actionType: "unregistered.kind",
      agentProduct: "revenue",
      parameters: {},
      target: { entityType: "job", entityId: job.id }
    });

    await expect(agentActionService.executeAgentAction(company.id, action.id, "reviewer-1")).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR
    });
    expect(stored(action.id)?.state).toBe("approved");
  });

  it("returns 409 CONFLICT on a stale expectedVersion for execute, approve and reject", async () => {
    const { company, job } = seedTenantWithJob("version");
    const approved = seedAction(company.id, {
      actionType: "scheduling.booking.self_service",
      agentProduct: "scheduling",
      parameters: { jobId: job.id },
      target: { entityType: "job", entityId: job.id }
    });
    const awaiting = seedAction(company.id, {
      actionType: "scheduling.booking.self_service",
      agentProduct: "scheduling",
      state: "awaiting_approval",
      parameters: { jobId: job.id },
      target: { entityType: "job", entityId: job.id }
    });
    const current = await agentActionService.getAgentAction(company.id, approved.id);
    const stale = { expectedVersion: current.version - 1 };

    for (const call of [
      () => agentActionService.executeAgentAction(company.id, approved.id, "r", stale),
      () => agentActionService.approveAgentAction(company.id, awaiting.id, "r", stale),
      () => agentActionService.rejectAgentAction(company.id, awaiting.id, "r", stale)
    ]) {
      await expect(call()).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    }
    expect(stored(approved.id)?.state).toBe("approved");
    expect(stored(awaiting.id)?.state).toBe("awaiting_approval");

    const executed = await agentActionService.executeAgentAction(company.id, approved.id, "r", {
      expectedVersion: current.version
    });
    expect(executed.state).toBe("succeeded");
    expect(executed.version).toBeGreaterThanOrEqual(current.version);
  });

  it("a second execute of the same action conflicts instead of re-running side effects", async () => {
    const { company, job } = seedTenantWithJob("double");
    const action = seedAction(company.id, {
      actionType: "scheduling.booking.self_service",
      agentProduct: "scheduling",
      parameters: { jobId: job.id },
      target: { entityType: "job", entityId: job.id }
    });

    await agentActionService.executeAgentAction(company.id, action.id, "r");
    await expect(agentActionService.executeAgentAction(company.id, action.id, "r")).rejects.toBeDefined();
    expect(stored(action.id)?.state).toBe("succeeded");
  });
});
