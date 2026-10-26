import { and, eq, isNull, sql } from "drizzle-orm";
import pino from "pino";

import { companies, db, users, type Database } from "@fsm/db";
import type { UserRole } from "@fsm/types";

import { generateUniqueCompanySlug } from "./auth.service.js";
import { findCompanyByClerkOrganizationId } from "./clerk-tenant.service.js";

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

/** Idempotent and race-safe: returns the existing company for the Clerk org, or creates it. */
export async function provisionClerkOrganization(input: ClerkOrganizationInput): Promise<CompanyRow> {
  return db.transaction(async (tx) => {
    await lockClerkOrganization(tx, input.organizationId);
    return findOrCreateCompany(tx, input);
  });
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
 * FS-157: stores clerk_user_id on create, backfills it on an existing same-company user whose id is still null,
 * and never re-points a user already linked to a different Clerk user or reuses a Clerk id held by another user.
 */
export async function provisionClerkMembership(
  input: ClerkMembershipInput
): Promise<{ status: MembershipStatus; companyId: string }> {
  const email = input.email.trim().toLowerCase();
  const clerkUserId = input.clerkUserId?.trim() || null;

  return db.transaction(async (tx) => {
    await lockClerkOrganization(tx, input.organizationId);
    const company = await findOrCreateCompany(tx, input);

    if (clerkUserId) {
      const byClerkId = await tx.query.users.findFirst({
        where: (userTable, operators) => operators.eq(userTable.clerkUserId, clerkUserId)
      });
      if (byClerkId) {
        if (byClerkId.companyId !== company.id || byClerkId.email !== email) {
          logger.warn({ companyId: company.id }, "Clerk user id already linked to a different staff user; skipped");
          return { status: "skipped" as const, companyId: company.id };
        }
        return { status: "exists" as const, companyId: company.id };
      }
    }

    const existingUser = await tx.query.users.findFirst({
      where: (userTable, operators) => operators.eq(userTable.email, email)
    });

    if (existingUser) {
      if (existingUser.companyId !== company.id) {
        logger.warn({ companyId: company.id }, "Clerk membership email belongs to another company; skipped");
        return { status: "skipped" as const, companyId: company.id };
      }
      if (!clerkUserId) {
        return { status: "exists" as const, companyId: company.id };
      }
      if (existingUser.clerkUserId && existingUser.clerkUserId !== clerkUserId) {
        logger.warn({ companyId: company.id }, "Staff user already linked to another Clerk user; skipped");
        return { status: "skipped" as const, companyId: company.id };
      }
      await tx
        .update(users)
        .set({ clerkUserId, updatedAt: new Date() })
        .where(and(eq(users.id, existingUser.id), isNull(users.clerkUserId)));
      return { status: "linked" as const, companyId: company.id };
    }

    const anyUser = await tx.query.users.findFirst({
      where: (userTable, operators) => operators.eq(userTable.companyId, company.id)
    });

    await tx.insert(users).values({
      companyId: company.id,
      email,
      clerkUserId,
      passwordHash: null,
      firstName: input.firstName.trim() || "Owner",
      lastName: input.lastName.trim() || "",
      role: mapClerkOrgRole(input.clerkOrgRole, !anyUser)
    });

    return { status: "created" as const, companyId: company.id };
  });
}
