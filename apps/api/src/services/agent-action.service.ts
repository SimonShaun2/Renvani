import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { agentActions, db } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type AgentActionStateV1,
  type CanonicalEntityRefV1,
  assertAgentActionApprovable,
  assertAgentActionExecutable,
  assertAgentActionRejectable,
  assertAgentActionTenantScope,
  assertActionTypeMatchesToolName,
  agentActionExpiredError,
  agentActionStaleTargetError,
  AgentToolNameV1Schema,
  assertIdempotencyPayloadMatches,
  evaluateAgentActionPolicyDecision,
  isAgentActionExpired,
  isStaleRecordVersion,
  type AgentToolNameV1
} from "@fsm/types";

import {
  assertActionAllowedForProduct,
  assertPolicyVersion,
  isAgentActionEditable,
  requiresHumanApproval
} from "./agent-action.policy.js";
import { getAgentActionExecutor } from "./agent-action.executors.js";
import { resolveEntityRef } from "./tenant-context.service.js";
import {
  emitAgentActionAuditEvent,
  mirrorAgentActionAuditToLangfuse
} from "./agent-action-audit.js";

const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;

type SelectExecutor = Pick<typeof db, "select">;
type AgentActionWriteExecutor = Pick<typeof db, "select" | "insert">;
export function agentActionScopedWhere(companyId: string, actionId: string) {
  return and(
    eq(agentActions.id, actionId),
    eq(agentActions.companyId, companyId),
    isNull(agentActions.deletedAt)
  );
}

export type AgentActionState = AgentActionStateV1;

