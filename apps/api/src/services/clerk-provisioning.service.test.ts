import { beforeEach, describe, expect, it, vi } from "vitest";

type Company = { id: string; settings: { clerk: { organizationId: string } } };
type User = { companyId: string; email: string; role: string };

const state = vi.hoisted(() => ({
  companies: [] as Company[],
  users: [] as User[],
  lockCalls: 0,
  lockTail: Promise.resolve() as Promise<void>
}));

vi.mock("drizzle-orm", () => ({ sql: (..._args: unknown[]) => ({ kind: "sql" }) }));

vi.mock("./auth.service.js", () => ({ generateUniqueCompanySlug: vi.fn(async (name: string) => name.toLowerCase()) }));

vi.mock("./clerk-tenant.service.js", () => ({
  findCompanyByClerkOrganizationId: vi.fn(async (orgId: string) => {
    await new Promise((resolve) => setImmediate(resolve)); // widen the race window
    return state.companies.find((c) => c.settings.clerk.organizationId === orgId) ?? null;
  })
}));

vi.mock("@fsm/db", () => {
  const companiesTable = { name: "companies" };
  const usersTable = { name: "users" };
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
        state.users.push(values as unknown as User);
        return Promise.resolve();
      }
    }),
    query: {
      users: {
        findFirst: vi.fn(async (opts: { where: (t: unknown, o: unknown) => unknown }) => {
          let predicate: (u: User) => boolean = () => false;
          opts.where(
            { email: "email", companyId: "companyId" },
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
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "A@x.com", firstName: "A", lastName: "", clerkOrgRole: "org:admin" }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "b@x.com", firstName: "B", lastName: "", clerkOrgRole: "org:admin" }),
      provisionClerkMembership({ organizationId: "org_1", name: "Acme", email: "c@x.com", firstName: "C", lastName: "", clerkOrgRole: "org:member" })
    ]);
    expect(state.companies).toHaveLength(1);
    expect(state.users.filter((u) => u.role === "owner")).toHaveLength(1);
    expect(state.users.map((u) => u.role).sort()).toEqual(["admin", "office", "owner"]);
    expect(state.lockCalls).toBe(4);
  });
});
