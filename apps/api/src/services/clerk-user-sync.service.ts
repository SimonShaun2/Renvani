import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { db, refreshTokens, users } from "@fsm/db";

import { ClerkOrganizationAmbiguousError, findCompanyByClerkOrganizationId } from "./clerk-tenant.service.js";

const logger = pino({ name: "clerk-user-sync" });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ClerkUserUpdatedStatus = "updated" | "linked" | "unchanged" | "not_found" | "skipped";
export type ClerkUserDeactivateStatus = "deactivated" | "not_found" | "skipped";

export interface ClerkUserUpdatedInput {
  clerkUserId: string;
  /** Primary email as Clerk reports it; null when Clerk does not mark it verified (we never act on unverified emails). */
  verifiedPrimaryEmail: string | null;
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
 * Extract the primary email from a Clerk `user.*` payload, only if Clerk marks it verified.
 * Returns null when there is no primary email or its verification status is not exactly "verified".
 */
export function readVerifiedPrimaryEmail(data: Record<string, unknown>): string | null {
  const primaryId = typeof data.primary_email_address_id === "string" ? data.primary_email_address_id : "";
  const list = Array.isArray(data.email_addresses) ? (data.email_addresses as Array<Record<string, unknown>>) : [];
  const primary = list.find((entry) => entry && entry.id === primaryId);
  if (!primary || typeof primary.email_address !== "string") return null;
  const verification = (primary.verification ?? {}) as Record<string, unknown>;
  if (verification.status !== "verified") return null;
  const email = primary.email_address.trim().toLowerCase();
  return email || null;
}

async function revokeRefreshTokens(tx: Tx, userId: string): Promise<void> {
  await tx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/**
 * user.updated: sync a changed, Clerk-verified primary email to the user linked by clerk_user_id, or
 * (FS-162 follow-up) link an existing unlinked active user whose email equals the verified primary email.
 * Fail closed: unverified email -> no change; email held by any other row (users_email_idx is global, includes
 * soft-deleted rows) -> skipped; unique violation -> skipped (2xx). Never logs emails.
 */
export async function syncClerkUserUpdated(input: ClerkUserUpdatedInput): Promise<{ status: ClerkUserUpdatedStatus }> {
  const clerkUserId = input.clerkUserId.trim();
  const email = input.verifiedPrimaryEmail;
  try {
    return await db.transaction(async (tx) => {
      const linked = await tx.query.users.findFirst({
        where: (t, o) => o.and(o.eq(t.clerkUserId, clerkUserId), o.isNull(t.deletedAt))
      });

      if (linked) {
        if (!email) {
          logger.info({ userId: linked.id }, "Clerk user.updated without a verified primary email; no change");
          return { status: "unchanged" as const };
        }
        if (linked.email === email) return { status: "unchanged" as const };
        const holder = await tx.query.users.findFirst({ where: (t, o) => o.eq(t.email, email) });
        if (holder && holder.id !== linked.id) {
          logger.warn({ userId: linked.id }, "Clerk primary email already belongs to another user; email not synced");
          return { status: "skipped" as const };
        }
        await tx
          .update(users)
          .set({ email, updatedAt: new Date() })
          .where(and(eq(users.id, linked.id), eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)));
        return { status: "updated" as const };
      }

      if (!email) return { status: "not_found" as const };

      // Verified-email linking (restores the path FS-162 disabled for membership payloads).
      const candidate = await tx.query.users.findFirst({ where: (t, o) => o.eq(t.email, email) });
      if (!candidate) return { status: "not_found" as const };
      if (candidate.deletedAt || !candidate.isActive || candidate.clerkUserId) {
        logger.warn({ userId: candidate.id }, "Clerk verified email matches a user that cannot be linked; skipped");
        return { status: "skipped" as const };
      }
      await tx
        .update(users)
        .set({ clerkUserId, updatedAt: new Date() })
        .where(
          and(eq(users.id, candidate.id), isNull(users.clerkUserId), isNull(users.deletedAt), eq(users.isActive, true))
        );
      const reread = await tx.query.users.findFirst({ where: (t, o) => o.eq(t.id, candidate.id) });
      if (reread?.clerkUserId !== clerkUserId) {
        logger.warn({ userId: candidate.id }, "Clerk verified-email link lost a race; skipped");
        return { status: "skipped" as const };
      }
      return { status: "linked" as const };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      logger.warn("Clerk user.updated hit a unique constraint; skipped");
      return { status: "skipped" };
    }
    throw error;
  }
}

/**
 * user.deleted: deactivate the linked user, clear clerk_user_id and revoke refresh tokens. Never deletes rows.
 * Idempotent: a redelivery finds no linked user and returns not_found.
 */
export async function deactivateClerkUser(clerkUserId: string): Promise<{ status: ClerkUserDeactivateStatus }> {
  const id = clerkUserId.trim();
  return db.transaction(async (tx) => {
    const linked = await tx.query.users.findFirst({ where: (t, o) => o.eq(t.clerkUserId, id) });
    if (!linked) return { status: "not_found" as const };
    await tx
      .update(users)
      .set({ isActive: false, clerkUserId: null, updatedAt: new Date() })
      .where(and(eq(users.id, linked.id), eq(users.clerkUserId, id)));
    await revokeRefreshTokens(tx, linked.id);
    logger.info({ userId: linked.id }, "Clerk user deleted; staff user deactivated and unlinked");
    return { status: "deactivated" as const };
  });
}

/**
 * organizationMembership.deleted: deactivate the linked user only if it belongs to the company for that Clerk org.
 * Keeps clerk_user_id (the Clerk identity still exists; is_active=false blocks login). Ambiguous org -> skipped.
 */
export async function deactivateClerkMembership(
  clerkOrganizationId: string,
  clerkUserId: string
): Promise<{ status: ClerkUserDeactivateStatus }> {
  const id = clerkUserId.trim();
  try {
    return await db.transaction(async (tx) => {
      const company = await findCompanyByClerkOrganizationId(clerkOrganizationId, tx);
      if (!company) return { status: "not_found" as const };
      const linked = await tx.query.users.findFirst({
        where: (t, o) => o.and(o.eq(t.clerkUserId, id), o.eq(t.companyId, company.id), o.isNull(t.deletedAt))
      });
      if (!linked) return { status: "not_found" as const };
      if (!linked.isActive) return { status: "deactivated" as const };
      await tx
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(users.id, linked.id), eq(users.companyId, company.id)));
      await revokeRefreshTokens(tx, linked.id);
      logger.info({ userId: linked.id, companyId: company.id }, "Clerk membership deleted; staff user deactivated");
      return { status: "deactivated" as const };
    });
  } catch (error) {
    if (error instanceof ClerkOrganizationAmbiguousError) return { status: "skipped" };
    throw error;
  }
}
