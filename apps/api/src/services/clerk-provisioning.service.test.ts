import { beforeEach, describe, expect, it, vi } from "vitest";

type Company = { id: string; settings: { clerk: { organizationId: string } } };
type User = { id?: string; companyId: string; email: string; role: string; clerkUserId?: string | null; deletedAt?: Date | null; clerkUnlinkedAt?: Date | null };

const state = vi.hoisted(() => ({
  companies: [] as Company[],
  users: [] as User[],
  lockCalls: 0,
  lockTail: Promise.resolve() as Promise<void>,
  ambiguous: false,
  failInsertUnique: false,
  raceOnUpdate: null as string | null
}));

type Cond = { op: "eq"; field: keyof User; value: unknown } | { op: "isNull"; field: keyof User } | { op: "and"; parts: Cond[] };
vi.mock("drizzle-orm", () => ({
  sql: (..._args: unknown[]) => ({ kind: "sql" }),
  eq: (field: string, value: unknown) => ({ op: "eq", field, value }),
  isNull: (field: string) => ({ op: "isNull", field }),
  and: (...parts: unknown[]) => ({ op: "and", parts })
}));
function matches(u: User, c: Cond): boolean {
  if (c.op === "and") return c.parts.every((p) => matches(u, p));
  if (c.op === "isNull") return u[c.field] == null;
  return u[c.field] === c.value;
}

vi.mock("./auth.service.js", () => ({ generateUniqueCompanySlug: vi.fn(async (name: string) => name.toLowerCase()) }));

vi.mock("./clerk-tenant.service.js", () => {
  class ClerkOrganizationAmbiguousError extends Error {}
  return {
    ClerkOrganizationAmbiguousError,
    findCompanyByClerkOrganizationId: vi.fn(async (orgId: string) => {
      await new Promise((resolve) => setImmediate(resolve)); // widen the race window
      if (state.ambiguous) throw new ClerkOrganizationAmbiguousError("ambiguous");
      return state.companies.find((c) => c.settings.clerk.organizationId === orgId) ?? null;
    })
  };
});

vi.mock("@fsm/db", () => {
  const companiesTable = { name: "companies" };
  const usersTable = { name: "users", id: "id", clerkUserId: "clerkUserId", email: "email", companyId: "companyId", deletedAt: "deletedAt", clerkUnlinkedAt: "clerkUnlinkedAt" };
  const makeTx = (onLock: (release: Promise<void>) => void, release: Promise<void>) => ({
    execute: vi.fn(async () => {
      state.lockCalls += 1;
      onLock(release);
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === companiesTable) {
          const company = { id: `co_${state.companies.length + 1}`, ...(values as object) } as Company;
          state.companies.push(company);
          return { returning: async () => [company] };
        }
        if (state.failInsertUnique) {
          return Promise.reject(Object.assign(new Error("duplicate key"), { cause: { code: "23505" } }));
        }
        state.users.push({ id: `u_${state.users.length + 1}`, clerkUserId: null, ...(values as object) } as User);
        return Promise.resolve();
      }
    }),
    update: (_table: unknown) => ({
      set: (values: Partial<User>) => ({
        where: async (cond: Cond) => {
          if (state.raceOnUpdate) {
            // A concurrent writer links the row to another Clerk user just before our conditional update.
            for (const u of state.users.filter((row) => matches(row, cond))) u.clerkUserId = state.raceOnUpdate;
          }
          for (const u of state.users.filter((row) => matches(row, cond))) Object.assign(u, values);
        }
      })
    }),
    query: {
      users: {
        findFirst: vi.fn(async (opts: { where: (t: unknown, o: unknown) => Cond }) => {
          const cond = opts.where(
            { id: "id", email: "email", role: "role", companyId: "companyId", clerkUserId: "clerkUserId", deletedAt: "deletedAt", clerkUnlinkedAt: "clerkUnlinkedAt" },
            {
              eq: (field: keyof User, value: unknown) => ({ op: "eq", field, value }),
              isNull: (field: keyof User) => ({ op: "isNull", field }),
              and: (...parts: Cond[]) => ({ op: "and", parts })
            }
          );
          return state.users.find((u) => matches(u, cond)) ?? undefined;
        })
      }
    }
  });
  return {
    companies: companiesTable,
    users: usersTable,
    db: {
      // Emulates pg_advisory_xact_lock: the lock is held until the transaction finishes.
      transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
        let done!: () => void;
        const release = new Promise<void>((resolve) => (done = resolve));
        let waitFor: Promise<void> = Promise.resolve();
        const tx = makeTx(() => undefined, release);
        const originalExecute = tx.execute;
        tx.execute = vi.fn(async () => {
          waitFor = state.lockTail;
          state.lockTail = waitFor.then(() => release);
          await waitFor;
          await originalExecute();
        });
        try {
          return await fn(tx);
        } finally {
          done();
        }
      }
    }
  };
});

