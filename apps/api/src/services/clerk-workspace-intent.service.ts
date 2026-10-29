import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { clerkWorkspaceIntentEvents, clerkWorkspaceIntents, db } from "@fsm/db";
import { AppError, ErrorCode, type ClerkWorkspaceIntentResponse } from "@fsm/types";

type IntentRow = typeof clerkWorkspaceIntents.$inferSelect;

const deferredWebhookSchema = z.object({
  kind: z.enum(["organization.created", "organizationMembership.created"]),
  svixId: z.string().min(1).max(255),
  organizationId: z.string().min(1).max(255),
  clerkUserId: z.string().min(1).max(255),
  name: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  clerkOrgRole: z.string().max(100).optional()
});

export type DeferredClerkWorkspaceWebhook = z.infer<typeof deferredWebhookSchema>;

/**
 * Store an authenticated delivery for a known pre-tenant intent. This is an inbox record,
 * not evidence to create a company: a later worker must verify the Backend API org,
 * reconcile the intent, and check creator membership before consuming it. The intent
 * lock makes a repeated svix id idempotent even across API instances.
 */
export async function deferClerkWorkspaceWebhook(input: DeferredClerkWorkspaceWebhook): Promise<boolean> {
  const delivery = deferredWebhookSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clerk-workspace-intent:${delivery.clerkUserId}`}))`);
    const intent = await tx.query.clerkWorkspaceIntents.findFirst({
      where: (table, operators) => operators.eq(table.clerkUserId, delivery.clerkUserId)
    });
    if (!intent || intent.deletedAt) return false;
    const previous = await tx.query.clerkWorkspaceIntentEvents.findMany({
      where: (table, operators) => operators.eq(table.intentId, intent.id)
    });
    if (previous.some((event) => {
      const details = event.details;
      return event.eventType === "workspace.webhook_deferred" &&
        typeof details === "object" && details !== null &&
        "svixId" in details && details.svixId === delivery.svixId;
    })) return true;
    await tx.insert(clerkWorkspaceIntentEvents).values({
      intentId: intent.id,
      clerkUserId: delivery.clerkUserId,
      eventType: "workspace.webhook_deferred",
      details: delivery
    });
    return true;
  });
}

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

/**
 * A normalized Backend API Organization observation. A future adapter must obtain this
 * from Clerk's secret-key API, never browser state or unverified request parameters.
 */
export interface ObservedClerkWorkspaceOrganization {
  id: string;
  createdBy?: string | null;
  privateMetadata?: Record<string, unknown> | null;
}

/** Fail closed on missing creator/marker; a matching name or membership is insufficient. */
export function matchesClerkWorkspaceIntent(
  intent: Pick<IntentRow, "id" | "clerkUserId" | "attemptId" | "clerkOrganizationId">,
  observed: ObservedClerkWorkspaceOrganization
): boolean {
  return Boolean(
    observed.id &&
    intent.attemptId &&
    observed.createdBy === intent.clerkUserId &&
    observed.privateMetadata?.renvaniIntentId === intent.id &&
    observed.privateMetadata?.renvaniAttemptId === intent.attemptId &&
    (!intent.clerkOrganizationId || intent.clerkOrganizationId === observed.id)
  );
}

export interface ObservedClerkWorkspaceMembership {
  organizationId: string;
  clerkUserId: string;
}

export type ClerkWorkspaceCreatorProvisioningDecision =
  | { status: "defer"; reason: "organization_unobserved" | "intent_not_reconciled" | "creator_membership_unobserved" }
  | { status: "deny"; reason: "organization_mismatch" | "membership_mismatch" }
  | { status: "allow"; organizationId: string; clerkUserId: string };

/**
 * Provider-free decision for the initial company/owner grant. Inputs must come from a
 * verified Clerk Backend API organization observation and authenticated webhook data.
 * A deferred event needs durable retry or storage before this can be used by the live
 * webhook handler. A membership arriving first must never choose the owner by order.
 */
export function evaluateClerkWorkspaceCreatorProvisioning(
  intent: Pick<IntentRow, "id" | "clerkUserId" | "attemptId" | "status" | "clerkOrganizationId">,
  observed: ObservedClerkWorkspaceOrganization | null,
  membership: ObservedClerkWorkspaceMembership | null
): ClerkWorkspaceCreatorProvisioningDecision {
  if (!observed) return { status: "defer", reason: "organization_unobserved" };
  if (!matchesClerkWorkspaceIntent(intent, observed)) return { status: "deny", reason: "organization_mismatch" };
  if (intent.status !== "reconciled" || intent.clerkOrganizationId !== observed.id) {
    return { status: "defer", reason: "intent_not_reconciled" };
  }
  if (!membership) return { status: "defer", reason: "creator_membership_unobserved" };
  if (membership.organizationId !== observed.id || membership.clerkUserId !== intent.clerkUserId) {
    return { status: "deny", reason: "membership_mismatch" };
  }
  return { status: "allow", organizationId: observed.id, clerkUserId: intent.clerkUserId };
}

/**
 * Reconcile an uncertain or claimed create outcome from a verified Backend API observation.
 * This binds only the intent to an org. It does not create a company or grant owner access.
 * Two different matching orgs cannot both bind: the compare-and-set and unique org index
 * leave the second observation in explicit conflict for operator review.
 */
export async function reconcileObservedClerkWorkspaceOrganization(
  clerkUserId: string,
  observed: ObservedClerkWorkspaceOrganization
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const intent = await tx.query.clerkWorkspaceIntents.findFirst({
      where: (table, operators) => operators.eq(table.clerkUserId, clerkUserId)
    });
    if (!intent || !intent.attemptId || !matchesClerkWorkspaceIntent(intent, observed)) {
      throw new AppError(ErrorCode.CONFLICT, "Clerk organization does not match workspace intent");
    }
    if (intent.status === "reconciled") return false;
    const [changed] = await tx.update(clerkWorkspaceIntents)
      .set({ status: "reconciled", clerkOrganizationId: observed.id, updatedAt: new Date() })
      .where(and(
        eq(clerkWorkspaceIntents.id, intent.id),
        eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
        eq(clerkWorkspaceIntents.attemptId, intent.attemptId),
        inArray(clerkWorkspaceIntents.status, ["claimed", "uncertain"]),
        isNull(clerkWorkspaceIntents.clerkOrganizationId),
        isNull(clerkWorkspaceIntents.deletedAt)
      ))
      .returning();
    if (!changed) {
      const current = await tx.query.clerkWorkspaceIntents.findFirst({
        where: (table, operators) => operators.eq(table.clerkUserId, clerkUserId)
      });
      if (current?.status === "reconciled" && current.clerkOrganizationId === observed.id) return false;
      throw new AppError(ErrorCode.CONFLICT, "Workspace intent was reconciled differently");
    }
    await tx.insert(clerkWorkspaceIntentEvents).values({
      intentId: changed.id,
      clerkUserId,
      eventType: "workspace.organization_reconciled",
      details: { attemptId: intent.attemptId, clerkOrganizationId: observed.id }
    });
    return true;
  });
}
