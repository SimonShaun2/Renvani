import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { clerkWorkspaceIntentEvents, clerkWorkspaceIntents, db } from "@fsm/db";
import { AppError, ErrorCode, type ClerkWorkspaceIntentResponse } from "@fsm/types";

type IntentRow = typeof clerkWorkspaceIntents.$inferSelect;

function toResponse(row: IntentRow): ClerkWorkspaceIntentResponse {
  if (row.status !== "pending" && row.status !== "claimed" && row.status !== "uncertain" && row.status !== "reconciled")
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Unknown workspace intent state");
  return {
    id: row.id,
    requestedName: row.requestedName,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  };
}

/** The Clerk subject is the sole pre-tenant read scope; no client-supplied user or intent id. */
export async function getClerkWorkspaceIntent(clerkUserId: string): Promise<ClerkWorkspaceIntentResponse | null> {
  const row = await db.query.clerkWorkspaceIntents.findFirst({
    where: (table, operators) => operators.eq(table.clerkUserId, clerkUserId)
  });
  return row ? toResponse(row) : null;
}

/**
 * Serializes requests for one verified Clerk user across API instances. The durable unique
 * index is the final guard; this reservation does not call Clerk or enqueue a worker.
 */
export async function reserveClerkWorkspaceIntent(
  clerkUserId: string,
  requestedName: string
): Promise<ClerkWorkspaceIntentResponse> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clerk-workspace-intent:${clerkUserId}`}))`);
    const existing = await tx.query.clerkWorkspaceIntents.findFirst({
      where: (table, operators) => operators.eq(table.clerkUserId, clerkUserId)
    });
    if (existing) {
      if (existing.requestedName !== requestedName) {
        throw new AppError(ErrorCode.CONFLICT, "Workspace name differs from the existing reservation");
      }
      return toResponse(existing);
    }

    const [created] = await tx.insert(clerkWorkspaceIntents).values({
      clerkUserId,
      requestedName,
      status: "pending"
    }).returning();
    if (!created) throw new AppError(ErrorCode.INTERNAL_ERROR, "Workspace reservation failed");
    await tx.insert(clerkWorkspaceIntentEvents).values({
      intentId: created.id,
      clerkUserId,
      eventType: "workspace.intent_pending",
      details: { requestedName }
    });
    return toResponse(created);
  });
}

export type ClerkWorkspaceAttemptClaim =
  | { newlyClaimed: true; attemptId: string; intentId: string }
  | { newlyClaimed: false; status: ClerkWorkspaceIntentResponse["status"] };

/**
 * The only authorization for a future worker to make its one outbound create call.
 * A successful compare-and-set commits the attempt marker and audit before returning.
 * Repeated claims, including after a worker crash, never return newlyClaimed=true.
 */
export async function claimClerkWorkspaceCreateAttempt(clerkUserId: string): Promise<ClerkWorkspaceAttemptClaim> {
  const attemptId = randomUUID();
  return db.transaction(async (tx) => {
    const [claimed] = await tx.update(clerkWorkspaceIntents)
      .set({ status: "claimed", attemptId, claimedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
        eq(clerkWorkspaceIntents.status, "pending"),
        isNull(clerkWorkspaceIntents.deletedAt)
      ))
      .returning();
    if (!claimed) {
      const existing = await tx.query.clerkWorkspaceIntents.findFirst({
        where: (table, operators) => operators.eq(table.clerkUserId, clerkUserId)
      });
      if (!existing) throw new AppError(ErrorCode.NOT_FOUND, "Workspace intent not found");
      return { newlyClaimed: false, status: toResponse(existing).status };
    }
    await tx.insert(clerkWorkspaceIntentEvents).values({
      intentId: claimed.id,
      clerkUserId,
      eventType: "workspace.attempt_claimed",
      details: { attemptId }
    });
    return { newlyClaimed: true, attemptId, intentId: claimed.id };
  });
}

/** Unknown Clerk outcome: record uncertainty, but never rearm the attempt. */
export async function markClerkWorkspaceAttemptUncertain(
  clerkUserId: string,
  attemptId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [changed] = await tx.update(clerkWorkspaceIntents)
      .set({ status: "uncertain", uncertainAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
        eq(clerkWorkspaceIntents.attemptId, attemptId),
        eq(clerkWorkspaceIntents.status, "claimed"),
        isNull(clerkWorkspaceIntents.deletedAt)
      ))
      .returning();
    if (!changed) {
      const existing = await tx.query.clerkWorkspaceIntents.findFirst({
        where: (table, operators) => operators.eq(table.clerkUserId, clerkUserId)
      });
      if (existing?.attemptId === attemptId && existing.status === "uncertain") return false;
      throw new AppError(ErrorCode.CONFLICT, "Workspace attempt cannot be marked uncertain");
    }
    await tx.insert(clerkWorkspaceIntentEvents).values({
      intentId: changed.id,
      clerkUserId,
      eventType: "workspace.attempt_uncertain",
      details: { attemptId }
    });
    return true;
  });
}