describe("clerk-provisioning race safety", () => {
  beforeEach(() => {
    state.companies = [];
    state.users = [];
    state.lockCalls = 0;
    state.lockTail = Promise.resolve();
    state.ambiguous = false;
    state.failInsertUnique = false;
    state.raceOnUpdate = null;
  });

  it("concurrent organization.created + membership.created create one company and one owner", async () => {
    const { provisionClerkMembership, provisionClerkOrganization } = await import("./clerk-provisioning.service.js");
    await Promise.all([
      provisionClerkOrganization({ organizationId: "org_1", name: "Acme" }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "A@x.com", firstName: "A", lastName: "", clerkOrgRole: "org:admin", clerkUserId: null, emailVerified: true }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "b@x.com", firstName: "B", lastName: "", clerkOrgRole: "org:admin", clerkUserId: null, emailVerified: true }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "c@x.com", firstName: "C", lastName: "", clerkOrgRole: "org:member", clerkUserId: null, emailVerified: true })
    ]);
    expect(state.companies).toHaveLength(1);
    expect(state.users.filter((u) => u.role === "owner")).toHaveLength(1);
    expect(state.users.map((u) => u.role).sort()).toEqual(["admin", "office", "owner"]);
    expect(state.lockCalls).toBe(4);
  });
});

