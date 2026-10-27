import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { refreshTokens, users } from "@fsm/db";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";

export const relinkAuditLogger = pino({ name: "clerk-admin-relink" });
const logger = relinkAuditLogger;

const PRIVILEGED_ROLES: readonly string[] = ["owner", "admin"];

export interface AdminRelinkClerkUserInput {
  /** From the auth context only, never from the request. */
  companyId: string;
  actorUserId: string;
  actorRole: UserRole;
  targetUserId: string;
  clerkUserId: string;
  /** Required when the target is already linked to a DIFFERENT Clerk id. */
  confirmOverwrite: boolean;
  /** The only way this route reactivates a user; active status is otherwise left unchanged. */
  reactivate: boolean;
}

export interface AdminRelinkClerkUserResult {
  status: "relinked" | "unchanged";
  overwrotePreviousClerkId: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function conflict(message = "Clerk user id is already linked to another user"): AppError {
  return new AppError(ErrorCode.CONFLICT, message);
}

/**
 * FS-165: relink a staff user to a Clerk user id. The only path that clears the users.clerk_unlinked_at tombstone.
 * - Role rules (account-takeover guard): only an owner may relink an owner/admin target; admins may relink only
 *   lower roles; nobody may relink themselves.
 * - Active status is unchanged unless `reactivate` is true.
 * - The UPDATE is guarded by the clerk_user_id read in this transaction (null-safe), so a concurrent change -> 409.
 * - Overwriting a DIFFERENT existing clerk id revokes the user's refresh tokens (sessions minted for the old identity).
 * Audit: a structured `audit: "clerk_user_relinked"` log line with ids only (activity_event_type has no
 * user-identity value, and adding one needs a migration).
 */
export async function adminRelinkClerkUser(input: AdminRelinkClerkUserInput): Promise<AdminRelinkClerkUserResult> {
  const clerkUserId = input.clerkUserId.trim();
  if (input.actorUserId === input.targetUserId) {
    throw new AppError(ErrorCode.FORBIDDEN, "You cannot relink your own Clerk identity");
  }
  try {
    return await runTenantAwareTransaction(input.companyId, async (tx) => {
      const target = await tx.query.users.findFirst({
        where: (t, o) => o.and(o.eq(t.id, input.targetUserId), o.eq(t.companyId, input.companyId), o.isNull(t.deletedAt))
      });
      // Other company, soft-deleted or missing: same 404, no leak.
      if (!target) throw new AppError(ErrorCode.NOT_FOUND, "User not found");

      if (PRIVILEGED_ROLES.includes(target.role) && input.actorRole !== "owner") {
        throw new AppError(ErrorCode.FORBIDDEN, "Only an owner can relink an owner or admin");
      }

      const holder = await tx.query.users.findFirst({ where: (t, o) => o.eq(t.clerkUserId, clerkUserId) });
      if (holder && holder.id !== target.id) {
        logger.warn(
          { companyId: input.companyId, actorUserId: input.actorUserId, targetUserId: target.id },
          "Admin Clerk relink rejected: Clerk id already linked to another user"
        );
        throw conflict();
      }

      const previousClerkUserId = target.clerkUserId ?? null;
      const wasTombstoned = Boolean(target.clerkUnlinkedAt);
      const wasActive = target.isActive;
      const overwrote = previousClerkUserId !== null && previousClerkUserId !== clerkUserId;
      if (overwrote && !input.confirmOverwrite) {
        throw conflict(
          "User is already linked to a different Clerk user id; resend with confirmOverwrite: true to replace it"
        );
      }

      const willReactivate = input.reactivate && !wasActive;
      if (previousClerkUserId === clerkUserId && !wasTombstoned && !willReactivate) {
        return { status: "unchanged" as const, overwrotePreviousClerkId: false };
      }

      const updated = await tx
        .update(users)
        .set({
          clerkUserId,
          clerkUnlinkedAt: null,
          ...(willReactivate ? { isActive: true } : {}),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(users.id, target.id),
            eq(users.companyId, input.companyId),
            isNull(users.deletedAt),
            // Null-safe "IS NOT DISTINCT FROM" the value read above: a concurrent relink/unlink -> 0 rows -> 409.
            previousClerkUserId === null ? isNull(users.clerkUserId) : eq(users.clerkUserId, previousClerkUserId)
          )
        )
        .returning({ id: users.id });
      if (updated.length !== 1) {
        throw conflict("User's Clerk link changed concurrently; reload and retry");
      }

      if (overwrote) {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.userId, target.id), isNull(refreshTokens.revokedAt)));
      }

      const audit = {
        audit: "clerk_user_relinked",
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        targetUserId: target.id,
        newClerkUserId: clerkUserId,
        tombstoneCleared: wasTombstoned,
        reactivated: willReactivate,
        overwrotePreviousClerkId: overwrote,
        ...(overwrote ? { previousClerkUserId, refreshTokensRevoked: true } : {})
      };
      if (overwrote) {
        logger.warn(audit, "Admin Clerk relink overwrote a different existing Clerk user id");
      } else {
        logger.info(audit, "Admin Clerk relink");
      }
      return { status: "relinked" as const, overwrotePreviousClerkId: overwrote };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict();
    throw error;
  }
}
