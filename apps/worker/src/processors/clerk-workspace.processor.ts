import { randomUUID } from "node:crypto";

import { createClerkClient } from "@clerk/backend";
import type { Job, Processor } from "bullmq";
import { and, eq, inArray, isNull } from "drizzle-orm";
import pino from "pino";

import { env } from "@fsm/config";
import { clerkWorkspaceIntentEvents, clerkWorkspaceIntents, db } from "@fsm/db";
import {
  CLERK_WORKSPACE_CREATE_JOB_NAME,
  CLERK_WORKSPACE_RECONCILE_JOB_NAME,
  ClerkWorkspaceJobPayloadSchema,
  enqueueClerkWorkspaceReconcileJob,
  type ClerkWorkspaceJobPayload
} from "@fsm/jobs";

const logger = pino({ name: "clerk-workspace-processor" });
const MEMBERSHIP_PAGE_SIZE = 100;

type WorkspaceIntentStatus = "pending" | "claimed" | "uncertain" | "reconciled";

export interface ClerkWorkspaceIntentSnapshot {
  id: string;
  clerkUserId: string;
  requestedName: string;
  status: WorkspaceIntentStatus;
  attemptId: string | null;
  clerkOrganizationId: string | null;
}

export interface ClaimedClerkWorkspaceIntent extends ClerkWorkspaceIntentSnapshot {
  status: "claimed";
  attemptId: string;
}

export interface ClerkWorkspaceOrganizationObservation {
  id: string;
  createdBy: string | null;
  privateMetadata: Record<string, unknown>;
}

export interface ClerkWorkspaceProvider {
  createOrganization(input: {
    name: string;
    createdBy: string;
    privateMetadata: { renvaniIntentId: string; renvaniAttemptId: string };
  }): Promise<ClerkWorkspaceOrganizationObservation>;
  listUserMembershipOrganizationIds(input: {
    clerkUserId: string;
    limit: number;
    offset: number;
  }): Promise<{ organizationIds: string[]; totalCount: number }>;
  getOrganization(organizationId: string): Promise<ClerkWorkspaceOrganizationObservation>;
}

export interface ClerkWorkspaceIntentRepository {
  claim(intentId: string, clerkUserId: string): Promise<ClaimedClerkWorkspaceIntent | null>;
  get(intentId: string, clerkUserId: string): Promise<ClerkWorkspaceIntentSnapshot | null>;
  markUncertain(intentId: string, clerkUserId: string, attemptId: string, reason: string): Promise<void>;
  reconcile(
    intentId: string,
    clerkUserId: string,
    attemptId: string,
    organizationId: string
  ): Promise<void>;
}

export interface ClerkWorkspaceProcessorDependencies {
  provider: ClerkWorkspaceProvider;
  repository: ClerkWorkspaceIntentRepository;
}

function asStatus(value: string): WorkspaceIntentStatus {
  if (value === "pending" || value === "claimed" || value === "uncertain" || value === "reconciled") {
    return value;
  }
  throw new Error(`Unknown Clerk workspace intent status: ${value}`);
}

function toSnapshot(row: typeof clerkWorkspaceIntents.$inferSelect): ClerkWorkspaceIntentSnapshot {
  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    requestedName: row.requestedName,
    status: asStatus(row.status),
    attemptId: row.attemptId,
    clerkOrganizationId: row.clerkOrganizationId
  };
}

