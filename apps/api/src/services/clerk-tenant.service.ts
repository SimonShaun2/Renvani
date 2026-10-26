import { and, eq, isNull, sql } from "drizzle-orm";
import pino from "pino";

import { companies, db, users, type Database } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import type { ClerkVerifiedSession } from "../lib/clerk-auth.js";
import { readClerkOrganizationIdFromSettings } from "../lib/clerk-company-settings.js";

export { readClerkOrganizationIdFromSettings };

const logger = pino({ name: "clerk-tenant" });

/**
 * More than one live company carries the same Clerk org id (possible when migration 0038 skipped
 * companies_clerk_organization_id_idx because of pre-existing duplicates). Surfaces to clients as a generic 401.
 */
export class ClerkOrganizationAmbiguousError extends AppError {
  public constructor() {
    super(ErrorCode.UNAUTHORIZED, "Clerk organization is not linked to a company");
    this.name = "ClerkOrganizationAmbiguousError";
  }
}

type SelectExecutor = Pick<Database, "select">;

type CompanyRow = typeof companies.$inferSelect;
type UserRow = Awaited<ReturnType<typeof db.query.users.findFirst>>;

/**
 * Resolve the single live company for a Clerk org id. Fails closed (FS-157 follow-up): if more than one
 * non-deleted company matches, never pick one arbitrarily — log an alert and throw a generic 401.
 */
export async function findCompanyByClerkOrganizationId(
  clerkOrganizationId: string,
  executor: SelectExecutor = db
): Promise<CompanyRow | null> {
  const matches = await executor
    .select()
    .from(companies)
    .where(
      and(
        isNull(companies.deletedAt),
        sql`${companies.settings} -> 'clerk' ->> 'organizationId' = ${clerkOrganizationId}`
      )
    )
    .limit(2);

  if (matches.length > 1) {
    logger.error(
      { alert: "clerk_org_ambiguous", clerkOrganizationId, companyIds: matches.map((company) => company.id) },
      "Multiple live companies share a Clerk organization id; failing closed (resolve duplicates, then create companies_clerk_organization_id_idx)"
    );
    throw new ClerkOrganizationAmbiguousError();
  }

  return matches[0] ?? null;
}

function rejectClerkSession(): never {
  throw new AppError(ErrorCode.UNAUTHORIZED, "No active staff user for Clerk organization");
}

/**
 * FS-157 — map a Clerk session to a staff user, fail closed:
 * 1. By stored users.clerk_user_id (= token `sub`). Must belong to this company, be active and not deleted.
 * 2. Otherwise, only to link on first login: the Clerk-verified email (session.email is null unless
 *    email_verified) must match an active user in this company whose clerk_user_id is still null; the id is
 *    then backfilled. A user already linked to a different Clerk id is never re-pointed. No first-user fallback.
 */
export async function resolveStaffUserForClerkSession(
  companyId: string,
  session: ClerkVerifiedSession
): Promise<NonNullable<UserRow>> {
  const clerkUserId = session.clerkUserId?.trim();
  if (!clerkUserId) {
    rejectClerkSession();
  }

  const linked = await db.query.users.findFirst({
    where: (userTable, operators) => operators.eq(userTable.clerkUserId, clerkUserId)
  });
  if (linked) {
    if (linked.companyId !== companyId || linked.deletedAt !== null || !linked.isActive) {
      rejectClerkSession();
    }
    return linked;
  }

  if (!session.email) {
    rejectClerkSession();
  }
  const email = session.email;
  const user = await db.query.users.findFirst({
    where: (userTable, operators) =>
      operators.and(
        operators.eq(userTable.companyId, companyId),
        operators.eq(userTable.email, email),
        operators.isNull(userTable.deletedAt)
      )
  });

  if (!user || !user.isActive || (user.clerkUserId != null && user.clerkUserId !== clerkUserId)) {
    rejectClerkSession();
  }
  if (user.clerkUnlinkedAt) {
    // FS-160b: unlinked by Clerk user.deleted; re-attaching is a manual DB step until FS-165 (admin relink route).
    logger.warn({ userId: user.id, companyId }, "Clerk session email matches a tombstoned user; not auto-linking");
    rejectClerkSession();
  }

  // Conditional backfill: only claims an unlinked row (a concurrent link to another id wins and we reject).
  let updated: NonNullable<UserRow> | undefined;
  try {
    [updated] = await db
      .update(users)
      .set({ clerkUserId, updatedAt: new Date() })
      .where(
        and(
          eq(users.id, user.id),
          eq(users.companyId, companyId),
          isNull(users.clerkUserId),
          isNull(users.clerkUnlinkedAt)
        )
      )
      .returning();
  } catch {
    // e.g. unique violation: this Clerk id was concurrently linked to another user.
    rejectClerkSession();
  }
  if (updated) {
    return updated;
  }
  const reread = await db.query.users.findFirst({
    where: (userTable, operators) => operators.eq(userTable.id, user.id)
  });
  if (!reread || reread.clerkUserId !== clerkUserId) {
    rejectClerkSession();
  }
  return reread;
}
