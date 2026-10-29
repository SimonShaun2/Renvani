import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

interface Row {
  id: string;
  clerkUserId: string;
  requestedName: string;
  status: string;
  createdAt: Date;
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  events: [] as Array<{ intentId: string; clerkUserId: string; eventType: string }>,
  lockTail: Promise.resolve() as Promise<void>
}));

vi.mock("drizzle-orm", () => ({ sql: () => ({}) }));
vi.mock("@fsm/db", () => {
  const intentTable = { table: "intent" };
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

import { getClerkWorkspaceIntent, reserveClerkWorkspaceIntent } from "./clerk-workspace-intent.service.js";

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
    expect(state.events[0]?.eventType).toBe("workspace.intent_reserved");
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
});