export const databaseClerkWorkspaceIntentRepository: ClerkWorkspaceIntentRepository = {
  async claim(intentId, clerkUserId) {
    const attemptId = randomUUID();
    return db.transaction(async (tx) => {
      const [claimed] = await tx.update(clerkWorkspaceIntents)
        .set({ status: "claimed", attemptId, claimedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(clerkWorkspaceIntents.id, intentId),
          eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
          eq(clerkWorkspaceIntents.status, "pending"),
          isNull(clerkWorkspaceIntents.deletedAt)
        ))
        .returning();
      if (!claimed) {
        const existing = await tx.query.clerkWorkspaceIntents.findFirst({
          where: and(
            eq(clerkWorkspaceIntents.id, intentId),
            eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
            isNull(clerkWorkspaceIntents.deletedAt)
          )
        });
        if (!existing) throw new Error("Clerk workspace intent not found");
        asStatus(existing.status);
        return null;
      }
      await tx.insert(clerkWorkspaceIntentEvents).values({
        intentId: claimed.id,
        clerkUserId,
        eventType: "workspace.attempt_claimed",
        details: { attemptId }
      });
      return { ...toSnapshot(claimed), status: "claimed", attemptId };
    });
  },

  async get(intentId, clerkUserId) {
    const row = await db.query.clerkWorkspaceIntents.findFirst({
      where: and(
        eq(clerkWorkspaceIntents.id, intentId),
        eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
        isNull(clerkWorkspaceIntents.deletedAt)
      )
    });
    return row ? toSnapshot(row) : null;
  },

  async markUncertain(intentId, clerkUserId, attemptId, reason) {
    await db.transaction(async (tx) => {
      const [changed] = await tx.update(clerkWorkspaceIntents)
        .set({ status: "uncertain", uncertainAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(clerkWorkspaceIntents.id, intentId),
          eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
          eq(clerkWorkspaceIntents.attemptId, attemptId),
          eq(clerkWorkspaceIntents.status, "claimed"),
          isNull(clerkWorkspaceIntents.deletedAt)
        ))
        .returning();
      if (!changed) {
        const current = await tx.query.clerkWorkspaceIntents.findFirst({
          where: and(
            eq(clerkWorkspaceIntents.id, intentId),
            eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
            isNull(clerkWorkspaceIntents.deletedAt)
          )
        });
        if (current?.attemptId === attemptId && current.status === "uncertain") return;
        throw new Error("Clerk workspace attempt cannot be marked uncertain");
      }
      await tx.insert(clerkWorkspaceIntentEvents).values({
        intentId,
        clerkUserId,
        eventType: "workspace.attempt_uncertain",
        details: { attemptId, reason }
      });
    });
  },

  async reconcile(intentId, clerkUserId, attemptId, organizationId) {
    await db.transaction(async (tx) => {
      const [changed] = await tx.update(clerkWorkspaceIntents)
        .set({ status: "reconciled", clerkOrganizationId: organizationId, updatedAt: new Date() })
        .where(and(
          eq(clerkWorkspaceIntents.id, intentId),
          eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
          eq(clerkWorkspaceIntents.attemptId, attemptId),
          inArray(clerkWorkspaceIntents.status, ["claimed", "uncertain"]),
          isNull(clerkWorkspaceIntents.clerkOrganizationId),
          isNull(clerkWorkspaceIntents.deletedAt)
        ))
        .returning();
      if (!changed) {
        const current = await tx.query.clerkWorkspaceIntents.findFirst({
          where: and(
            eq(clerkWorkspaceIntents.id, intentId),
            eq(clerkWorkspaceIntents.clerkUserId, clerkUserId),
            isNull(clerkWorkspaceIntents.deletedAt)
          )
        });
        if (
          current?.status === "reconciled" &&
          current.attemptId === attemptId &&
          current.clerkOrganizationId === organizationId
        ) return;
        throw new Error("Clerk workspace intent was reconciled differently");
      }
      await tx.insert(clerkWorkspaceIntentEvents).values({
        intentId,
        clerkUserId,
        eventType: "workspace.organization_reconciled",
        details: { attemptId, clerkOrganizationId: organizationId }
      });
    });
  }
};

function clerkClient() {
  const secretKey = env.CLERK_SECRET_KEY.trim();
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is required for workspace provisioning");
  return createClerkClient({ secretKey });
}

function normalizeOrganization(organization: {
  id: string;
  createdBy?: string | undefined;
  privateMetadata: Record<string, unknown>;
}): ClerkWorkspaceOrganizationObservation {
  return {
    id: organization.id,
    createdBy: organization.createdBy ?? null,
    privateMetadata: { ...organization.privateMetadata }
  };
}

const clerkProvider: ClerkWorkspaceProvider = {
  async createOrganization(input) {
    const organization = await clerkClient().organizations.createOrganization(input);
    return normalizeOrganization(organization);
  },

  async listUserMembershipOrganizationIds(input) {
    const result = await clerkClient().users.getOrganizationMembershipList({
      userId: input.clerkUserId,
      limit: input.limit,
      offset: input.offset
    });
    return {
      organizationIds: result.data.map((membership) => membership.organization.id),
      totalCount: result.totalCount
    };
  },

  async getOrganization(organizationId) {
    const organization = await clerkClient().organizations.getOrganization({ organizationId });
    return normalizeOrganization(organization);
  }
};

const defaultDependencies: ClerkWorkspaceProcessorDependencies = {
  provider: clerkProvider,
  repository: databaseClerkWorkspaceIntentRepository
};

