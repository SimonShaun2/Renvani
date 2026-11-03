import { sql } from "drizzle-orm";
import { z } from "zod";

import { clerkWorkspaceIntentEvents, clerkWorkspaceIntents, db } from "@fsm/db";
import { AppError, ErrorCode, type ClerkWorkspaceIntentResponse } from "@fsm/types";

type IntentRow = typeof clerkWorkspaceIntents.$inferSelect;

const deferredWebhookSchema = z.object({
  kind: z.enum(["organization.created", "organizationMembership.created"]),
  svixId: z.string().min(1).max(255),
  organizationId: z.string().min(1).max(255),
  clerkUserId: z.string().min(1).max(255)
});

export type DeferredClerkWorkspaceWebhook = z.infer<typeof deferredWebhookSchema>;
export type ClerkWorkspaceWebhookDecision =
  | { status: "not_applicable" }
  | { status: "ready" }
  | { status: "deferred"; intentId: string; clerkUserId: string }
  | { status: "denied"; reason: "organization_mismatch" };

/**
 * Store an authenticated delivery for a known pre-tenant intent. This is an inbox record,
 * not evidence to create a company: a later worker must verify the Backend API org,
 * reconcile the intent, and check creator membership before consuming it. The intent
 * lock makes a repeated svix id idempotent even across API instances.
 */
export async function deferClerkWorkspaceWebhook(
  input: DeferredClerkWorkspaceWebhook
): Promise<ClerkWorkspaceWebhookDecision> {
  const delivery = deferredWebhookSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clerk-workspace-intent:${delivery.clerkUserId}`}))`);
    const intent = await tx.query.clerkWorkspaceIntents.findFirst({
      where: (table, operators) => operators.and(
        operators.eq(table.clerkUserId, delivery.clerkUserId),
        operators.isNull(table.deletedAt)
      )
    });
    if (!intent) return { status: "not_applicable" };
    const previous = await tx.query.clerkWorkspaceIntentEvents.findMany({
      where: (table, operators) => operators.eq(table.intentId, intent.id)
    });
    const wasRecorded = (eventType: string): boolean => previous.some((event) => {
      const details = event.details;
      return event.eventType === eventType &&
        typeof details === "object" && details !== null &&
        "svixId" in details && details.svixId === delivery.svixId;
    });

    if (intent.status === "reconciled") {
      if (intent.clerkOrganizationId === delivery.organizationId) return { status: "ready" };
      if (!wasRecorded("workspace.webhook_denied")) {
        await tx.insert(clerkWorkspaceIntentEvents).values({
          intentId: intent.id,
          clerkUserId: delivery.clerkUserId,
          eventType: "workspace.webhook_denied",
          details: { ...delivery, reason: "organization_mismatch" }
        });
      }
      return { status: "denied", reason: "organization_mismatch" };
    }

    if (!wasRecorded("workspace.webhook_deferred")) {
      await tx.insert(clerkWorkspaceIntentEvents).values({
        intentId: intent.id,
        clerkUserId: delivery.clerkUserId,
        eventType: "workspace.webhook_deferred",
        details: delivery
      });
    }
    return { status: "deferred", intentId: intent.id, clerkUserId: intent.clerkUserId };
  });
}
function toResponse(row: IntentRow): ClerkWorkspaceIntentResponse {
  if (row.status !== "pending" && row.status !== "claimed" && row.status !== "uncertain" && row.status !== "reconciled")
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Unknown workspace intent state");
  if (row.status === "reconciled" && !row.clerkOrganizationId) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Reconciled workspace intent has no organization");
  }
  return {
    id: row.id,
    requestedName: row.requestedName,
    status: row.status,
    ...(row.clerkOrganizationId ? { organizationId: row.clerkOrganizationId } : {}),
    createdAt: row.createdAt.toISOString()
  };
}
/** The Clerk subject is the sole pre-tenant read scope; no client-supplied user or intent id. */
export async function getClerkWorkspaceIntent(clerkUserId: string): Promise<ClerkWorkspaceIntentResponse | null> {
  const row = await db.query.clerkWorkspaceIntents.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.clerkUserId, clerkUserId),
      operators.isNull(table.deletedAt)
    )
  });
  return row ? toResponse(row) : null;
}

/**
 * Serializes requests for one verified Clerk user across API instances. The durable unique
 * index spans archived intents too: a claimed create may still be in flight after archive.
 * This reservation does not call Clerk or enqueue a worker.
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
      if (existing.deletedAt) {
        throw new AppError(ErrorCode.CONFLICT, "Archived workspace intent requires support review");
      }
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
