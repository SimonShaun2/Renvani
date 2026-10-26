import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string };
type Cond =
  | { op: "eq"; field: string; value: unknown }
  | { op: "isNull"; field: string }
  | { op: "and"; parts: Cond[] };

const state = vi.hoisted(() => ({
  users: [] as Row[],
  tokens: [] as Row[],
  companies: {} as Record<string, string | "AMBIGUOUS">,
  failUpdateUnique: false,
  raceOnLink: null as string | null
}));

function matches(row: Row, c: Cond): boolean {
  if (c.op === "and") return c.parts.every((p) => matches(row, p));
  if (c.op === "isNull") return row[c.field] == null;
  return row[c.field] === c.value;
}

vi.mock("drizzle-orm", () => ({
  eq: (field: string, value: unknown) => ({ op: "eq", field, value }),
  isNull: (field: string) => ({ op: "isNull", field }),
  and: (...parts: unknown[]) => ({ op: "and", parts })
}));

vi.mock("./clerk-tenant.service.js", () => {
  class ClerkOrganizationAmbiguousError extends Error {}
  return {
    ClerkOrganizationAmbiguousError,
    findCompanyByClerkOrganizationId: vi.fn(async (orgId: string) => {
      const id = state.companies[orgId];
      if (id === "AMBIGUOUS") throw new ClerkOrganizationAmbiguousError("ambiguous");
      return id ? { id } : null;
    })
  };
});

vi.mock("@fsm/db", () => {
  const cols = ["id", "email", "companyId", "clerkUserId", "deletedAt", "isActive", "userId", "revokedAt"];
  const t = Object.fromEntries(cols.map((c) => [c, c]));
  const users = { ...t, __name: "users" };
  const refreshTokens = { ...t, __name: "refresh_tokens" };
  const ops = {
    eq: (field: string, value: unknown) => ({ op: "eq", field, value }),
    isNull: (field: string) => ({ op: "isNull", field }),
    and: (...parts: Cond[]) => ({ op: "and", parts })
  };
  const tx = {
    update: (table: { __name: string }) => ({
      set: (values: Record<string, unknown>) => ({
        where: async (cond: Cond) => {
          const rows = table.__name === "users" ? state.users : state.tokens;
          if (table.__name === "users" && state.failUpdateUnique) {
            throw Object.assign(new Error("dup"), { cause: { code: "23505" } });
          }
          if (table.__name === "users" && state.raceOnLink && "clerkUserId" in values) {
            for (const r of rows.filter((row) => matches(row, cond))) r.clerkUserId = state.raceOnLink;
          }
          for (const r of rows.filter((row) => matches(row, cond))) Object.assign(r, values);
        }
      })
    }),
    query: {
      users: {
        findFirst: async (opts: { where: (t: unknown, o: unknown) => Cond }) => {
          const cond = opts.where(t, ops);
          return state.users.find((u) => matches(u, cond));
        }
      }
    }
  };
  return { users, refreshTokens, db: { transaction: async <T>(fn: (t: unknown) => Promise<T>) => fn(tx) } };
});

const svc = await import("./clerk-user-sync.service.js");

function user(over: Partial<Row> & { id: string }): Row {
  return { email: `${over.id}@x.com`, companyId: "co_1", clerkUserId: null, deletedAt: null, isActive: true, ...over };
}

beforeEach(() => {
  state.users = [];
  state.tokens = [];
  state.companies = { org_1: "co_1", org_2: "co_2" };
  state.failUpdateUnique = false;
  state.raceOnLink = null;
});

describe("readVerifiedPrimaryEmail", () => {
  const data = (status: string) => ({
    primary_email_address_id: "e1",
    email_addresses: [{ id: "e1", email_address: " A@X.com ", verification: { status } }]
  });
  it("returns the normalized primary email only when verified", () => {
    expect(svc.readVerifiedPrimaryEmail(data("verified"))).toBe("a@x.com");
    expect(svc.readVerifiedPrimaryEmail(data("unverified"))).toBeNull();
    expect(svc.readVerifiedPrimaryEmail({ email_addresses: [] })).toBeNull();
  });
});

