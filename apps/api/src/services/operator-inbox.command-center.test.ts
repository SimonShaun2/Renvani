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

vi.mock("@fsm/ai/langfuse", () => ({
  recordAgentAuditObservation: vi.fn(async () => undefined)
}));

let inbox: typeof import("./operator-inbox.service.js");
let escalation: typeof import("./agent-action-escalation.service.js");
let mapper: typeof import("./operator-inbox.mapper.js");
let fakeDb: typeof import("../test-support/fake-db.js");

beforeAll(async () => {
  await import("./revenue-agent/revenue-proposal.kinds.js");
  inbox = await import("./operator-inbox.service.js");
  escalation = await import("./agent-action-escalation.service.js");
  mapper = await import("./operator-inbox.mapper.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
});

let seq = 0;
function seedAction(companyId: string, state: string, parameters: Record<string, unknown> = {}, createdAt?: Date) {
  seq += 1;
  const record = fakeDb.seedAgentAction({
    companyId,
    agentProduct: "scheduling",
    actionType: "scheduling.booking.self_service",
    idempotencyKey: `idem-cc-${seq}`,
    payloadHash: "hash-x",
    policyVersion: AGENT_POLICY_V1,
    requiresApproval: true,
    state,
    parameters,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    target: { entityType: "job", entityId: "00000000-0000-4000-8000-000000000001", recordVersion: "rv1:1", source: { channel: "web" } }
  } as never);
  if (createdAt) {
    Object.assign(record as object, { createdAt, updatedAt: createdAt });
  }
  return record as { id: string; updatedAt: Date };
}

const stored = (id: string) => fakeDb.getTestState().agentActions.find((row) => row.id === id);

describe("POST /agent-actions/:id/escalate (service)", () => {
  it("moves a pending proposal to escalated with the reason on the receipt", async () => {
    const company = fakeDb.seedCompany({ name: "Esc Co", slug: "esc-co" });
    const action = seedAction(company.id, "awaiting_approval");

    const result = await escalation.escalateAgentAction(company.id, action.id, "user-1", {
      reason: "Needs owner sign-off",
      expectedVersion: escalation.agentActionRowVersion(action)
    });

    expect(result.state).toBe("escalated");
    expect(result.executionReceipt).toMatchObject({ outcome: "escalated", escalatedBy: "user-1", reason: "Needs owner sign-off" });
  });

  it("returns 409 on a stale expectedVersion and leaves state untouched", async () => {
    const company = fakeDb.seedCompany({ name: "Esc Stale", slug: "esc-stale" });
    const action = seedAction(company.id, "awaiting_approval");

    await expect(
      escalation.escalateAgentAction(company.id, action.id, "user-1", { expectedVersion: 1 })
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(stored(action.id)?.state).toBe("awaiting_approval");
  });

  it("refuses terminal states and other tenants", async () => {
    const a = fakeDb.seedCompany({ name: "Esc A", slug: "esc-a" });
    const b = fakeDb.seedCompany({ name: "Esc B", slug: "esc-b" });
    const done = seedAction(a.id, "succeeded");
    const pending = seedAction(a.id, "approved");

    await expect(escalation.escalateAgentAction(a.id, done.id, "user-1")).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    await expect(escalation.escalateAgentAction(b.id, pending.id, "user-1")).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(stored(pending.id)?.state).toBe("approved");
  });
});

describe("operator inbox command-center fields", () => {
  it("counts every state, zero-filled, scoped to the tenant", async () => {
    const a = fakeDb.seedCompany({ name: "Cnt A", slug: "cnt-a" });
    const b = fakeDb.seedCompany({ name: "Cnt B", slug: "cnt-b" });
    seedAction(a.id, "awaiting_approval");
    seedAction(a.id, "awaiting_approval");
    seedAction(a.id, "executing");
    seedAction(b.id, "awaiting_approval");

    const result = await inbox.countOperatorInbox(a.id);

    expect(result.total).toBe(3);
    expect(result.counts).toMatchObject({ awaiting_approval: 2, executing: 1, escalated: 0, succeeded: 0 });
  });

  it("assigns tenant-sequential proposal numbers, versions, prices and the escalate path", async () => {
    const company = fakeDb.seedCompany({ name: "Num Co", slug: "num-co" });
    const first = seedAction(company.id, "succeeded", {}, new Date("2026-01-01T00:00:00Z"));
    const second = seedAction(company.id, "awaiting_approval", { estimatedRevenue: 1250, discount: "10%", serviceArea: "in_area" }, new Date("2026-01-02T00:00:00Z"));
    fakeDb.seedActivityEvent({
      companyId: company.id,
      eventType: "agent.proposal_edited",
      entityType: "agent_action",
      entityId: second.id,
      summary: "Agent proposal edited"
    } as never);

    const items = await inbox.listOperatorInbox(company.id, {});
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(byId.get(first.id)?.proposalNumber).toBe("P-0001");
    const item = byId.get(second.id)!;
    expect(item.proposalNumber).toBe("P-0002");
    expect(item.proposalVersion).toBe(2);
    expect(item.version).toBe(second.updatedAt.getTime());
    expect(item.pricing).toEqual({ amount: "1250", priceRule: null, discount: "10%" });
    expect(item.checks).toEqual({ serviceArea: "in_area", optIn: null });
    expect(item.overridePaths).toContain("escalate");
    expect(byId.get(first.id)?.overridePaths).toEqual([]);
  });

  it("builds an ordered audit timeline including the escalation", async () => {
    const company = fakeDb.seedCompany({ name: "Tl Co", slug: "tl-co" });
    const action = seedAction(company.id, "awaiting_approval");
    fakeDb.seedActivityEvent({
      companyId: company.id,
      eventType: "agent.proposal_created",
      entityType: "agent_action",
      entityId: action.id,
      actorType: "ai",
      summary: "Agent proposal created",
      occurredAt: new Date("2026-01-01T00:00:00Z")
    } as never);
    await escalation.escalateAgentAction(company.id, action.id, "user-1", { reason: "Price looks off" });

    const timeline = await inbox.getOperatorInboxTimeline(company.id, action.id);

    expect(timeline.map((entry) => entry.kind)).toEqual(["agent.proposal_created", "agent.proposal_escalated"]);
    expect(timeline[1]).toMatchObject({ actorId: "user-1", summary: "Escalated: Price looks off" });
  });

  it("formats proposal numbers", () => {
    expect(mapper.formatProposalNumber(7)).toBe("P-0007");
    expect(mapper.formatProposalNumber(12345)).toBe("P-12345");
  });
});
