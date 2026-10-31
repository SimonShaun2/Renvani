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

  it("returns correct proposal numbers via a bounded lookup with many actions", async () => {
    const company = fakeDb.seedCompany({ name: "Many Co", slug: "many-co" });
    const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
    const base = Date.UTC(2026, 0, 1);
    const mine: Array<{ id: string }> = [];
    for (let i = 0; i < 60; i += 1) {
      mine.push(seedAction(company.id, "succeeded", {}, new Date(base + i * 60_000)));
      seedAction(other.id, "succeeded", {}, new Date(base + i * 60_000 + 1));
    }
    // Same createdAt tie: ordered by id, both still numbered.
    const tieA = seedAction(company.id, "awaiting_approval", {}, new Date(base + 999 * 60_000));
    const tieB = seedAction(company.id, "awaiting_approval", {}, new Date(base + 999 * 60_000));
    const [lo, hi] = [tieA, tieB].sort((a, b) => (a.id < b.id ? -1 : 1));

    const target = mine[41]!;
    const selectSpy = vi.spyOn(fakeDb.db, "select");
    const one = await inbox.loadProposalSequences(company.id, [target.id]);
    expect(one.get(target.id)).toBe(42);

    // Bounded: target lookup + one COUNT + a window, never a full tenant id list.
    expect(selectSpy).toHaveBeenCalledTimes(3);
    expect(selectSpy.mock.calls[1]?.[0]).toEqual({ value: expect.anything() });
    selectSpy.mockRestore();

    const many = await inbox.loadProposalSequences(company.id, [lo!.id, hi!.id, mine[0]!.id]);
    expect(many.get(mine[0]!.id)).toBe(1);
    expect(many.get(lo!.id)).toBe(61);
    expect(many.get(hi!.id)).toBe(62);

    const item = await inbox.getOperatorInboxItem(company.id, target.id);
    expect(item.proposalNumber).toBe("P-0042");
  });

  it("numbers proposals whose created_at has sub-millisecond precision (Postgres microseconds)", async () => {
    // Models a timestamp column with microseconds: comparisons (valueOf) see the fraction, while the
    // value the driver hands back to JS (getTime) is millisecond-truncated.
    class MicroDate extends Date {
      constructor(ms: number, private readonly micros: number) {
        super(ms);
      }
      override valueOf(): number {
        return super.getTime() + this.micros / 1000;
      }
    }
    const company = fakeDb.seedCompany({ name: "Micro Co", slug: "micro-co" });
    const base = Date.UTC(2026, 2, 1);
    const early = seedAction(company.id, "succeeded", {}, new MicroDate(base - 5, 900) as Date);
    const sameMsA = seedAction(company.id, "succeeded", {}, new MicroDate(base, 100) as Date);
    const sameMsB = seedAction(company.id, "awaiting_approval", {}, new MicroDate(base, 600) as Date);
    const later = seedAction(company.id, "awaiting_approval", {}, new MicroDate(base + 3, 999) as Date);
    const ordered = [sameMsA, sameMsB].sort((a, b) => (a.id < b.id ? -1 : 1));

    for (const row of [early, ...ordered, later]) {
      const single = await inbox.loadProposalSequences(company.id, [row.id]);
      expect(single.get(row.id)).toBeDefined();
    }
    const all = await inbox.loadProposalSequences(company.id, [later.id, sameMsB.id, sameMsA.id, early.id]);
    expect(all.get(early.id)).toBe(1);
    expect(all.get(ordered[0]!.id)).toBe(2);
    expect(all.get(ordered[1]!.id)).toBe(3);
    expect(all.get(later.id)).toBe(4);
    // Same-ms rows are numbered in the window (not the prefix), so single lookups agree with batch ones.
    expect((await inbox.loadProposalSequences(company.id, [ordered[1]!.id])).get(ordered[1]!.id)).toBe(3);
    expect((await inbox.loadProposalSequences(company.id, [later.id])).get(later.id)).toBe(4);
  });

  it("never numbers another tenant's proposal", async () => {
    const a = fakeDb.seedCompany({ name: "A Co", slug: "a-co-n" });
    const b = fakeDb.seedCompany({ name: "B Co", slug: "b-co-n" });
    seedAction(a.id, "succeeded", {}, new Date("2026-01-01T00:00:00Z"));
    const foreign = seedAction(b.id, "awaiting_approval", {}, new Date("2026-01-02T00:00:00Z"));
    const seqs = await inbox.loadProposalSequences(a.id, [foreign.id]);
    expect(seqs.size).toBe(0);
    expect((await inbox.loadProposalSequences(b.id, [foreign.id])).get(foreign.id)).toBe(1);
  });
});

describe("escalate audit event (#287 nit)", () => {
  it("emits an agent_action audit event in the escalate transaction, ids only", async () => {
    const company = fakeDb.seedCompany({ name: "Aud Co", slug: "aud-co" });
    const other = fakeDb.seedCompany({ name: "Aud Other", slug: "aud-other" });
    const action = seedAction(company.id, "awaiting_approval");
    await escalation.escalateAgentAction(company.id, action.id, "00000000-0000-4000-8000-0000000000aa", {
      reason: "Customer phone 555-0100 looks wrong"
    });

    const events = fakeDb.getTestState().activityEvents.filter(
      (event) => event.entityType === "agent_action" && event.entityId === action.id
    );
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event).toMatchObject({
      companyId: company.id,
      eventType: "agent.proposal_rejected",
      actorId: "00000000-0000-4000-8000-0000000000aa",
      actorType: "user",
      summary: "Agent proposal escalated"
    });
    expect(event.payload).toMatchObject({
      outcome: "escalated",
      previousState: "awaiting_approval",
      hasReason: true,
      audit: expect.objectContaining({ lifecycle: "proposal_rejected", agentActionId: action.id })
    });
    expect(JSON.stringify(event.payload)).not.toContain("555-0100");
    expect(fakeDb.getTestState().activityEvents.some((e) => e.companyId === other.id)).toBe(false);

    const timeline = await inbox.getOperatorInboxTimeline(company.id, action.id);
    expect(timeline.filter((entry) => entry.kind === "agent.proposal_escalated")).toHaveLength(1);
  });

  it("emits no event when escalation is refused", async () => {
    const company = fakeDb.seedCompany({ name: "Ref Co", slug: "ref-co" });
    const done = seedAction(company.id, "succeeded");
    await expect(escalation.escalateAgentAction(company.id, done.id, "user-1")).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
    expect(fakeDb.getTestState().activityEvents.filter((e) => e.entityId === done.id)).toHaveLength(0);
  });
});