describe("syncClerkUserUpdated", () => {
  it("syncs a verified email change to the linked user", async () => {
    state.users.push(user({ id: "u1", clerkUserId: "ck_1" }));
    expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: "new@x.com" })).toEqual({ status: "updated" });
    expect(state.users[0]?.email).toBe("new@x.com");
  });

  it("does not change the email when Clerk does not mark it verified", async () => {
    state.users.push(user({ id: "u1", clerkUserId: "ck_1" }));
    expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: null })).toEqual({ status: "unchanged" });
    expect(state.users[0]?.email).toBe("u1@x.com");
  });

  it("skips when the email belongs to another user (any company, incl. soft-deleted)", async () => {
    state.users.push(user({ id: "u1", clerkUserId: "ck_1" }), user({ id: "u2", companyId: "co_2", deletedAt: new Date() }));
    expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: "u2@x.com" })).toEqual({ status: "skipped" });
    expect(state.users[0]?.email).toBe("u1@x.com");
  });

  it("returns skipped (no throw) on a unique violation", async () => {
    state.users.push(user({ id: "u1", clerkUserId: "ck_1" }));
    state.failUpdateUnique = true;
    await expect(svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: "n@x.com" })).resolves.toEqual({ status: "skipped" });
  });

  it("is a no-op for an unknown Clerk id with no matching email", async () => {
    state.users.push(user({ id: "u1" }));
    expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_9", verifiedPrimaryEmail: "nobody@x.com" })).toEqual({ status: "not_found" });
    expect(state.users[0]?.clerkUserId).toBeNull();
  });

  it("links an unlinked active user by verified email", async () => {
    state.users.push(user({ id: "u1" }));
    expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: "u1@x.com" })).toEqual({ status: "linked" });
    expect(state.users[0]?.clerkUserId).toBe("ck_1");
  });

  it("never links soft-deleted, inactive or already-linked users", async () => {
    state.users.push(
      user({ id: "a", deletedAt: new Date() }),
      user({ id: "b", isActive: false }),
      user({ id: "c", clerkUserId: "ck_other" })
    );
    for (const id of ["a", "b", "c"]) {
      expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: `${id}@x.com` })).toEqual({ status: "skipped" });
    }
    expect(state.users.map((u) => u.clerkUserId)).toEqual([null, null, "ck_other"]);
  });

  it("does not report linked when the link race is lost", async () => {
    state.users.push(user({ id: "u1" }));
    state.raceOnLink = "ck_other";
    expect(await svc.syncClerkUserUpdated({ clerkUserId: "ck_1", verifiedPrimaryEmail: "u1@x.com" })).toEqual({ status: "skipped" });
  });
});

describe("deactivateClerkUser", () => {
  it("deactivates, unlinks and revokes refresh tokens; redelivery is a no-op; other users untouched", async () => {
    state.users.push(user({ id: "u1", clerkUserId: "ck_1" }), user({ id: "u2", companyId: "co_2", clerkUserId: "ck_2" }));
    state.tokens.push({ id: "t1", userId: "u1", revokedAt: null }, { id: "t2", userId: "u2", revokedAt: null });
    expect(await svc.deactivateClerkUser("ck_1")).toEqual({ status: "deactivated" });
    expect(state.users[0]).toMatchObject({ isActive: false, clerkUserId: null });
    expect(state.tokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(await svc.deactivateClerkUser("ck_1")).toEqual({ status: "not_found" });
    expect(state.users[1]).toMatchObject({ isActive: true, clerkUserId: "ck_2" });
    expect(state.tokens[1]?.revokedAt).toBeNull();
    expect(state.users).toHaveLength(2);
  });
});

describe("deactivateClerkMembership", () => {
  it("deactivates only within the org's company (cross-company isolation) and is idempotent", async () => {
    state.users.push(user({ id: "u1", clerkUserId: "ck_1" }));
    state.tokens.push({ id: "t1", userId: "u1", revokedAt: null });
    expect(await svc.deactivateClerkMembership("org_2", "ck_1")).toEqual({ status: "not_found" });
    expect(state.users[0]?.isActive).toBe(true);
    expect(await svc.deactivateClerkMembership("org_1", "ck_1")).toEqual({ status: "deactivated" });
    expect(state.users[0]).toMatchObject({ isActive: false, clerkUserId: "ck_1" });
    expect(state.tokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(await svc.deactivateClerkMembership("org_1", "ck_1")).toEqual({ status: "deactivated" });
  });

  it("skips an ambiguous org without throwing", async () => {
    state.companies.org_1 = "AMBIGUOUS";
    await expect(svc.deactivateClerkMembership("org_1", "ck_1")).resolves.toEqual({ status: "skipped" });
  });
});