export interface CreateAgentActionInput {
  companyId: string;
  actorId: string;
  actorType: "user" | "system" | "ai" | "customer";
  agentProduct: "revenue" | "scheduling" | "service" | "retention" | "owner" | "loyalty";
  actionType: string;
  parameters: Record<string, unknown>;
  target: CanonicalEntityRefV1;
  idempotencyKey: string;
  policyVersion: string;
  sourceEventIds?: string[];
  confidence?: number;
  reason?: string;
  expiresAt?: Date;
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function mapRow(row: typeof agentActions.$inferSelect) {
  return {
    id: row.id,
    companyId: row.companyId,
    agentProduct: row.agentProduct,
    actionType: row.actionType,
    parameters: row.parameters as Record<string, unknown>,
    target: row.target as CanonicalEntityRefV1,
    sourceEventIds: row.sourceEventIds,
    idempotencyKey: row.idempotencyKey,
    policyVersion: row.policyVersion,
    requiresApproval: row.requiresApproval,
    state: row.state as AgentActionState,
    confidence: row.confidence,
    reason: row.reason,
    expiresAt: row.expiresAt.toISOString(),
    reviewerId: row.reviewerId,
    approvedParameters: (row.approvedParameters as Record<string, unknown> | null) ?? null,
    executionReceipt: row.executionReceipt as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toLifecycleSlice(row: typeof agentActions.$inferSelect) {
  return {
    companyId: row.companyId,
    state: row.state as AgentActionState,
    actionType: row.actionType,
    requiresApproval: row.requiresApproval,
    expiresAt: row.expiresAt
  };
}

async function getActionRow(companyId: string, actionId: string, executor: SelectExecutor = db) {
  const [row] = await executor
    .select()
    .from(agentActions)
    .where(agentActionScopedWhere(companyId, actionId))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Agent action not found");
  }

  assertAgentActionTenantScope(companyId, row.companyId);

  return row;
}

async function persistTerminalExpiredState(companyId: string, actionId: string): Promise<void> {
  await db
    .update(agentActions)
    .set({ state: "expired", updatedAt: new Date() })
    .where(agentActionScopedWhere(companyId, actionId));
}

function resolveProposalPolicy(input: CreateAgentActionInput) {
  if (AgentToolNameV1Schema.safeParse(input.actionType).success) {
    assertActionTypeMatchesToolName(input.actionType as AgentToolNameV1, input.parameters);
    return evaluateAgentActionPolicyDecision({
      agentProduct: input.agentProduct,
      actionType: input.actionType,
      actorType: input.actorType,
      policyVersion: input.policyVersion,
      requiresApproval: requiresHumanApproval(input.actionType)
    });
  }

  const needsApproval = requiresHumanApproval(input.actionType);
  return {
    initialState: (needsApproval ? "awaiting_approval" : "policy_evaluated") as AgentActionState,
    requiresApproval: needsApproval,
    allowsAutoExecute: false
  };
}

async function createAgentActionProposalInTransaction(
  tx: AgentActionWriteExecutor,
  input: CreateAgentActionInput
) {
  assertPolicyVersion(input.policyVersion);
  assertActionAllowedForProduct(input.agentProduct, input.actionType, input.actorType);

  const payloadHash = hashPayload({
    actionType: input.actionType,
    parameters: input.parameters,
    target: input.target
  });

  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS);
  const policyDecision = resolveProposalPolicy(input);

  const [existing] = await tx
    .select()
    .from(agentActions)
    .where(
      and(
        eq(agentActions.companyId, input.companyId),
        eq(agentActions.idempotencyKey, input.idempotencyKey),
        isNull(agentActions.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    assertIdempotencyPayloadMatches(existing.payloadHash, {
      companyId: input.companyId,
      idempotencyKey: input.idempotencyKey,
      payloadFingerprint: payloadHash
    });
    return mapRow(existing);
  }

  const insertedRows = await tx
    .insert(agentActions)
    .values({
      companyId: input.companyId,
      agentProduct: input.agentProduct,
      actionType: input.actionType,
      parameters: input.parameters,
      target: input.target,
      sourceEventIds: input.sourceEventIds ?? [],
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      policyVersion: input.policyVersion,
      requiresApproval: policyDecision.requiresApproval,
      state: policyDecision.initialState as AgentActionState,
      confidence: input.confidence?.toString(),
      reason: input.reason,
      expiresAt
    })
    .returning();

  const inserted = insertedRows[0];
  if (!inserted) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create agent action");
  }

  await emitAgentActionAuditEvent(tx, {
    companyId: input.companyId,
    lifecycle: "proposal_created",
    row: inserted,
    actorId: input.actorId,
    actorType: input.actorType,
    summary: `Agent proposal created (${input.actionType})`,
    detail: {
      actionType: input.actionType,
      agentProduct: input.agentProduct,
      state: inserted.state
    }
  });

  return mapRow(inserted);
}

export async function createAgentActionProposal(
  input: CreateAgentActionInput,
  existingTx?: AgentActionWriteExecutor
) {
  if (existingTx) {
    return createAgentActionProposalInTransaction(existingTx, input);
  }

  const created = await db.transaction((tx) => createAgentActionProposalInTransaction(tx, input));
  await mirrorAgentActionAuditToLangfuse({
    companyId: input.companyId,
    lifecycle: "proposal_created",
    row: {
      id: created.id,
      agentProduct: created.agentProduct,
      actionType: created.actionType,
      policyVersion: created.policyVersion,
      requiresApproval: created.requiresApproval
    },
    actorId: input.actorId,
    actorType: input.actorType,
    summary: `Agent proposal created (${input.actionType})`,
    detail: {
      actionType: input.actionType,
      agentProduct: input.agentProduct,
      state: created.state
    }
  });
  return created;
}

export async function listAgentActions(
  companyId: string,
  filters: { state?: AgentActionState; agentProduct?: string }
) {
  const rows = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.companyId, companyId), isNull(agentActions.deletedAt)));

  return rows
    .filter((row) => (filters.state ? row.state === filters.state : true))
    .filter((row) => (filters.agentProduct ? row.agentProduct === filters.agentProduct : true))
    .map(mapRow);
}

