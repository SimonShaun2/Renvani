import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

interface Row {
  id: string;
  clerkUserId: string;
  requestedName: string;
  status: string;
  attemptId: string | null;
  clerkOrganizationId: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
}

type Condition = { kind: "eq"; field: keyof Row; value: unknown } | { kind: "null"; field: keyof Row } | { kind: "in"; field: keyof Row; values: unknown[] } | { kind: "and"; parts: Condition[] };
function matches(row: Row, condition: Condition): boolean {
  if (condition.kind === "and") return condition.parts.every((part) => matches(row, part));
  if (condition.kind === "null") return row[condition.field] == null;
  if (condition.kind === "in") return condition.values.includes(row[condition.field]);
  return row[condition.field] === condition.value;
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  events: [] as Array<{ intentId: string; clerkUserId: string; eventType: string; details?: Record<string, unknown> }>,
  lockTail: Promise.resolve() as Promise<void>
}));

vi.mock("drizzle-orm", () => ({
  sql: () => ({}),
  eq: (field: keyof Row, value: unknown) => ({ kind: "eq", field, value }),
  inArray: (field: keyof Row, values: unknown[]) => ({ kind: "in", field, values }),
  isNull: (field: keyof Row) => ({ kind: "null", field }),
  and: (...parts: Condition[]) => ({ kind: "and", parts })
}));
vi.mock("@fsm/db", () => {
  const intentTable = { table: "intent", id: "id", clerkUserId: "clerkUserId", status: "status", attemptId: "attemptId", clerkOrganizationId: "clerkOrganizationId", deletedAt: "deletedAt" };
  const eventTable = { table: "event" };
  const findFirst = async (options: {
    where: (table: { clerkUserId: string }, operators: { eq: (field: string, value: string) => { value: string } }) => { value: string };
  }) => {
    const condition = options.where({ clerkUserId: "clerkUserId" }, { eq: (_field, value) => ({ value }) });
    return state.rows.find((row) => row.clerkUserId === condition.value);
  };
  const findEvents = async (options: {
    where: (table: { intentId: string }, operators: { eq: (field: string, value: string) => { value: string } }) => { value: string };
  }) => {
    const condition = options.where({ intentId: "intentId" }, { eq: (_field, value) => ({ value }) });
    return state.events.filter((event) => event.intentId === condition.value);
  };
  return {
    clerkWorkspaceIntents: intentTable,
    clerkWorkspaceIntentEvents: eventTable,
    db: {
      query: { clerkWorkspaceIntents: { findFirst }, clerkWorkspaceIntentEvents: { findMany: findEvents } },
      transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
        let release!: () => void;
        const finished = new Promise<void>((resolve) => { release = resolve; });
        const tx = {
          execute: async () => {
            const previous = state.lockTail;
            state.lockTail = previous.then(() => finished);
            await previous;
          },
          query: { clerkWorkspaceIntents: { findFirst }, clerkWorkspaceIntentEvents: { findMany: findEvents } },
          update: (table: unknown) => ({
            set: (values: Partial<Row>) => ({
              where: (condition: Condition) => ({
                returning: async () => {
                  if (table !== intentTable) throw new Error("Unexpected update table");
                  const row = state.rows.find((candidate) => matches(candidate, condition));
                  if (!row) return [];
                  Object.assign(row, values);
                  return [row];
                }
              })
            })
          }),
          insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => {
              if (table === eventTable) {
                state.events.push(values as unknown as (typeof state.events)[number]);
                return Promise.resolve();
              }
              if (table !== intentTable) throw new Error("Unexpected table");
              const row: Row = {
                id: `00000000-0000-4000-8000-${String(state.rows.length + 1).padStart(12, "0")}`,
                clerkUserId: String(values.clerkUserId),
                requestedName: String(values.requestedName),
                status: String(values.status),
                attemptId: null,
                clerkOrganizationId: null,
                createdAt: new Date("2026-10-28T12:00:00.000Z")
              };
              state.rows.push(row);
              return { returning: async () => [row] };
            }
          })
        };
        try { return await run(tx); } finally { release(); }
      }
    }
  };
});