function observationMatches(
  intent: Pick<ClerkWorkspaceIntentSnapshot, "id" | "clerkUserId" | "attemptId">,
  organization: ClerkWorkspaceOrganizationObservation
): boolean {
  return Boolean(
    intent.attemptId &&
    organization.createdBy === intent.clerkUserId &&
    organization.privateMetadata.renvaniIntentId === intent.id &&
    organization.privateMetadata.renvaniAttemptId === intent.attemptId
  );
}

export async function processClerkWorkspaceCreate(
  payload: ClerkWorkspaceJobPayload,
  dependencies: ClerkWorkspaceProcessorDependencies = defaultDependencies
): Promise<void> {
  const input = ClerkWorkspaceJobPayloadSchema.parse(payload);
  const intent = await dependencies.repository.claim(input.intentId, input.clerkUserId);
  if (!intent) return;

  let uncertainReason = "provider_outcome_unknown";
  try {
    const organization = await dependencies.provider.createOrganization({
      name: intent.requestedName,
      createdBy: intent.clerkUserId,
      privateMetadata: {
        renvaniIntentId: intent.id,
        renvaniAttemptId: intent.attemptId
      }
    });
    if (!observationMatches(intent, organization)) {
      uncertainReason = "provider_observation_mismatch";
      throw new Error("Clerk create response did not match the claimed workspace intent");
    }
    await dependencies.repository.reconcile(intent.id, intent.clerkUserId, intent.attemptId, organization.id);
  } catch (error) {
    await dependencies.repository.markUncertain(intent.id, intent.clerkUserId, intent.attemptId, uncertainReason);
    await enqueueClerkWorkspaceReconcileJob({ intentId: intent.id, clerkUserId: intent.clerkUserId });
    throw error;
  }
}

export async function processClerkWorkspaceReconcile(
  payload: ClerkWorkspaceJobPayload,
  dependencies: ClerkWorkspaceProcessorDependencies = defaultDependencies
): Promise<void> {
  const input = ClerkWorkspaceJobPayloadSchema.parse(payload);
  const intent = await dependencies.repository.get(input.intentId, input.clerkUserId);
  if (!intent) throw new Error("Clerk workspace intent not found");
  if (intent.status === "reconciled") return;
  if (!intent.attemptId || (intent.status !== "claimed" && intent.status !== "uncertain")) {
    throw new Error("Clerk workspace intent is not ready for reconciliation");
  }

  const organizationIds = new Set<string>();
  let offset = 0;
  for (;;) {
    const page = await dependencies.provider.listUserMembershipOrganizationIds({
      clerkUserId: intent.clerkUserId,
      limit: MEMBERSHIP_PAGE_SIZE,
      offset
    });
    for (const organizationId of page.organizationIds) organizationIds.add(organizationId);
    offset += page.organizationIds.length;
    if (offset >= page.totalCount) break;
    if (page.organizationIds.length === 0) {
      throw new Error("Clerk membership pagination returned an incomplete empty page");
    }
  }

  const matches: ClerkWorkspaceOrganizationObservation[] = [];
  for (const organizationId of organizationIds) {
    const organization = await dependencies.provider.getOrganization(organizationId);
    if (observationMatches(intent, organization)) matches.push(organization);
  }
  if (matches.length === 0) throw new Error("No Clerk organization matches the workspace intent markers");
  if (matches.length > 1) throw new Error("Multiple Clerk organizations match one workspace intent");

  await dependencies.repository.reconcile(intent.id, intent.clerkUserId, intent.attemptId, matches[0]!.id);
}

export function createClerkWorkspaceProcessor(
  dependencies: ClerkWorkspaceProcessorDependencies = defaultDependencies
): Processor<Record<string, unknown>, void, string> {
  return async (job: Job<Record<string, unknown>, void, string>) => {
    if (job.name === CLERK_WORKSPACE_CREATE_JOB_NAME) {
      await processClerkWorkspaceCreate(ClerkWorkspaceJobPayloadSchema.parse(job.data), dependencies);
      return;
    }
    if (job.name === CLERK_WORKSPACE_RECONCILE_JOB_NAME) {
      await processClerkWorkspaceReconcile(ClerkWorkspaceJobPayloadSchema.parse(job.data), dependencies);
    }
  };
}

export const processClerkWorkspace = createClerkWorkspaceProcessor();

logger.debug({ queue: "webhooks" }, "Clerk workspace processor loaded");