export async function approveAgentAction(companyId: string, actionId: string, reviewerId: string) {
  let persistExpiredAfterRollback = false;

  try {
    const mapped = await db.transaction(async (tx) => {
      const row = await getActionRow(companyId, actionId, tx);

      assertAgentActionApprovable(toLifecycleSlice(row));

      if (isAgentActionExpired(row.expiresAt)) {
        persistExpiredAfterRollback = true;
        throw agentActionExpiredError();
      }

      const approvedParameters = (row.parameters as Record<string, unknown>) ?? {};

      const updatedRows = await tx
        .update(agentActions)
        .set({
          state: "approved",
          reviewerId,
          approvedParameters,
          updatedAt: new Date()
        })
        .where(agentActionScopedWhere(companyId, actionId))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to approve agent action");
      }

      await emitAgentActionAuditEvent(tx, {
        companyId,
        lifecycle: "proposal_approved",
        row: updated,
        actorId: reviewerId,
        actorType: "user",
        summary: "Agent proposal approved"
      });

      return { mapped: mapRow(updated), row: updated };
    });

    await mirrorAgentActionAuditToLangfuse({
      companyId,
      lifecycle: "proposal_approved",
      row: mapped.row,
      actorId: reviewerId,
      actorType: "user",
      summary: "Agent proposal approved"
    });

    return mapped.mapped;
  } catch (error) {
    if (persistExpiredAfterRollback) {
      await persistTerminalExpiredState(companyId, actionId);
    }
    throw error;
  }
}

export async function rejectAgentAction(companyId: string, actionId: string, reviewerId: string) {
  const result = await db.transaction(async (tx) => {
    const row = await getActionRow(companyId, actionId, tx);

    assertAgentActionRejectable(toLifecycleSlice(row));

    await getAgentActionExecutor(row.actionType)?.onRejectInTransaction?.({
      tx,
      companyId,
      actionId,
      actorId: reviewerId,
      actionType: row.actionType,
      target: row.target as CanonicalEntityRefV1,
      parameters: (row.parameters as Record<string, unknown>) ?? {}
    });

    const updatedRows = await tx
      .update(agentActions)
      .set({ state: "cancelled", reviewerId, updatedAt: new Date() })
      .where(agentActionScopedWhere(companyId, actionId))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to reject agent action");
    }

    await emitAgentActionAuditEvent(tx, {
      companyId,
      lifecycle: "proposal_rejected",
      row: updated,
      actorId: reviewerId,
      actorType: "user",
      summary: "Agent proposal rejected"
    });

    return { mapped: mapRow(updated), row: updated };
  });

  await mirrorAgentActionAuditToLangfuse({
    companyId,
    lifecycle: "proposal_rejected",
    row: result.row,
    actorId: reviewerId,
    actorType: "user",
    summary: "Agent proposal rejected"
  });

  return result.mapped;
}

export function resolveExecutableParameters(row: typeof agentActions.$inferSelect): Record<string, unknown> {
  if (row.requiresApproval) {
    const approved = row.approvedParameters as Record<string, unknown> | null;
    if (!approved) {
      throw new AppError(ErrorCode.CONFLICT, "Approved parameters are missing");
    }

    return approved;
  }

  return (row.parameters as Record<string, unknown>) ?? {};
}

export async function editAgentActionParameters(
  companyId: string,
  actionId: string,
  editorId: string,
  patch: { channel?: "sms" | "email"; subject?: string | null; body: string }
) {
  const result = await db.transaction(async (tx) => {
    const row = await getActionRow(companyId, actionId, tx);

    if (row.state !== "awaiting_approval") {
      throw new AppError(ErrorCode.CONFLICT, "Only awaiting-approval actions can be edited");
    }

    if (!isAgentActionEditable(row.actionType)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "This action type cannot be edited");
    }

    const current = (row.parameters as Record<string, unknown>) ?? {};
    const nextParameters: Record<string, unknown> = {
      ...current,
      body: patch.body,
      ...(patch.channel ? { channel: patch.channel } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {})
    };

    const payloadHash = hashPayload({
      actionType: row.actionType,
      parameters: nextParameters,
      target: row.target as CanonicalEntityRefV1
    });

    const updatedRows = await tx
      .update(agentActions)
      .set({
        parameters: nextParameters,
        payloadHash,
        approvedParameters: null,
        updatedAt: new Date()
      })
      .where(agentActionScopedWhere(companyId, actionId))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to edit agent action");
    }

    const detail = {
      actionType: row.actionType,
      channel: patch.channel ?? current.channel
    };

    await emitAgentActionAuditEvent(tx, {
      companyId,
      lifecycle: "proposal_edited",
      row: updated,
      actorId: editorId,
      actorType: "user",
      summary: "Agent proposal edited by operator",
      detail
    });

    return { mapped: mapRow(updated), row: updated, detail };
  });

  await mirrorAgentActionAuditToLangfuse({
    companyId,
    lifecycle: "proposal_edited",
    row: result.row,
    actorId: editorId,
    actorType: "user",
    summary: "Agent proposal edited by operator",
    detail: result.detail
  });

  return result.mapped;
}

