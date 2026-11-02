import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("../test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("../test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 0) },
  webhooksQueue: { add: vi.fn() }
}));
vi.mock("@fsm/ai/langfuse", () => ({ recordAgentAuditObservation: vi.fn(async () => undefined) }));

let fakeDb: typeof import("../test-support/fake-db.js");
let receipt: typeof import("./agent-action-receipt.js");
let executors: typeof import("./agent-action.executors.js");
let types: typeof import("@fsm/types");

const base = {
  approvedParameters: { channel: "sms", body: "hi" },
  approvedParametersHash: "h",
  executedAt: "2026-10-31T18:00:00.000Z"
};

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  receipt = await import("./agent-action-receipt.js");
  executors = await import("./agent-action.executors.js");
  await import("./revenue-agent/revenue-proposal.kinds.js");
  types = await import("@fsm/types");
});

beforeEach(() => fakeDb.resetTestState());

describe("TE-RCPT-01/02 delivery kinds and execute result", () => {
  it("marks every customer-contacting type outbound and internal types internal", () => {
    for (const t of [
      "message.send_proposed",
      "loyalty.reminder.propose",
      "revenue.invoice_reminder.propose",
      "revenue.estimate_followup.propose",
      "revenue.reactivation.propose",
      "revenue.plan_offer.propose"
    ]) {
      expect(executors.getAgentActionDeliveryKind(t), t).toBe("outbound");
    }
    for (const t of ["service.job_brief.propose", "scheduling.booking.self_service", "revenue.inquiry.qualify", "unknown.type"]) {
      expect(executors.getAgentActionDeliveryKind(t), t).toBe("internal");
    }
  });

  it("outbound execute never reads as done: state executing, outcome queued, deliveryState queued", () => {
    const result = receipt.buildAgentActionExecutionResultForType("message.send_proposed", base);
    expect(result.state).not.toBe("succeeded");
    expect(result).toMatchObject({ state: "executing", receipt: { outcome: "queued", deliveryState: "queued", note: receipt.AGENT_ACTION_QUEUED_NOTE } });
    expect(types.ExecutionReceiptV1Schema.parse(result.receipt).deliveryState).toBe("queued");
  });

  it("internal execute stays succeeded with no delivery state", () => {
    const result = receipt.buildAgentActionExecutionResultForType("service.job_brief.propose", base);
    expect(result.state).toBe("succeeded");
    expect(result.receipt).not.toHaveProperty("deliveryState");
    expect(types.ExecutionReceiptV1Schema.parse(result.receipt).outcome).toBe("succeeded");
  });

  it("the delivery enum is exactly the Figma 331:4230 tokens", () => {
    expect(types.AgentActionDeliveryStateV1Schema.options).toEqual(["queued", "provider_accepted", "delivered", "failed"]);
    expect(types.ExecutionReceiptV1Schema.safeParse({ outcome: "queued", emittedEventIds: [], deliveryState: "sent" }).success).toBe(false);
  });
});

