import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, ErrorCode } from "@fsm/types";

const { findCompanyByClerkOrganizationId, resolveStaffUserForClerkSession } = vi.hoisted(() => ({
  findCompanyByClerkOrganizationId: vi.fn(),
  resolveStaffUserForClerkSession: vi.fn()
}));
vi.mock("./clerk-tenant.service.js", () => ({ findCompanyByClerkOrganizationId, resolveStaffUserForClerkSession }));
vi.mock("../lib/clerk-role-metadata.js", () => ({ syncClerkUserRoleMetadata: vi.fn() }));

import { getClerkCompanyStatus } from "./clerk-company-status.service.js";

const base = { clerkUserId: "user_1", clerkOrganizationId: "org_1", email: "a@b.co", role: null };

describe("getClerkCompanyStatus", () => {
  beforeEach(() => {
    findCompanyByClerkOrganizationId.mockReset();
    resolveStaffUserForClerkSession.mockReset();
  });

  it("no active organization", async () => {
    const res = await getClerkCompanyStatus({ ...base, clerkOrganizationId: null });
    expect(res).toEqual({ hasOrganization: false, companyExists: false, role: null, needsTokenRefresh: false, roleSync: "not_needed" });
    expect(findCompanyByClerkOrganizationId).not.toHaveBeenCalled();
  });

  it("org without a company yet (webhook pending)", async () => {
    findCompanyByClerkOrganizationId.mockResolvedValue(null);
    const res = await getClerkCompanyStatus(base);
    expect(res).toMatchObject({ hasOrganization: true, companyExists: false, role: null });
  });

  it("ambiguous org fails closed as not provisioned", async () => {
    findCompanyByClerkOrganizationId.mockRejectedValue(new AppError(ErrorCode.UNAUTHORIZED, "x"));
    expect(await getClerkCompanyStatus(base)).toMatchObject({ companyExists: false, role: null });
  });

  it("company exists but this user is not mapped", async () => {
    findCompanyByClerkOrganizationId.mockResolvedValue({ id: "c1" });
    resolveStaffUserForClerkSession.mockRejectedValue(new AppError(ErrorCode.UNAUTHORIZED, "x"));
    expect(await getClerkCompanyStatus(base)).toMatchObject({ companyExists: true, role: null, needsTokenRefresh: false });
  });

  it("mapped user with missing role claim: self-heals Clerk metadata and asks for a token refresh", async () => {
    findCompanyByClerkOrganizationId.mockResolvedValue({ id: "c1" });
    resolveStaffUserForClerkSession.mockResolvedValue({ id: "u1", role: "owner" });
    const syncRole = vi.fn(async () => "synced" as const);
    const res = await getClerkCompanyStatus(base, { syncRole });
    expect(resolveStaffUserForClerkSession).toHaveBeenCalledWith("c1", expect.objectContaining({ clerkUserId: "user_1" }));
    expect(syncRole).toHaveBeenCalledWith("user_1", "owner");
    expect(res).toEqual({ hasOrganization: true, companyExists: true, role: "owner", needsTokenRefresh: true, roleSync: "synced" });
  });

  it("role claim already matches: no Clerk write", async () => {
    findCompanyByClerkOrganizationId.mockResolvedValue({ id: "c1" });
    resolveStaffUserForClerkSession.mockResolvedValue({ id: "u1", role: "admin" });
    const syncRole = vi.fn();
    const res = await getClerkCompanyStatus({ ...base, role: "admin" }, { syncRole });
    expect(syncRole).not.toHaveBeenCalled();
    expect(res).toMatchObject({ role: "admin", needsTokenRefresh: false, roleSync: "not_needed" });
  });

  it("rethrows non-AppError failures", async () => {
    findCompanyByClerkOrganizationId.mockRejectedValue(new Error("db down"));
    await expect(getClerkCompanyStatus(base)).rejects.toThrow("db down");
  });
});
