import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({ aiQueue: { add: vi.fn() } }));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type RelinkModule = typeof import("../../services/clerk-admin-relink.service.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let relink: RelinkModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
  relink = await import("../../services/clerk-admin-relink.service.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

let seq = 0;
function seedCompany() {
  seq += 1;
  return fakeDb.seedCompany({ name: `Co ${seq}`, slug: `co-${seq}`, timezone: "America/Chicago" });
}

function actor(companyId: string, role: "owner" | "admin" | "dispatcher" | "office" | "technician") {
  seq += 1;
  const user = fakeDb.seedUser({ companyId, email: `actor${seq}@example.com`, firstName: "A", lastName: "B", role });
  const token = tokens.generateAccessToken({ userId: user.id, companyId, role: user.role });
  return { user, authorization: `Bearer ${token}` };
}

function tombstoned(companyId: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  return fakeDb.seedUser({
    companyId,
    email: `target${seq}@example.com`,
    firstName: "T",
    lastName: "U",
    role: "technician",
    isActive: false,
    clerkUserId: null,
    clerkUnlinkedAt: new Date("2026-10-01T00:00:00Z"),
    ...extra
  });
}

/** Rolled-back fake transactions restore row copies, so always read the current row. */
function row(id: string) {
  const found = fakeDb.getTestState().users.find((user) => user.id === id);
  if (!found) throw new Error("row missing");
  return found;
}

function relinkCall(userId: string, authorization: string | null, body: Record<string, unknown>) {
  const req = request(app.server).post(`/api/v1/users/${userId}/clerk-relink`);
  if (authorization) req.set("Authorization", authorization);
  return req.send(body);
}

describe("POST /api/v1/users/:id/clerk-relink (FS-165)", () => {
  it("owner and admin can relink: sets clerk id, clears tombstone, reactivates, writes an ids-only audit", async () => {
    const company = seedCompany();
    const info = vi.spyOn(relink.relinkAuditLogger, "info");
    for (const role of ["owner", "admin"] as const) {
      const { user: actorUser, authorization } = actor(company.id, role);
      const target = tombstoned(company.id);
      const res = await relinkCall(target.id, authorization, { clerkUserId: `user_${role}A1` });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "relinked", overwrotePreviousClerkId: false });
      expect(row(target.id).clerkUserId).toBe(`user_${role}A1`);
      expect(row(target.id).clerkUnlinkedAt).toBeNull();
      expect(row(target.id).isActive).toBe(true);
      const auditCall = info.mock.calls.find(
        ([obj]) => (obj as { targetUserId?: string }).targetUserId === target.id
      );
      expect(auditCall?.[0]).toMatchObject({
        audit: "clerk_user_relinked",
        companyId: company.id,
        actorUserId: actorUser.id,
        targetUserId: target.id,
        tombstoneCleared: true,
        reactivated: true,
        overwrotePreviousClerkId: false
      });
      expect(JSON.stringify(auditCall?.[0])).not.toContain("@");
    }
  });

  it("non-admin roles get 403 and nothing changes", async () => {
    const company = seedCompany();
    for (const role of ["dispatcher", "office", "technician"] as const) {
      const { authorization } = actor(company.id, role);
      const target = tombstoned(company.id);
      const res = await relinkCall(target.id, authorization, { clerkUserId: "user_X1" });
      expect(res.status).toBe(403);
      expect(row(target.id).clerkUnlinkedAt).not.toBeNull();
      expect(row(target.id).clerkUserId).toBeNull();
    }
  });

  it("401 without a token", async () => {
    const company = seedCompany();
    const target = tombstoned(company.id);
    const res = await relinkCall(target.id, null, { clerkUserId: "user_X1" });
    expect(res.status).toBe(401);
  });

  it("cross-company target returns 404 and is untouched", async () => {
    const companyA = seedCompany();
    const companyB = seedCompany();
    const { authorization } = actor(companyA.id, "owner");
    const target = tombstoned(companyB.id);
    const res = await relinkCall(target.id, authorization, { clerkUserId: "user_X1" });
    expect(res.status).toBe(404);
    expect(row(target.id).clerkUserId).toBeNull();
    expect(row(target.id).clerkUnlinkedAt).not.toBeNull();
  });

  it("soft-deleted target returns 404", async () => {
    const company = seedCompany();
    const { authorization } = actor(company.id, "admin");
    const target = tombstoned(company.id, { deletedAt: new Date() });
    const res = await relinkCall(target.id, authorization, { clerkUserId: "user_X1" });
    expect(res.status).toBe(404);
    expect(row(target.id).clerkUserId).toBeNull();
  });

  it("409 when another user (any company) already holds the Clerk id; nothing changes", async () => {
    const company = seedCompany();
    const other = seedCompany();
    const { authorization } = actor(company.id, "owner");
    fakeDb.seedUser({ companyId: other.id, email: "holder@example.com", firstName: "H", lastName: "D", clerkUserId: "user_Taken1" });
    const target = tombstoned(company.id);
    const res = await relinkCall(target.id, authorization, { clerkUserId: "user_Taken1" });
    expect(res.status).toBe(409);
    expect(row(target.id).clerkUserId).toBeNull();
    expect(row(target.id).clerkUnlinkedAt).not.toBeNull();
    expect(row(target.id).isActive).toBe(false);
  });

  it("maps a 23505 unique-violation race to 409", async () => {
    const company = seedCompany();
    const { authorization } = actor(company.id, "owner");
    const target = tombstoned(company.id);
    const dbModule = (await import("@fsm/db")) as unknown as { db: { transaction: (...args: unknown[]) => unknown } };
    vi.spyOn(dbModule.db, "transaction").mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
    const res = await relinkCall(target.id, authorization, { clerkUserId: "user_Race1" });
    expect(res.status).toBe(409);
  });

  it("overwriting a DIFFERENT existing clerk id needs confirmOverwrite, then flags it in the audit", async () => {
    const company = seedCompany();
    const { authorization } = actor(company.id, "owner");
    const target = tombstoned(company.id, { clerkUserId: "user_Old1", clerkUnlinkedAt: null, isActive: true });

    const refused = await relinkCall(target.id, authorization, { clerkUserId: "user_New1" });
    expect(refused.status).toBe(409);
    expect(row(target.id).clerkUserId).toBe("user_Old1");

    const warn = vi.spyOn(relink.relinkAuditLogger, "warn");
    const res = await relinkCall(target.id, authorization, { clerkUserId: "user_New1", confirmOverwrite: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "relinked", overwrotePreviousClerkId: true });
    expect(row(target.id).clerkUserId).toBe("user_New1");
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      audit: "clerk_user_relinked",
      overwrotePreviousClerkId: true,
      previousClerkUserId: "user_Old1",
      newClerkUserId: "user_New1"
    });
  });

  it("repeat with the same id is idempotent (unchanged)", async () => {
    const company = seedCompany();
    const { authorization } = actor(company.id, "owner");
    const target = tombstoned(company.id);
    expect((await relinkCall(target.id, authorization, { clerkUserId: "user_Same1" })).status).toBe(200);
    const again = await relinkCall(target.id, authorization, { clerkUserId: "user_Same1" });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ status: "unchanged", overwrotePreviousClerkId: false });
  });

  it("validates input: Clerk id format, unknown fields, non-uuid id", async () => {
    const company = seedCompany();
    const { authorization } = actor(company.id, "owner");
    const target = tombstoned(company.id);
    for (const body of [{}, { clerkUserId: "" }, { clerkUserId: "abc" }, { clerkUserId: "user_bad id" }, { clerkUserId: "user_A1", extra: 1 }]) {
      const res = await relinkCall(target.id, authorization, body);
      expect(res.status).toBe(400);
    }
    expect((await relinkCall("not-a-uuid", authorization, { clerkUserId: "user_A1" })).status).toBe(400);
    expect(row(target.id).clerkUserId).toBeNull();
  });
});
