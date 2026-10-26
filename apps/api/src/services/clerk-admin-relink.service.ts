import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { db, users } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

export const relinkAuditLogger = pino({ name: "clerk-admin-relink" });
const logger = relinkAuditLogger;

export interface AdminRelinkClerkUserInput {
  /** From the auth context only, never from the request. */
  companyId: string;
  actorUserId: string;
  targetUserId: string;
  clerkUserId: string;
  /** Required when the target is already linked to a DIFFERENT Clerk id. */
  confirmOverwrite: boolean;
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

function conflict(): AppError {
  return new AppError(ErrorCode.CONFLICT, "Clerk user id is already linked to another user");
}

/**
 * FS-165: owner/admin relink of a staff user to a Clerk user id. The only path that clears the
 * users.clerk_unlinked_at tombstone. Sets clerk_user_id and reactivates the user; revokes nothing.
 * Audit: a structured `audit: "clerk_user_relinked"` log line with ids only (activity_event_type has no
 * user-identity value, and adding one needs a migration).
 */
export async function adminRelinkClerkUser(input: AdminRelinkClerkUserInput): Promise<AdminRelinkClerkUserResult> {
  const clerkUserId = input.clerkUserId.trim();
  try {
    return await db.transaction(async (tx) => {
      const target = await tx.query.users.findFirst({
        where: (t, o) => o.and(o.eq(t.id, input.targetUserId), o.eq(t.companyId, input.companyId), o.isNull(t.deletedAt))
      });
      // Other company, soft-deleted or missing: same 404, no leak.
      if (!target) throw new AppError(ErrorCode.NOT_FOUND, "User not found");

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
        throw new AppError(
          ErrorCode.CONFLICT,
          "User is already linked to a different Clerk user id; resend with confirmOverwrite: true to replace it"
        );
      }

      if (previousClerkUserId === clerkUserId && !target.clerkUnlinkedAt && target.isActive) {
        return { status: "unchanged" as const, overwrotePreviousClerkId: false };
      }

      await tx
        .update(users)
        .set({ clerkUserId, clerkUnlinkedAt: null, isActive: true, updatedAt: new Date() })
        .where(and(eq(users.id, target.id), eq(users.companyId, input.companyId), isNull(users.deletedAt)));

      const audit = {
        audit: "clerk_user_relinked",
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        targetUserId: target.id,
        newClerkUserId: clerkUserId,
        tombstoneCleared: wasTombstoned,
        reactivated: !wasActive,
        overwrotePreviousClerkId: overwrote,
        ...(overwrote ? { previousClerkUserId } : {})
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