import {
  claimClerkWorkspaceCreateAttempt,
  deferClerkWorkspaceWebhook,
  evaluateClerkWorkspaceCreatorProvisioning,
  getClerkWorkspaceIntent,
  markClerkWorkspaceAttemptUncertain,
  matchesClerkWorkspaceIntent,
  type ObservedClerkWorkspaceOrganization,
  reconcileObservedClerkWorkspaceOrganization,
  reserveClerkWorkspaceIntent
} from "./clerk-workspace-intent.service.js";

describe("FS-235 Clerk workspace intent", () => {
  beforeEach(() => {
    state.rows.length = 0;
    state.events.length = 0;
    state.lockTail = Promise.resolve();
  });

  it("serializes two requests for one user to one durable intent and one audit event", async () => {
    const [a, b] = await Promise.all([
      reserveClerkWorkspaceIntent("user_a", "Acme Plumbing"),
      reserveClerkWorkspaceIntent("user_a", "Acme Plumbing")
    ]);
    expect(a).toEqual(b);
    expect(state.rows).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.eventType).toBe("workspace.intent_pending");
  });

  it("does not expose another user's intent or coalesce users by company name", async () => {
    const a = await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    expect(await getClerkWorkspaceIntent("user_b")).toBeNull();
    const b = await reserveClerkWorkspaceIntent("user_b", "Acme Plumbing");
    expect(a.id).not.toBe(b.id);
    expect(state.rows).toHaveLength(2);
  });

  it("rejects a changed name after the reservation is committed", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    await expect(reserveClerkWorkspaceIntent("user_a", "Other Co"))
      .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(state.rows[0]?.requestedName).toBe("Acme Plumbing");
    expect(state.events).toHaveLength(1);
  });

  it("allows exactly one of two concurrent workers to claim the outbound attempt", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const [first, second] = await Promise.all([
      claimClerkWorkspaceCreateAttempt("user_a"),
      claimClerkWorkspaceCreateAttempt("user_a")
    ]);
    expect([first.newlyClaimed, second.newlyClaimed].sort()).toEqual([false, true]);
    expect(state.rows[0]?.status).toBe("claimed");
    expect(state.events.map((event) => event.eventType)).toEqual([
      "workspace.intent_pending", "workspace.attempt_claimed"
    ]);
  });

  it("does not reissue authorization after a crash or an uncertain outcome", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const first = await claimClerkWorkspaceCreateAttempt("user_a");
    expect(first.newlyClaimed).toBe(true);
    if (!first.newlyClaimed) throw new Error("Claim expected");
    expect(await claimClerkWorkspaceCreateAttempt("user_a")).toEqual({ newlyClaimed: false, status: "claimed" });
    expect(await markClerkWorkspaceAttemptUncertain("user_a", first.attemptId)).toBe(true);
    expect(await markClerkWorkspaceAttemptUncertain("user_a", first.attemptId)).toBe(false);
    expect(await claimClerkWorkspaceCreateAttempt("user_a")).toEqual({ newlyClaimed: false, status: "uncertain" });
    expect(state.events.map((event) => event.eventType)).toEqual([
      "workspace.intent_pending", "workspace.attempt_claimed", "workspace.attempt_uncertain"
    ]);
  });

  it("rejects stale or cross-user attempt markers", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const first = await claimClerkWorkspaceCreateAttempt("user_a");
    if (!first.newlyClaimed) throw new Error("Claim expected");
    await expect(markClerkWorkspaceAttemptUncertain("user_b", first.attemptId))
      .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    await expect(markClerkWorkspaceAttemptUncertain("user_a", "00000000-0000-4000-8000-000000000099"))
      .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(state.rows[0]?.status).toBe("claimed");
  });

  it("rejects a missing or mismatched Backend API creator and private marker", async () => {
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const claim = await claimClerkWorkspaceCreateAttempt("user_a");
    if (!claim.newlyClaimed) throw new Error("Claim expected");
    const observed = {
      id: "org_a",
      createdBy: "user_a",
      privateMetadata: { renvaniIntentId: intent.id, renvaniAttemptId: claim.attemptId }
    };
    expect(matchesClerkWorkspaceIntent(state.rows[0]!, observed)).toBe(true);
    for (const changed of [
      { ...observed, createdBy: "user_b" },
      { ...observed, createdBy: null },
      { ...observed, privateMetadata: { ...observed.privateMetadata, renvaniAttemptId: "wrong" } },
      { ...observed, privateMetadata: null }
    ]) {
      await expect(reconcileObservedClerkWorkspaceOrganization("user_a", changed))
        .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    }
    expect(state.rows[0]?.status).toBe("claimed");
    expect(state.events).toHaveLength(2);
  });

  it("recovers an uncertain outcome only from matching backend creator and marker", async () => {
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const claim = await claimClerkWorkspaceCreateAttempt("user_a");
    if (!claim.newlyClaimed) throw new Error("Claim expected");
    await markClerkWorkspaceAttemptUncertain("user_a", claim.attemptId);
    const observed = {
      id: "org_a",
      createdBy: "user_a",
      privateMetadata: { renvaniIntentId: intent.id, renvaniAttemptId: claim.attemptId }
    };
    expect(await reconcileObservedClerkWorkspaceOrganization("user_a", observed)).toBe(true);
    expect(await reconcileObservedClerkWorkspaceOrganization("user_a", observed)).toBe(false);
    expect(await claimClerkWorkspaceCreateAttempt("user_a")).toEqual({ newlyClaimed: false, status: "reconciled" });
    expect(state.rows[0]?.clerkOrganizationId).toBe("org_a");
    expect(state.events.map((event) => event.eventType)).toEqual([
      "workspace.intent_pending", "workspace.attempt_claimed", "workspace.attempt_uncertain", "workspace.organization_reconciled"
    ]);
  });

  it("quarantines a second org observation instead of silently choosing it", async () => {
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const claim = await claimClerkWorkspaceCreateAttempt("user_a");
    if (!claim.newlyClaimed) throw new Error("Claim expected");
    const base = { createdBy: "user_a", privateMetadata: { renvaniIntentId: intent.id, renvaniAttemptId: claim.attemptId } };
    expect(await reconcileObservedClerkWorkspaceOrganization("user_a", { ...base, id: "org_a" })).toBe(true);
    await expect(reconcileObservedClerkWorkspaceOrganization("user_a", { ...base, id: "org_b" }))
      .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(state.rows[0]?.clerkOrganizationId).toBe("org_a");
  });

  it("defers membership-first and organization-first delivery until verified reconciliation and creator membership", async () => {
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const claim = await claimClerkWorkspaceCreateAttempt("user_a");
    if (!claim.newlyClaimed) throw new Error("Claim expected");
    const observed = {
      id: "org_a",
      createdBy: "user_a",
      privateMetadata: { renvaniIntentId: intent.id, renvaniAttemptId: claim.attemptId }
    };
    const creatorMembership = { organizationId: "org_a", clerkUserId: "user_a" };
    const decide = (organization: typeof observed | null, membership: typeof creatorMembership | null) =>
      evaluateClerkWorkspaceCreatorProvisioning(state.rows[0]!, organization, membership);

    expect(decide(null, creatorMembership)).toEqual({ status: "defer", reason: "organization_unobserved" });
    expect(decide(observed, creatorMembership)).toEqual({ status: "defer", reason: "intent_not_reconciled" });
    await reconcileObservedClerkWorkspaceOrganization("user_a", observed);
    expect(decide(observed, null)).toEqual({ status: "defer", reason: "creator_membership_unobserved" });
    const allowed = { status: "allow", organizationId: "org_a", clerkUserId: "user_a" };
    expect(decide(observed, creatorMembership)).toEqual(allowed);
    expect(decide(observed, creatorMembership)).toEqual(allowed);
    expect(state.events.filter((event) => event.eventType === "workspace.organization_reconciled")).toHaveLength(1);
  });

  it("denies company and owner eligibility when verified organization or membership differs", async () => {
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    const claim = await claimClerkWorkspaceCreateAttempt("user_a");
    if (!claim.newlyClaimed) throw new Error("Claim expected");
    const observed = {
      id: "org_a",
      createdBy: "user_a",
      privateMetadata: { renvaniIntentId: intent.id, renvaniAttemptId: claim.attemptId }
    };
    await reconcileObservedClerkWorkspaceOrganization("user_a", observed);
    const decide = (organization: ObservedClerkWorkspaceOrganization, organizationId: string, clerkUserId: string) =>
      evaluateClerkWorkspaceCreatorProvisioning(state.rows[0]!, organization, { organizationId, clerkUserId });

    expect(decide({ ...observed, createdBy: "user_b" }, "org_a", "user_a"))
      .toEqual({ status: "deny", reason: "organization_mismatch" });
    expect(decide({ ...observed, privateMetadata: null }, "org_a", "user_a"))
      .toEqual({ status: "deny", reason: "organization_mismatch" });
    expect(decide({ ...observed, id: "org_b" }, "org_b", "user_a"))
      .toEqual({ status: "deny", reason: "organization_mismatch" });
    expect(decide(observed, "org_b", "user_a"))
      .toEqual({ status: "deny", reason: "membership_mismatch" });
    expect(decide(observed, "org_a", "user_b"))
      .toEqual({ status: "deny", reason: "membership_mismatch" });
    expect(state.events.filter((event) => event.eventType === "workspace.organization_reconciled")).toHaveLength(1);
  });

  it("durably records out-of-order signed deliveries once per message for a known intent", async () => {
    const membership = {
      kind: "organizationMembership.created" as const, svixId: "msg_member", organizationId: "org_a",
      clerkUserId: "user_a", email: "creator@example.com", name: "Acme", firstName: "Ava",
      lastName: "Stone", clerkOrgRole: "org:admin"
    };
    expect(await deferClerkWorkspaceWebhook(membership)).toBe(false);
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme");
    const [first, replay] = await Promise.all([
      deferClerkWorkspaceWebhook(membership), deferClerkWorkspaceWebhook(membership)
    ]);
    expect([first, replay]).toEqual([true, true]);
    const organization = {
      kind: "organization.created" as const, svixId: "msg_org", organizationId: "org_a",
      clerkUserId: "user_a", name: "Acme"
    };
    expect(await deferClerkWorkspaceWebhook(organization)).toBe(true);
    expect(state.events.filter((event) => event.eventType === "workspace.webhook_deferred"))
      .toEqual([
        expect.objectContaining({ intentId: intent.id, details: membership }),
        expect.objectContaining({ intentId: intent.id, details: organization })
      ]);
    expect(state.rows[0]?.status).toBe("pending");
    expect(state.rows[0]?.clerkOrganizationId).toBeNull();
  });

  it("quarantines a foreign organization delivery against the user's intent without binding it", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme");
    expect(await deferClerkWorkspaceWebhook({
      kind: "organizationMembership.created", svixId: "foreign", organizationId: "org_foreign",
      clerkUserId: "user_a", email: "creator@example.com"
    })).toBe(true);
    expect(state.events.at(-1)?.details).toMatchObject({ organizationId: "org_foreign" });
    expect(state.rows[0]?.clerkOrganizationId).toBeNull();
  });
});
