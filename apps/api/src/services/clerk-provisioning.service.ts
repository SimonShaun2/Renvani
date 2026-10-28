import { and, eq, isNull, sql } from "drizzle-orm";
import pino from "pino";

import { companies, db, users, type Database } from "@fsm/db";
import type { UserRole } from "@fsm/types";

import { generateUniqueCompanySlug } from "./auth.service.js";
import { ClerkOrganizationAmbiguousError, findCompanyByClerkOrganizationId } from "./clerk-tenant.service.js";

const logger = pino({ name: "clerk-provisioning" });

type CompanyRow = typeof companies.$inferSelect;

export interface ClerkOrganizationInput {
  organizationId: string;
  name: string;
}

export interface ClerkMembershipInput extends ClerkOrganizationInput {
  email: string;
  firstName: string;
  lastName: string;
  clerkOrgRole: string | null;
  /** Clerk user id (`public_user_data.user_id`); stored on users.clerk_user_id. */
  clerkUserId: string | null;
  /**
   * True only when the Clerk payload itself proves the email is verified. organizationMembership payloads
   * do not carry verification, so the webhook passes false and existing users are NOT linked by email here;
   * they link on first login via the Clerk-verified session email (resolveStaffUserForClerkSession).
   */
  emailVerified: boolean;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Serialises all provisioning for one Clerk org (transaction-scoped advisory lock), so concurrent
 * organization.created / organizationMembership.created deliveries cannot create duplicate companies
 * or two first-owners.
 * FS-157: companies_clerk_organization_id_idx is the DB-level guarantee behind this lock.
 */
async function lockClerkOrganization(tx: Tx, organizationId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clerk-org:${organizationId}`}))`);
}

