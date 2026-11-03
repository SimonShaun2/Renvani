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
  lockTail: Promise.resolve() as Promise<void>,
  eventLookups: [] as Array<{ limit: number | undefined; ordered: boolean; bySvixId: boolean }>
}));

vi.mock("drizzle-orm", () => ({
  sql: (_strings: TemplateStringsArray, ...values: unknown[]) => ({ kind: "sql", values }),
  eq: (field: keyof Row, value: unknown) => ({ kind: "eq", field, value }),
  inArray: (field: keyof Row, values: unknown[]) => ({ kind: "in", field, values }),
  isNull: (field: keyof Row) => ({ kind: "null", field }),
  and: (...parts: Condition[]) => ({ kind: "and", parts })
}));
vi.mock("@fsm/db", () => {
  const intentTable = { table: "intent", id: "id", clerkUserId: "clerkUserId", status: "status", attemptId: "attemptId", clerkOrganizationId: "clerkOrganizationId", deletedAt: "deletedAt" };
  const eventTable = { table: "event" };
  const findFirst = async (options: {
    where: (table: typeof intentTable, operators: {
      eq: (field: keyof Row, value: unknown) => Condition;
      isNull: (field: keyof Row) => Condition;
      and: (...parts: Condition[]) => Condition;
    }) => Condition;
  }) => {
    const condition = options.where(intentTable, {
      eq: (field, value) => ({ kind: "eq", field, value }),
      isNull: (field) => ({ kind: "null", field }),
      and: (...parts) => ({ kind: "and", parts })
    });
    return state.rows.find((row) => matches(row, condition));
  };
  type EventCondition = { kind: "eq"; value: unknown } | { kind: "and"; parts: EventCondition[] } | { kind: "sql"; values: unknown[] };
  const eventLookups: Array<{ limit: number | undefined; ordered: boolean; bySvixId: boolean }> = [];
  state.eventLookups = eventLookups;
  const findEvents = async (options: {
    where: (table: { intentId: string; details: string; createdAt: string }, operators: {
      eq: (field: string, value: unknown) => EventCondition;
      and: (...parts: EventCondition[]) => EventCondition;
    }) => EventCondition;
    orderBy?: (table: { createdAt: string }, operators: { desc: (field: string) => unknown }) => unknown[];
    limit?: number;
  }) => {
    const condition = options.where(
      { intentId: "intentId", details: "details", createdAt: "createdAt" },
      { eq: (_field, value) => ({ kind: "eq", value }), and: (...parts) => ({ kind: "and", parts }) }
    );
    const parts = condition.kind === "and" ? condition.parts : [condition];
    const intentId = parts.find((part) => part.kind === "eq")?.value;
    const svix = parts.find((part) => part.kind === "sql");
    const svixId = svix?.kind === "sql" ? svix.values[1] : undefined;
    eventLookups.push({ limit: options.limit, ordered: Boolean(options.orderBy?.({ createdAt: "createdAt" }, { desc: (field) => field }).length), bySvixId: svixId !== undefined });
    return state.events
      .filter((event) => event.intentId === intentId && (svixId === undefined || event.details?.svixId === svixId))
      .slice(0, options.limit ?? Infinity);
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
  deferClerkWorkspaceWebhook,
  getClerkWorkspaceIntent,
  reserveClerkWorkspaceIntent
} from "./clerk-workspace-intent.service.js";

describe("FS-235 Clerk workspace intent", () => {
  beforeEach(() => {
    state.rows.length = 0;
    state.eventLookups.length = 0;
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

  it("rejects an archived intent instead of creating another organization while an old attempt may be in flight", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme Plumbing");
    state.rows[0]!.deletedAt = new Date();
    expect(await getClerkWorkspaceIntent("user_a")).toBeNull();
    await expect(reserveClerkWorkspaceIntent("user_a", "Acme Plumbing"))
      .rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(state.rows).toHaveLength(1);
    expect(state.events).toHaveLength(1);
  });

  it("durably records out-of-order signed deliveries once per message for a known intent", async () => {
    const membership = {
      kind: "organizationMembership.created" as const, svixId: "msg_member", organizationId: "org_a",
      clerkUserId: "user_a", email: "creator@example.com", name: "Acme", firstName: "Ava",
      lastName: "Stone", clerkOrgRole: "org:admin"
    };
    expect(await deferClerkWorkspaceWebhook(membership)).toEqual({ status: "not_applicable" });
    const intent = await reserveClerkWorkspaceIntent("user_a", "Acme");
    const [first, replay] = await Promise.all([
      deferClerkWorkspaceWebhook(membership), deferClerkWorkspaceWebhook(membership)
    ]);
    expect(first).toEqual({ status: "deferred", intentId: intent.id, clerkUserId: "user_a" });
    expect(replay).toEqual({ status: "deferred", intentId: intent.id, clerkUserId: "user_a" });
    const organization = {
      kind: "organization.created" as const, svixId: "msg_org", organizationId: "org_a",
      clerkUserId: "user_a", name: "Acme"
    };
    expect(await deferClerkWorkspaceWebhook(organization))
      .toEqual({ status: "deferred", intentId: intent.id, clerkUserId: "user_a" });
    expect(state.events.filter((event) => event.eventType === "workspace.webhook_deferred"))
      .toEqual([
        expect.objectContaining({
          intentId: intent.id,
          details: expect.objectContaining({
            kind: membership.kind,
            svixId: membership.svixId,
            organizationId: membership.organizationId,
            clerkUserId: membership.clerkUserId
          })
        }),
        expect.objectContaining({
          intentId: intent.id,
          details: expect.objectContaining({
            kind: organization.kind,
            svixId: organization.svixId,
            organizationId: organization.organizationId,
            clerkUserId: organization.clerkUserId
          })
        })
      ]);
    expect(state.eventLookups.length).toBeGreaterThan(0);
    for (const lookup of state.eventLookups) expect(lookup).toEqual({ limit: 10, ordered: true, bySvixId: true });
    expect(state.rows[0]?.status).toBe("pending");
    expect(state.rows[0]?.clerkOrganizationId).toBeNull();
  });

  it("quarantines a foreign organization delivery against the user's intent without binding it", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme");
    expect(await deferClerkWorkspaceWebhook({
      kind: "organizationMembership.created", svixId: "foreign", organizationId: "org_foreign",
      clerkUserId: "user_a"
    })).toEqual({
      status: "deferred",
      intentId: expect.any(String),
      clerkUserId: "user_a"
    });
    expect(state.events.at(-1)?.details).toMatchObject({ organizationId: "org_foreign" });
    expect(state.rows[0]?.clerkOrganizationId).toBeNull();
  });

  it("lets the reconciled organization finish and terminally denies a different organization", async () => {
    await reserveClerkWorkspaceIntent("user_a", "Acme");
    state.rows[0]!.status = "reconciled";
    state.rows[0]!.clerkOrganizationId = "org_a";

    expect(await deferClerkWorkspaceWebhook({
      kind: "organization.created",
      svixId: "ready",
      organizationId: "org_a",
      clerkUserId: "user_a"
    })).toEqual({ status: "ready" });
    expect(await deferClerkWorkspaceWebhook({
      kind: "organization.created",
      svixId: "foreign",
      organizationId: "org_foreign",
      clerkUserId: "user_a"
    })).toEqual({ status: "denied", reason: "organization_mismatch" });
    expect(state.events.filter((event) => event.eventType === "workspace.webhook_denied"))
      .toHaveLength(1);
  });
});
