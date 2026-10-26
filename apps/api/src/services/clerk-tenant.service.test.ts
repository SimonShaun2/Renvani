import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

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

type ClerkTenantServiceModule = typeof import("./clerk-tenant.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let clerkTenantService: ClerkTenantServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  clerkTenantService = await import("./clerk-tenant.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
});

describe("clerk-tenant.service", () => {
  it("findCompanyByClerkOrganizationId resolves company via settings.clerk.organizationId", async () => {
    const linked = fakeDb.seedCompany({
      name: "Linked Co",
      slug: "linked-co",
      settings: { clerk: { organizationId: "org_linked" } }
    });
    fakeDb.seedCompany({
      name: "Other Co",
      slug: "other-co",
      settings: { clerk: { organizationId: "org_other" } }
    });

    const found = await clerkTenantService.findCompanyByClerkOrganizationId("org_linked");
    expect(found?.id).toBe(linked.id);
  });

  it("findCompanyByClerkOrganizationId returns null when unmapped", async () => {
    fakeDb.seedCompany({ name: "No Clerk", slug: "no-clerk", settings: {} });
    const found = await clerkTenantService.findCompanyByClerkOrganizationId("org_missing");
    expect(found).toBeNull();
  });

  it("resolveStaffUserForClerkSession matches email within company", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "dispatcher@acme.com",
      firstName: "D",
      lastName: "User",
      role: "dispatcher"
    });
    fakeDb.seedUser({
      companyId: company.id,
      email: "other@acme.com",
      firstName: "Other",
      lastName: "User",
      role: "owner"
    });

    const resolved = await clerkTenantService.resolveStaffUserForClerkSession(company.id, {
      clerkUserId: "user_clerk",
      clerkOrganizationId: "org_acme",
      role: null,
      email: "dispatcher@acme.com"
    });

    expect(resolved.id).toBe(user.id);
  });

  it("STACK03-CLK-09 findCompanyByClerkOrganizationId never maps org B id to company A", async () => {
    const companyA = fakeDb.seedCompany({
      name: "Org A",
      slug: "org-a-clerk",
      settings: { clerk: { organizationId: "org_stack03_map_a" } }
    });
    fakeDb.seedCompany({
      name: "Org B",
      slug: "org-b-clerk",
      settings: { clerk: { organizationId: "org_stack03_map_b" } }
    });

    const resolved = await clerkTenantService.findCompanyByClerkOrganizationId("org_stack03_map_b");
    expect(resolved?.id).not.toBe(companyA.id);
  });

  it("resolveStaffUserForClerkSession rejects inactive users", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-inactive" });
    fakeDb.seedUser({
      companyId: company.id,
      email: "inactive@acme.com",
      firstName: "Inactive",
      lastName: "User",
      role: "owner",
      isActive: false
    });

    await expect(
      clerkTenantService.resolveStaffUserForClerkSession(company.id, {
        clerkUserId: "user_clerk",
        clerkOrganizationId: "org_acme",
      role: null,
        email: "inactive@acme.com"
      })
    ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
  });

  it("resolveStaffUserForClerkSession fails closed when the verified email is missing (no first-user fallback)", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-noemail" });
    fakeDb.seedUser({ companyId: company.id, email: "owner@acme.com", firstName: "O", lastName: "W", role: "owner" });
    fakeDb.seedUser({ companyId: company.id, email: "tech@acme.com", firstName: "T", lastName: "C", role: "technician" });
    await expect(
      clerkTenantService.resolveStaffUserForClerkSession(company.id, {
        clerkUserId: "user_clerk",
        clerkOrganizationId: "org_acme",
        role: null,
        email: null
      })
    ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
  });

  it("resolveStaffUserForClerkSession fails closed when the email matches no staff user in the company", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-unmatched" });
    fakeDb.seedUser({ companyId: company.id, email: "owner@acme.com", firstName: "O", lastName: "W", role: "owner" });
    const other = fakeDb.seedCompany({ name: "Other", slug: "other-unmatched" });
    fakeDb.seedUser({ companyId: other.id, email: "stranger@acme.com", firstName: "S", lastName: "X", role: "owner" });
    await expect(
      clerkTenantService.resolveStaffUserForClerkSession(company.id, {
        clerkUserId: "user_clerk",
        clerkOrganizationId: "org_acme",
        role: null,
        email: "stranger@acme.com"
      })
    ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
  });

  describe("FS-157 clerk_user_id mapping", () => {
    const session = (clerkUserId: string, email: string | null) => ({
      clerkUserId,
      clerkOrganizationId: "org_acme",
      role: null,
      email
    });

    it("maps by stored clerk_user_id first, even when the email claim differs or is missing", async () => {
      const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-cid" });
      const user = fakeDb.seedUser({ companyId: company.id, email: "a@acme.com", firstName: "A", lastName: "B", clerkUserId: "user_a" });
      fakeDb.seedUser({ companyId: company.id, email: "other@acme.com", firstName: "O", lastName: "B" });
      expect((await clerkTenantService.resolveStaffUserForClerkSession(company.id, session("user_a", null))).id).toBe(user.id);
      expect((await clerkTenantService.resolveStaffUserForClerkSession(company.id, session("user_a", "other@acme.com"))).id).toBe(user.id);
    });

    it("links by verified email on first login and backfills clerk_user_id", async () => {
      const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-backfill" });
      const user = fakeDb.seedUser({ companyId: company.id, email: "a@acme.com", firstName: "A", lastName: "B" });
      const resolved = await clerkTenantService.resolveStaffUserForClerkSession(company.id, session("user_new", "a@acme.com"));
      expect(resolved.id).toBe(user.id);
      expect(user.clerkUserId).toBe("user_new");
      // Next login maps by id with no email claim at all.
      expect((await clerkTenantService.resolveStaffUserForClerkSession(company.id, session("user_new", null))).id).toBe(user.id);
    });

    it("rejects an email match when the user is already linked to a different Clerk id", async () => {
      const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-relink" });
      const user = fakeDb.seedUser({ companyId: company.id, email: "a@acme.com", firstName: "A", lastName: "B", clerkUserId: "user_a" });
      await expect(
        clerkTenantService.resolveStaffUserForClerkSession(company.id, session("user_attacker", "a@acme.com"))
      ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      expect(user.clerkUserId).toBe("user_a");
    });

    it("rejects unverified/missing email for an unlinked Clerk user (no first-user fallback)", async () => {
      const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-unverified" });
      const owner = fakeDb.seedUser({ companyId: company.id, email: "a@acme.com", firstName: "A", lastName: "B", role: "owner" });
      await expect(
        clerkTenantService.resolveStaffUserForClerkSession(company.id, session("user_x", null))
      ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      expect(owner.clerkUserId).toBeNull();
    });

    it("rejects an empty Clerk user id", async () => {
      const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-empty" });
      fakeDb.seedUser({ companyId: company.id, email: "a@acme.com", firstName: "A", lastName: "B" });
      await expect(
        clerkTenantService.resolveStaffUserForClerkSession(company.id, session("", "a@acme.com"))
      ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
    });

    it("cross-company: a clerk_user_id linked in company A never resolves in company B", async () => {
      const a = fakeDb.seedCompany({ name: "A", slug: "a-xco" });
      const b = fakeDb.seedCompany({ name: "B", slug: "b-xco" });
      fakeDb.seedUser({ companyId: a.id, email: "a@a.com", firstName: "A", lastName: "A", clerkUserId: "user_a" });
      const bUser = fakeDb.seedUser({ companyId: b.id, email: "b@b.com", firstName: "B", lastName: "B" });
      await expect(
        clerkTenantService.resolveStaffUserForClerkSession(b.id, session("user_a", "b@b.com"))
      ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      expect(bUser.clerkUserId).toBeNull();
    });

    it("rejects a linked user that is inactive or soft-deleted", async () => {
      const company = fakeDb.seedCompany({ name: "Acme", slug: "acme-linked-inactive" });
      fakeDb.seedUser({ companyId: company.id, email: "i@acme.com", firstName: "I", lastName: "B", clerkUserId: "user_i", isActive: false });
      fakeDb.seedUser({ companyId: company.id, email: "d@acme.com", firstName: "D", lastName: "B", clerkUserId: "user_d", deletedAt: new Date() });
      for (const id of ["user_i", "user_d"]) {
        await expect(
          clerkTenantService.resolveStaffUserForClerkSession(company.id, session(id, null))
        ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      }
    });
  });
});
