import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

interface Row {
  id: string;
  clerkUserId: string;
  requestedName: string;
  status: string;
  attemptId?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
}

type Condition = { kind: "eq"; field: keyof Row; value: unknown } | { kind: "null"; field: keyof Row } | { kind: "and"; parts: Condition[] };
function matches(row: Row, condition: Condition): boolean {
  if (condition.kind === "and") return condition.parts.every((part) => matches(row, part));
  if (condition.kind === "null") return row[condition.field] == null;
  return row[condition.field] === condition.value;
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  events: [] as Array<{ intentId: string; clerkUserId: string; eventType: string }>,
  lockTail: Promise.resolve() as Promise<void>
}));

vi.mock("drizzle-orm", () => ({
  sql: () => ({}),
  eq: (field: keyof Row, value: unknown) => ({ kind: "eq", field, value }),
  isNull: (field: keyof Row) => ({ kind: "null", field }),
  and: (...parts: Condition[]) => ({ kind: "and", parts })
}));
vi.mock("@fsm/db", () => {
  const intentTable = { table: "intent", clerkUserId: "clerkUserId", status: "status", attemptId: "attemptId", deletedAt: "deletedAt" };
  const eventTable = { table: "event" };
  const findFirst = async (options: {
    where: (table: { clerkUserId: string }, operators: { eq: (field: string, value: string) => { value: string } }) => { value: string };
  }) => {
    const condition = options.where({ clerkUserId: "clerkUserId" }, { eq: (_field, value) => ({ value }) });
    return state.rows.find((row) => row.clerkUserId === condition.value);
  };
  return {
    clerkWorkspaceIntents: intentTable,
    clerkWorkspaceIntentEvents: eventTable,
    db: {
      query: { clerkWorkspaceIntents: { findFirst } },
      transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
        let release!: () => void;
        const finished = new Promise<void>((resolve) => { release = resolve; });
        const tx = {
          execute: async () => {
            const previous = state.lockTail;
            state.lockTail = previous.then(() => finished);
            await previous;
          },
          query: { clerkWorkspaceIntents: { findFirst } },
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
  getClerkWorkspaceIntent,
  markClerkWorkspaceAttemptUncertain,
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
});
