import { beforeEach, describe, expect, it, vi } from "vitest";

type Company = { id: string; settings: { clerk: { organizationId: string } } };
type User = { id?: string; companyId: string; email: string; role: string; clerkUserId?: string | null };

const state = vi.hoisted(() => ({
  companies: [] as Company[],
  users: [] as User[],
  lockCalls: 0,
  lockTail: Promise.resolve() as Promise<void>
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

vi.mock("./clerk-tenant.service.js", () => ({
  findCompanyByClerkOrganizationId: vi.fn(async (orgId: string) => {
    await new Promise((resolve) => setImmediate(resolve)); // widen the race window
    return state.companies.find((c) => c.settings.clerk.organizationId === orgId) ?? null;
  })
}));

vi.mock("@fsm/db", () => {
  const companiesTable = { name: "companies" };
  const usersTable = { name: "users", id: "id", clerkUserId: "clerkUserId", email: "email", companyId: "companyId" };
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
        state.users.push({ id: `u_${state.users.length + 1}`, clerkUserId: null, ...(values as object) } as User);
        return Promise.resolve();
      }
    }),
    update: (_table: unknown) => ({
      set: (values: Partial<User>) => ({
        where: async (cond: Cond) => {
          for (const u of state.users.filter((row) => matches(row, cond))) Object.assign(u, values);
        }
      })
    }),
    query: {
      users: {
        findFirst: vi.fn(async (opts: { where: (t: unknown, o: unknown) => unknown }) => {
          let predicate: (u: User) => boolean = () => false;
          opts.where(
            { email: "email", companyId: "companyId", clerkUserId: "clerkUserId" },
            {
              eq: (field: keyof User, value: string) => {
                predicate = (u) => u[field] === value;
              }
            }
          );
          return state.users.find(predicate) ?? undefined;
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
  });

  it("concurrent organization.created + membership.created create one company and one owner", async () => {
    const { provisionClerkMembership, provisionClerkOrganization } = await import("./clerk-provisioning.service.js");
    await Promise.all([
      provisionClerkOrganization({ organizationId: "org_1", name: "Acme" }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "A@x.com", firstName: "A", lastName: "", clerkOrgRole: "org:admin", clerkUserId: null }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "b@x.com", firstName: "B", lastName: "", clerkOrgRole: "org:admin", clerkUserId: null }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "c@x.com", firstName: "C", lastName: "", clerkOrgRole: "org:member", clerkUserId: null })
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
  });
  const base = { organizationId: "org_1", name: "Acme", firstName: "A", lastName: "", clerkOrgRole: "org:admin" };

  it("stores clerk_user_id on create and is idempotent on redelivery", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    const first = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    const again = await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: "user_a" });
    expect(first.status).toBe("created");
    expect(again.status).toBe("exists");
    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.clerkUserId).toBe("user_a");
  });

  it("backfills clerk_user_id on an existing same-company user with a null id", async () => {
    const { provisionClerkMembership } = await import("./clerk-provisioning.service.js");
    await provisionClerkMembership({ ...base, email: "a@x.com", clerkUserId: null });
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
});
