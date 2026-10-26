import { and, eq, isNull, sql } from "drizzle-orm";

import { companies, db, users, type Database } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import type { ClerkVerifiedSession } from "../lib/clerk-auth.js";
import { readClerkOrganizationIdFromSettings } from "../lib/clerk-company-settings.js";

export { readClerkOrganizationIdFromSettings };

type SelectExecutor = Pick<Database, "select">;

type CompanyRow = typeof companies.$inferSelect;
type UserRow = Awaited<ReturnType<typeof db.query.users.findFirst>>;

export async function findCompanyByClerkOrganizationId(
  clerkOrganizationId: string,
  executor: SelectExecutor = db
): Promise<CompanyRow | null> {
  const [company] = await executor
    .select()
    .from(companies)
    .where(
      and(
        isNull(companies.deletedAt),
        sql`${companies.settings} -> 'clerk' ->> 'organizationId' = ${clerkOrganizationId}`
      )
    )
    .limit(1);

  return company ?? null;
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

  // Conditional backfill: only claims an unlinked row (a concurrent link to another id wins and we reject).
  let updated: NonNullable<UserRow> | undefined;
  try {
    [updated] = await db
      .update(users)
      .set({ clerkUserId, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.companyId, companyId), isNull(users.clerkUserId)))
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
