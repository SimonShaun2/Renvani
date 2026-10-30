import { AppError, type UserRole } from "@fsm/types";

import { syncClerkUserRoleMetadata, type ClerkRoleSyncResult } from "../lib/clerk-role-metadata.js";
import { findCompanyByClerkOrganizationId, resolveStaffUserForClerkSession } from "./clerk-tenant.service.js";

export interface ClerkCompanyStatus {
  /** The session has an active Clerk organization (org_id claim). */
  hasOrganization: boolean;
  /** A Renvani company is provisioned for that organization. */
  companyExists: boolean;
  /** Renvani staff role from the DB (authoritative), or null when not provisioned/linked. */
  role: UserRole | null;
  /** True when the session's metadata.role claim differs from `role`: refresh the Clerk token (getToken({ skipCache: true })). */
  needsTokenRefresh: boolean;
  /** Result of the self-heal write to Clerk public_metadata.role (only when it was missing/stale). */
  roleSync: ClerkRoleSyncResult | "not_needed";
}

export interface ClerkStatusSession {
  clerkUserId: string;
  clerkOrganizationId: string | null;
  email: string | null;
  role: UserRole | null;
}

/**
 * Tenant-safe status for the active Clerk org. Read-only on Renvani data (except the existing
 * first-login clerk_user_id backfill in resolveStaffUserForClerkSession). Self-heals the Clerk role claim.
 */
export async function getClerkCompanyStatus(
  session: ClerkStatusSession,
  deps: { syncRole?: typeof syncClerkUserRoleMetadata } = {}
): Promise<ClerkCompanyStatus> {
  const none: ClerkCompanyStatus = {
    hasOrganization: Boolean(session.clerkOrganizationId),
    companyExists: false,
    role: null,
    needsTokenRefresh: false,
    roleSync: "not_needed"
  };
  if (!session.clerkOrganizationId) return none;

  let company;
  try {
    company = await findCompanyByClerkOrganizationId(session.clerkOrganizationId);
  } catch (error) {
    if (error instanceof AppError) return none;
    throw error;
  }
  if (!company) return none;

  let user;
  try {
    user = await resolveStaffUserForClerkSession(company.id, {
      clerkUserId: session.clerkUserId,
      clerkOrganizationId: session.clerkOrganizationId,
      email: session.email,
      role: session.role
    });
  } catch (error) {
    if (error instanceof AppError) return { ...none, companyExists: true };
    throw error;
  }

  if (session.role === user.role) {
    return { ...none, companyExists: true, role: user.role };
  }
  const roleSync = await (deps.syncRole ?? syncClerkUserRoleMetadata)(session.clerkUserId, user.role);
  return { ...none, companyExists: true, role: user.role, needsTokenRefresh: true, roleSync };
}