export async function executeAgentAction(companyId: string, actionId: string, actorId: string) {
  let persistExpiredAfterRollback = false;

  try {
    const result = await db.transaction(async (tx) => {
      const row = await getActionRow(companyId, actionId, tx);

      if (isAgentActionExpired(row.expiresAt)) {
        persistExpiredAfterRollback = true;
        throw agentActionExpiredError();
      }

      assertAgentActionExecutable(toLifecycleSlice(row));

      const executableParameters = resolveExecutableParameters(row);
      const target = row.target as CanonicalEntityRefV1;
      const liveRef = await resolveEntityRef(companyId, target.entityType, target.entityId);
      if (isStaleRecordVersion(target.recordVersion, liveRef.recordVersion)) {
        throw agentActionStaleTargetError();
      }

      const executor = getAgentActionExecutor(row.actionType);
      const executionContext = {
        tx,
        companyId,
        actionId,
        actorId,
        actionType: row.actionType,
        target,
        parameters: executableParameters,
        requiresApproval: row.requiresApproval,
        state: row.state
      };
      const authorizationDecision = (await executor?.beforeExecute?.(executionContext)) ?? null;

      await tx
        .update(agentActions)
        .set({ state: "executing", updatedAt: new Date() })
        .where(agentActionScopedWhere(companyId, actionId));

      // Side effects (e.g. FS-25 brief apply) commit atomically with the succeeded state.
      await executor?.applyInTransaction?.(executionContext);

      const receipt = {
        outcome: "succeeded" as const,
        emittedEventIds: [] as string[],
        note: "No outbound provider send in Batch 4 slice",
        approvedParameters: executableParameters,
        approvedParametersHash: hashPayload({
          actionType: row.actionType,
          parameters: executableParameters,
          target
        }),
        executedAt: new Date().toISOString(),
        ...(authorizationDecision
          ? {
              authorizationDecision: {
                policyVersion: authorizationDecision.policyVersion,
                reason: authorizationDecision.reason
              }
            }
          : {})
      };

      const updatedRows = await tx
        .update(agentActions)
        .set({
          state: "succeeded",
          executionReceipt: receipt,
          updatedAt: new Date()
        })
        .where(agentActionScopedWhere(companyId, actionId))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to execute agent action");
      }

      const detail = {
        actionType: row.actionType,
        receipt
      };

      await emitAgentActionAuditEvent(tx, {
        companyId,
        lifecycle: "execution_succeeded",
        row: updated,
        actorId,
        actorType: "user",
        summary: `Agent action executed (${row.actionType})`,
        detail
      });

      return { mapped: mapRow(updated), row: updated, detail };
    });

    await mirrorAgentActionAuditToLangfuse({
      companyId,
      lifecycle: "execution_succeeded",
      row: result.row,
      actorId,
      actorType: "user",
      summary: `Agent action executed (${result.row.actionType})`,
      detail: result.detail
    });

    return result.mapped;
  } catch (error) {
    if (persistExpiredAfterRollback) {
      await persistTerminalExpiredState(companyId, actionId);
    }
    throw error;
  }
}

export async function getAgentAction(companyId: string, actionId: string) {
  const row = await getActionRow(companyId, actionId);
  return mapRow(row);
}
