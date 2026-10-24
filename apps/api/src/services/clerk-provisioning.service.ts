import pino from "pino";

import { companies, db, users } from "@fsm/db";
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
}

/** Idempotent: returns the existing company for the Clerk org, or creates it. */
export async function provisionClerkOrganization(input: ClerkOrganizationInput): Promise<CompanyRow> {
  const existing = await findCompanyByClerkOrganizationId(input.organizationId);
  if (existing) {
    return existing;
  }

  const name = input.name.trim() || "New company";
  const slug = await generateUniqueCompanySlug(name);
  const [company] = await db
    .insert(companies)
    .values({ name, slug, timezone: "America/Chicago", settings: { clerk: { organizationId: input.organizationId } } })
    .returning();

  if (!company) {
    throw new Error("Failed to provision company for Clerk organization");
  }
  return company;
}

function mapClerkOrgRole(clerkOrgRole: string | null, isFirstUser: boolean): UserRole {
  if (isFirstUser) {
    return "owner";
  }
  return clerkOrgRole === "org:admin" ? "admin" : "office";
}

/** Idempotent: ensures company + staff user for a Clerk org membership. First user becomes owner. */
export async function provisionClerkMembership(
  input: ClerkMembershipInput
): Promise<{ status: "created" | "exists" | "skipped"; companyId: string }> {
  const company = await provisionClerkOrganization(input);
  const email = input.email.trim().toLowerCase();

  const existingUser = await db.query.users.findFirst({
    where: (userTable, operators) => operators.eq(userTable.email, email)
  });

  if (existingUser) {
    if (existingUser.companyId !== company.id) {
      logger.warn({ companyId: company.id }, "Clerk membership email belongs to another company; skipped");
      return { status: "skipped", companyId: company.id };
    }
    return { status: "exists", companyId: company.id };
  }

  const anyUser = await db.query.users.findFirst({
    where: (userTable, operators) => operators.eq(userTable.companyId, company.id)
  });

  await db.insert(users).values({
    companyId: company.id,
    email,
    passwordHash: null,
    firstName: input.firstName.trim() || "Owner",
    lastName: input.lastName.trim() || "",
    role: mapClerkOrgRole(input.clerkOrgRole, !anyUser)
  });

  return { status: "created", companyId: company.id };
}