async function findOrCreateCompany(tx: Tx, input: ClerkOrganizationInput): Promise<CompanyRow> {
  const existing = await findCompanyByClerkOrganizationId(input.organizationId, tx);
  if (existing) {
    return existing;
  }

  const name = input.name.trim() || "New company";
  // FS-157: slug lookup runs inside the provisioning transaction (after the org lock).
  const slug = await generateUniqueCompanySlug(name, tx);
  const [company] = await tx
    .insert(companies)
    .values({ name, slug, timezone: "America/Chicago", settings: { clerk: { organizationId: input.organizationId } } })
    .returning();

  if (!company) {
    throw new Error("Failed to provision company for Clerk organization");
  }
  return company;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Idempotent and race-safe: returns the existing company for the Clerk org, or creates it.
 * Returns null (and logs) when the org id is ambiguous or a unique constraint clashes, so the webhook
 * acks with 2xx instead of a 500 that Svix would retry forever.
 */
export async function provisionClerkOrganization(input: ClerkOrganizationInput): Promise<CompanyRow | null> {
  try {
    return await db.transaction(async (tx) => {
      await lockClerkOrganization(tx, input.organizationId);
      return findOrCreateCompany(tx, input);
    });
  } catch (error) {
    if (error instanceof ClerkOrganizationAmbiguousError) return null;
    if (isUniqueViolation(error)) {
      logger.warn({ clerkOrganizationId: input.organizationId }, "Clerk organization provisioning hit a unique constraint; skipped");
      return null;
    }
    throw error;
  }
}

function mapClerkOrgRole(clerkOrgRole: string | null, isFirstUser: boolean): UserRole {
  if (isFirstUser) {
    return "owner";
  }
  return clerkOrgRole === "org:admin" ? "admin" : "office";
}

type MembershipStatus = "created" | "exists" | "linked" | "skipped";

/**
 * Idempotent: ensures company + staff user for a Clerk org membership. First user becomes owner.
 * - Stores clerk_user_id on create; never re-points a user linked to a different Clerk id or reuses a Clerk id
 *   held by another user. Soft-deleted users are ignored in every lookup.
 * - Links an existing (same-company, unlinked) user by email ONLY when input.emailVerified is true.
 * - Reports "linked" only after re-reading the row and confirming it carries this clerk_user_id.
 * - Ambiguous org ids and unique-constraint clashes return "skipped" (logged), never throw.
 */
export async function provisionClerkMembership(
  input: ClerkMembershipInput
): Promise<{ status: MembershipStatus; companyId: string | null; role?: UserRole }> {
  const email = input.email.trim().toLowerCase();
  const clerkUserId = input.clerkUserId?.trim() || null;

  try {
    return await db.transaction(async (tx) => {
      await lockClerkOrganization(tx, input.organizationId);
      const company = await findOrCreateCompany(tx, input);

      if (clerkUserId) {
        const byClerkId = await tx.query.users.findFirst({
          where: (userTable, operators) =>
            operators.and(operators.eq(userTable.clerkUserId, clerkUserId), operators.isNull(userTable.deletedAt))
        });
        if (byClerkId) {
          if (byClerkId.companyId !== company.id || byClerkId.email !== email) {
            logger.warn({ companyId: company.id }, "Clerk user id already linked to a different staff user; skipped");
            return { status: "skipped" as const, companyId: company.id };
          }
          return { status: "exists" as const, companyId: company.id, role: byClerkId.role };
        }
      }

      // users_email_idx is global and includes soft-deleted rows, so look at any row with this email.
      const sameEmail = await tx.query.users.findFirst({
        where: (userTable, operators) => operators.eq(userTable.email, email)
      });

      if (sameEmail) {
        if (sameEmail.deletedAt) {
          logger.warn({ companyId: company.id }, "Clerk membership email belongs to a soft-deleted user; not linked");
          return { status: "skipped" as const, companyId: company.id };
        }
        if (sameEmail.companyId !== company.id) {
          logger.warn({ companyId: company.id }, "Clerk membership email belongs to another company; skipped");
          return { status: "skipped" as const, companyId: company.id };
        }
        if (!clerkUserId) {
          return { status: "exists" as const, companyId: company.id };
        }
        if (sameEmail.clerkUserId && sameEmail.clerkUserId !== clerkUserId) {
          logger.warn({ companyId: company.id }, "Staff user already linked to another Clerk user; skipped");
          return { status: "skipped" as const, companyId: company.id };
        }
        if (sameEmail.clerkUnlinkedAt) {
          logger.warn({ companyId: company.id, userId: sameEmail.id }, "Clerk membership matches a tombstoned user; not auto-linking");
          return { status: "skipped" as const, companyId: company.id };
        }
        if (!input.emailVerified) {
          logger.warn(
            { companyId: company.id },
            "Clerk membership payload does not prove email verification; not linking by email (links on verified login)"
          );
          return { status: "skipped" as const, companyId: company.id };
        }
        await tx
          .update(users)
          .set({ clerkUserId, updatedAt: new Date() })
          .where(
            and(
              eq(users.id, sameEmail.id),
              isNull(users.clerkUserId),
              isNull(users.deletedAt),
              isNull(users.clerkUnlinkedAt)
            )
          );
        const reread = await tx.query.users.findFirst({
          where: (userTable, operators) => operators.eq(userTable.id, sameEmail.id)
        });
        if (reread?.clerkUserId !== clerkUserId) {
          logger.warn({ companyId: company.id }, "Clerk link lost a race (row linked elsewhere); skipped");
          return { status: "skipped" as const, companyId: company.id };
        }
        return { status: "linked" as const, companyId: company.id, role: reread.role };
      }

      const anyUser = await tx.query.users.findFirst({
        where: (userTable, operators) =>
          operators.and(operators.eq(userTable.companyId, company.id), operators.isNull(userTable.deletedAt))
      });

      const role = mapClerkOrgRole(input.clerkOrgRole, !anyUser);
      await tx.insert(users).values({
        companyId: company.id,
        email,
        clerkUserId,
        passwordHash: null,
        firstName: input.firstName.trim() || "Owner",
        lastName: input.lastName.trim() || "",
        role
      });

      return { status: "created" as const, companyId: company.id, role };
    });
  } catch (error) {
    if (error instanceof ClerkOrganizationAmbiguousError) {
      return { status: "skipped", companyId: null };
    }
    if (isUniqueViolation(error)) {
      logger.warn({ clerkOrganizationId: input.organizationId }, "Clerk membership hit a unique constraint (concurrent link/create); skipped");
      return { status: "skipped", companyId: null };
    }
    throw error;
  }
}