describe("FS-157 clerk_user_id provisioning", () => {
  beforeEach(() => {
    state.companies = [];
    state.users = [];
    state.lockCalls = 0;
    state.lockTail = Promise.resolve();
    state.ambiguous = false;
    state.failInsertUnique = false;
    state.raceOnUpdate = null;
  });
  const base = { organizationId: "org_1", name: "Acme", firstName: "A", lastName: "", clerkOrgRole: "org:admin", emailVerified: true };

  it("stores clerk_user_id on create and is idempotent on redelivery", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    const first = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    const again = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    expect(first.status).toBe("created");
    expect(again.status).toBe("exists");
    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.clerkUserId).toBe("user_a");
  });

  it("org creator (organization.created first) becomes owner; a non-creator who joins first does not", async () => {
    const { provisionClerkOrganization, provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkOrganization({ organizationId: "org_1", name: "Acme", createdBy: "user_creator" });
    const other = await provisionClerkMembership({ ...base, email: "m@x.com", clerkUserId: "user_member", clerkOrgRole: "org:member" });
    const creator = await provisionClerkMembership({ ...base, email: "c@x.com", clerkUserId: "user_creator" });
    expect(other).toMatchObject({ status: "created", role: "office" });
    expect(creator).toMatchObject({ status: "created", role: "owner" });
    expect(state.companies).toHaveLength(1);
    expect(state.users.filter((u) => u.role === "owner").map((u) => u.clerkUserId)).toEqual(["user_creator"]);
  });

  it("out of order (membership before organization.created): creator still owner, replays idempotent", async () => {
    const { provisionClerkOrganization, provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    const membership = await provisionClerkMembership({ ...base, email: "c@x.com", clerkUserId: "user_creator" });
    await provisionClerkOrganization({ organizationId: "org_1", name: "Acme", createdBy: "user_creator" });
    await provisionClerkOrganization({ organizationId: "org_1", name: "Acme", createdBy: "user_creator" });
    const replay = await provisionClerkMembership({ ...base, email: "c@x.com", clerkUserId: "user_creator" });
    expect(membership).toMatchObject({ status: "created", role: "owner" });
    expect(replay).toMatchObject({ status: "exists", role: "owner" });
    expect(state.companies).toHaveLength(1);
    expect(state.users).toHaveLength(1);
  });

  it("cross-tenant: a creator of org_1 gains nothing in org_2", async () => {
    const { provisionClerkOrganization, provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkOrganization({ organizationId: "org_1", name: "Acme", createdBy: "user_a" });
    await provisionClerkOrganization({ organizationId: "org_2", name: "Beta", createdBy: "user_b" });
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    const cross = await provisionClerkMembership({ ...base, organizationId: "org_2", name: "Beta", email: "a@x.com", clerkUserId: "user_a" });
    expect(cross.status).toBe("skipped");
    expect(state.users).toHaveLength(1);
    expect(state.users[0]).toMatchObject({ companyId: "co_1", role: "owner" });
  });

  it("returns the DB role so the webhook can publish it to Clerk (first member = owner, even before organization.created)", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    const first = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    const second = await provisionClerkMembership({ ...base, email: "b@x.com", clerkUserId: "user_b" });
    const replay = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    expect(first).toMatchObject({ status: "created", role: "owner" });
    expect(second).toMatchObject({ status: "created", role: "admin" });
    expect(replay).toMatchObject({ status: "exists", role: "owner" });
  });

  it("backfills clerk_user_id on an existing same-company user with a null id", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: null, emailVerified: true });
    expect(state.users[0]?.clerkUserId).toBeNull();
    const res = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    expect(res.status).toBe("linked");
    expect(state.users[0]?.clerkUserId).toBe("user_a");
  });

  it("never re-points a user linked to a different Clerk id", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    const res = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_evil" });
    expect(res.status).toBe("skipped");
    expect(state.users[0]?.clerkUserId).toBe("user_a");
  });

  it("skips a Clerk id already linked to a user in another company (cross-company isolation)", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    const res = await provisionClerkMembership({ ...base, organizationId: "org_2", name: "Other", email: "z@y.com", clerkUserId: "user_a" });
    expect(res.status).toBe("skipped");
    expect(state.users).toHaveLength(1);
  });

  it("generates the company slug inside the provisioning transaction", async () => {
    const auth = await import("./auth.service.js");
    const { provisionClerkOrganization } = await import("./clerk-provisioning.service.js");
    await provisionClerkOrganization({ organizationId: "org_9", name: "Slug Co" });
    const call = vi.mocked(auth.generateUniqueCompanySlug).mock.calls.at(-1);
    expect(call?.[0]).toBe("Slug Co");
    expect(call?.[1]).toBeDefined();
    expect(typeof (call?.[1] as { execute?: unknown }).execute).toBe("function");
  });

  it("does not link an existing user by email when verification is not proven", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: null });
    const res = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a", emailVerified: false });
    expect(res.status).toBe("skipped");
    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.clerkUserId).toBeNull();
  });

  it("never links or matches a soft-deleted user", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: null });
    state.users[0]!.deletedAt = new Date();
    const res = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    expect(res.status).toBe("skipped");
    expect(state.users[0]?.clerkUserId).toBeNull();

    state.users[0]!.clerkUserId = "user_gone";
    const byId = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_gone" });
    expect(byId.status).not.toBe("exists");
  });

  it("does not report linked when the link race is lost", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: null });
    state.raceOnUpdate = "user_other";
    const res = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    expect(res.status).toBe("skipped");
    expect(state.users[0]?.clerkUserId).toBe("user_other");
  });

  it("returns skipped (no throw) on a unique-constraint violation", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    state.failInsertUnique = true;
    await expect(provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" })).resolves.toEqual({
      status: "skipped",
      companyId: null
    });
  });

  it("skips (no throw) when the Clerk org id matches more than one company", async () => {
    const { provisionClerkMembership, provisionClerkOrganization } = await import("./clerk-provisioning.service.js");
    state.ambiguous = true;
    await expect(provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" })).resolves.toEqual({
      status: "skipped",
      companyId: null
    });
    await expect(provisionClerkOrganization({ organizationId: "org_1", name: "Acme" })).resolves.toBeNull();
    expect(state.users).toHaveLength(0);
  });

  it("FS-160b never auto-links a tombstoned user via the membership webhook", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: null });
    state.users[0]!.clerkUnlinkedAt = new Date();
    const res = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_new" });
    expect(res.status).toBe("skipped");
    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.clerkUserId).toBeNull();
  });

  describe("orphan guard (creator already linked elsewhere)", () => {
    it("new user + first org still provisions company and owner", async () => {
      const { provisionClerkOrganizationDetailed, provisionClerkMembership } = await import("./clerk-provisioning.service.js");
      const org = await provisionClerkOrganizationDetailed({ organizationId: "org_1", name: "Acme", createdBy: "user_new" });
      const member = await provisionClerkMembership({ ...base, email: "n@x.com", clerkUserId: "user_new" });
      expect(org.company?.id).toBe("co_1");
      expect(member).toMatchObject({ status: "created", role: "owner", companyId: "co_1" });
      expect(state.companies).toHaveLength(1);
    });

    it("organization.created by an already-linked creator creates no company (replay too)", async () => {
      const { provisionClerkOrganizationDetailed, provisionClerkOrganization } = await import("./clerk-provisioning.service.js");
      state.users.push({ id: "u_x", companyId: "co_existing", email: "x@x.com", role: "owner", clerkUserId: "user_x" });
      const first = await provisionClerkOrganizationDetailed({ organizationId: "org_2", name: "Second", createdBy: "user_x" });
      const replay = await provisionClerkOrganization({ organizationId: "org_2", name: "Second", createdBy: "user_x" });
      expect(first).toEqual({ company: null, skipReason: "creator_already_linked" });
      expect(replay).toBeNull();
      expect(state.companies).toHaveLength(0);
    });

    it("membership before org.created for an already-linked user: no company either way", async () => {
      const { provisionClerkOrganization, provisionClerkMembership } = await import("./clerk-provisioning.service.js");
      state.users.push({ id: "u_x", companyId: "co_existing", email: "x@x.com", role: "owner", clerkUserId: "user_x" });
      const member = await provisionClerkMembership({ ...base, organizationId: "org_2", email: "x@x.com", clerkUserId: "user_x" });
      const org = await provisionClerkOrganization({ organizationId: "org_2", name: "Second", createdBy: "user_x" });
      const memberAfter = await provisionClerkMembership({ ...base, organizationId: "org_2", email: "x@x.com", clerkUserId: "user_x" });
      expect(member).toEqual({ status: "skipped", companyId: null });
      expect(org).toBeNull();
      expect(memberAfter).toEqual({ status: "skipped", companyId: null });
      expect(state.companies).toHaveLength(0);
      expect(state.users).toHaveLength(1);
    });

    it("membership by email of an existing user (no Clerk id) creates no company", async () => {
      const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
      state.users.push({ id: "u_x", companyId: "co_existing", email: "x@x.com", role: "owner", clerkUserId: null });
      const res = await provisionClerkMembership({ ...base, organizationId: "org_2", email: "X@x.com", clerkUserId: null });
      expect(res).toEqual({ status: "skipped", companyId: null });
      expect(state.companies).toHaveLength(0);
    });

    it("an already-provisioned org is unchanged when its creator is linked (replay of a real first org)", async () => {
      const { provisionClerkOrganization, provisionClerkMembership } = await import("./clerk-provisioning.service.js");
      await provisionClerkOrganization({ organizationId: "org_1", name: "Acme", createdBy: "user_a" });
      await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
      const replay = await provisionClerkOrganization({ organizationId: "org_1", name: "Acme", createdBy: "user_a" });
      expect(replay?.id).toBe("co_1");
      expect(state.companies).toHaveLength(1);
    });

    it("missing created_by behaves as before: company is created (membership then decides ownership)", async () => {
      const { provisionClerkOrganization } = await import("./clerk-provisioning.service.js");
      state.users.push({ id: "u_x", companyId: "co_existing", email: "x@x.com", role: "owner", clerkUserId: "user_x" });
      const org = await provisionClerkOrganization({ organizationId: "org_3", name: "NoCreator" });
      expect(org?.id).toBe("co_1");
      expect(state.companies).toHaveLength(1);
    });
  });
});