describe("TE-FAIL-01 failed receipt and post-rollback persistence", () => {
  it("builds a failed receipt with a truncated message and a delivery failure only for outbound", () => {
    const now = new Date("2026-10-31T18:00:00.000Z");
    const outbound = receipt.buildAgentActionFailedReceipt("outbound", new Error("x".repeat(900)), now);
    expect(outbound).toMatchObject({ outcome: "failed", deliveryState: "failed", error: { code: "EXECUTION_FAILED" }, failedAt: now.toISOString() });
    expect(outbound.error.message).toBe(receipt.AGENT_ACTION_GENERIC_FAILURE_MESSAGE);
    const internal = receipt.buildAgentActionFailedReceipt("internal", new types.AppError(types.ErrorCode.CONFLICT, "gone"), now);
    expect(internal).not.toHaveProperty("deliveryState");
    expect(internal.error).toEqual({ code: String(types.ErrorCode.CONFLICT), message: "gone" });
  });

  it("never stores raw non-AppError text in the receipt (generic message), but keeps AppError code + message", () => {
    const raw = receipt.buildAgentActionFailedReceipt("internal", new Error("ECONNREFUSED 10.0.0.5:5432 password=hunter2"));
    expect(raw.error).toEqual({ code: "EXECUTION_FAILED", message: receipt.AGENT_ACTION_GENERIC_FAILURE_MESSAGE });
    expect(JSON.stringify(raw)).not.toContain("hunter2");
    const thrownString = receipt.buildAgentActionFailedReceipt("internal", "boom");
    expect(thrownString.error.message).toBe(receipt.AGENT_ACTION_GENERIC_FAILURE_MESSAGE);
    const app = receipt.buildAgentActionFailedReceipt("internal", new types.AppError(types.ErrorCode.FORBIDDEN, "y".repeat(900)));
    expect(app.error.code).toBe(String(types.ErrorCode.FORBIDDEN));
    expect(app.error.message).toHaveLength(500);
  });

  function seed(companyId: string, state: string, actionType = "message.send_proposed") {
    return fakeDb.seedAgentAction({
      companyId,
      agentProduct: "revenue",
      actionType,
      requiresApproval: true,
      state,
      parameters: {},
      target: { entityType: "job", entityId: "00000000-0000-4000-8000-000000000001", recordVersion: "rv1:1", source: { channel: "web" } }
    } as never) as { id: string };
  }
  const row = (id: string) => fakeDb.getTestState().agentActions.find((r) => r.id === id)!;

  it("persists failed + receipt + execution_failed audit for an action left approved by the rollback", async () => {
    const company = fakeDb.seedCompany({ name: "TE fail", slug: "te-fail" });
    const action = seed(company.id, "approved");
    const updated = await receipt.persistAgentActionExecutionFailure({ companyId: company.id, actionId: action.id, actorId: "u1", actorType: "user", error: new Error("provider adapter unavailable") });
    expect(updated?.state).toBe("failed");
    expect(row(action.id).state).toBe("failed");
    expect(row(action.id).executionReceipt).toMatchObject({
      outcome: "failed",
      deliveryState: "failed",
      error: { code: "EXECUTION_FAILED", message: receipt.AGENT_ACTION_GENERIC_FAILURE_MESSAGE }
    });
    expect(JSON.stringify(row(action.id).executionReceipt)).not.toContain("provider adapter unavailable");
    const events = fakeDb.getTestState().activityEvents.filter((e) => e.entityId === action.id);
    expect(events.map((e) => e.eventType)).toContain("agent.execution_failed");
    const failed = events.find((e) => e.eventType === "agent.execution_failed")!;
    // Raw error text lives only in the audit event detail.
    expect(JSON.stringify(failed.payload)).toContain("provider adapter unavailable");
  });

  it("records the caller-supplied actorType on the execution_failed audit event (not hardcoded user)", async () => {
    const company = fakeDb.seedCompany({ name: "TE fail ai", slug: "te-fail-ai" });
    const action = seed(company.id, "approved");
    await receipt.persistAgentActionExecutionFailure({ companyId: company.id, actionId: action.id, actorId: "agent-1", actorType: "ai", error: new Error("x") });
    const failed = fakeDb.getTestState().activityEvents.find((e) => e.entityId === action.id && e.eventType === "agent.execution_failed")!;
    expect(failed.actorType).toBe("ai");
    expect(failed.actorId).toBe("agent-1");
  });

  it("writes nothing when the row already moved on (e.g. succeeded) or belongs to another tenant", async () => {
    const company = fakeDb.seedCompany({ name: "TE fail2", slug: "te-fail2" });
    const other = fakeDb.seedCompany({ name: "TE other", slug: "te-other" });
    const done = seed(company.id, "succeeded", "service.job_brief.propose");
    expect(await receipt.persistAgentActionExecutionFailure({ companyId: company.id, actionId: done.id, actorId: "u1", actorType: "user", error: new Error("late") })).toBeNull();
    expect(row(done.id).state).toBe("succeeded");
    const theirs = seed(other.id, "approved");
    expect(await receipt.persistAgentActionExecutionFailure({ companyId: company.id, actionId: theirs.id, actorId: "u1", actorType: "user", error: new Error("x") })).toBeNull();
    expect(row(theirs.id).state).toBe("approved");
    expect(fakeDb.getTestState().activityEvents.filter((e) => e.eventType === "agent.execution_failed")).toHaveLength(0);
  });
});
