import { sql } from "drizzle-orm";

import { clerkWorkspaceIntentEvents, clerkWorkspaceIntents, db } from "@fsm/db";
import { AppError, ErrorCode, type ClerkWorkspaceIntentResponse } from "@fsm/types";

type IntentRow = typeof clerkWorkspaceIntents.$inferSelect;

function toResponse(row: IntentRow): ClerkWorkspaceIntentResponse {
  if (row.status !== "reserved") {
    // Future worker states need an explicit versioned response contract before exposure.
    throw new AppError(ErrorCode.CONFLICT, "Workspace creation is awaiting reconciliation");
  }
  return {
    id: row.id,
    requestedName: row.requestedName,
    status: "reserved",
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
      status: "reserved"
    }).returning();
    if (!created) throw new AppError(ErrorCode.INTERNAL_ERROR, "Workspace reservation failed");
    await tx.insert(clerkWorkspaceIntentEvents).values({
      intentId: created.id,
      clerkUserId,
      eventType: "workspace.intent_reserved",
      details: { requestedName }
    });
    return toResponse(created);
  });
}
