import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { activityEvents, agentActions, db, runTransactionWithTenantSession } from "@fsm/db";
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
import { requireAgentActionExecutor, getAgentActionExecutor } from "./agent-action.executors.js";
import { buildAgentActionExecutionResultForType, persistAgentActionExecutionFailure } from "./agent-action-receipt.js";
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
    updatedAt: row.updatedAt.toISOString(),
    version: agentActionVersion(row)
  };
}

/**
 * Optimistic-concurrency token for state changes: clients echo it back as `expectedVersion`.
 * Derived from updated_at (every state change bumps it), so no schema change is needed.
 */
export function agentActionVersion(row: Pick<typeof agentActions.$inferSelect, "updatedAt">): number {
  return row.updatedAt.getTime();
}

export interface AgentActionStateChangeOptions {
  expectedVersion?: number | undefined;
  /** Client `Idempotency-Key` (approve/execute): same key + same request replays; different request → 409. */
  idempotencyKey?: string | undefined;
}

type TenantTx = Parameters<Parameters<typeof runTransactionWithTenantSession>[1]>[0];
type IdempotentOperation = "approve" | "execute";

const IDEMPOTENT_OPERATION_EVENT_TYPE = {
  approve: "agent.proposal_approved",
  execute: "agent.execution_succeeded"
} as const;

function idempotencyRequestHash(operation: IdempotentOperation, options: AgentActionStateChangeOptions): string {
  return hashPayload({ operation, expectedVersion: options.expectedVersion ?? null });
}

function idempotencyDetail(operation: IdempotentOperation, options: AgentActionStateChangeOptions) {
  return options.idempotencyKey
    ? { idempotency: { key: options.idempotencyKey, requestHash: idempotencyRequestHash(operation, options) } }
    : {};
}

/**
 * Replay lookup for approve/execute (TE-DUP-01/02). The key and request hash are recorded on the
 * tenant-scoped audit event written in the same transaction as the transition, so no migration is needed.
 * Returns the current row (marked `replayed: true`) when the same key and request were already applied;
 * throws 409 when the key was used with a different request; returns null when the key is new.
 */
async function findIdempotentReplay(
  tx: TenantTx,
  companyId: string,
  row: typeof agentActions.$inferSelect,
  operation: IdempotentOperation,
  options: AgentActionStateChangeOptions
) {
  if (!options.idempotencyKey) {
    return null;
  }

  const events = await tx
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.companyId, companyId),
        eq(activityEvents.entityType, "agent_action"),
        eq(activityEvents.entityId, row.id),
        eq(activityEvents.eventType, IDEMPOTENT_OPERATION_EVENT_TYPE[operation])
      )
    );

  const prior = events
    .map((event) => (event.payload as { idempotency?: { key?: unknown; requestHash?: unknown } } | null)?.idempotency)
    .find((entry) => entry?.key === options.idempotencyKey);
  if (!prior) {
    return null;
  }

  if (prior.requestHash !== idempotencyRequestHash(operation, options)) {
    throw new AppError(ErrorCode.CONFLICT, "Idempotency-Key was already used with a different request");
  }

  return { ...mapRow(row), replayed: true as const };
}

/**
 * Serialises concurrent requests that share an Idempotency-Key within one company (transaction-scoped advisory
 * lock on company + key, taken before the row is read). The second request waits until the first commits, then
 * reads the committed row and audit event and replays it (200, `replayed: true`) instead of losing the
 * compare-and-set race with a 409. No key → no lock (behaviour unchanged).
 */
async function lockIdempotencyKey(tx: TenantTx, companyId: string, options: AgentActionStateChangeOptions): Promise<void> {
  if (!options.idempotencyKey) {
    return;
  }
  const lockable = tx as unknown as { execute?: (query: unknown) => Promise<unknown> };
  if (typeof lockable.execute === "function") {
    await lockable.execute(sql`select pg_advisory_xact_lock(hashtext(${`agent-action-idempotency:${companyId}:${options.idempotencyKey}`}))`);
  }
}

function assertExpectedVersion(row: typeof agentActions.$inferSelect, options: AgentActionStateChangeOptions): void {
  if (options.expectedVersion !== undefined && options.expectedVersion !== agentActionVersion(row)) {
    throw agentActionVersionConflictError();
  }
}

function agentActionVersionConflictError(): AppError {
  return new AppError(ErrorCode.CONFLICT, "Agent action changed since it was loaded; reload and retry");
}

/** Compare-and-set predicate: the transition only applies if the row is still in `fromState`. */
function agentActionTransitionWhere(companyId: string, actionId: string, fromState: string) {
  return and(agentActionScopedWhere(companyId, actionId), eq(agentActions.state, fromState as AgentActionState));
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
  await runTransactionWithTenantSession(companyId, async (tx) => {
    await tx
      .update(agentActions)
      .set({ state: "expired", updatedAt: new Date() })
      .where(agentActionScopedWhere(companyId, actionId));
  });
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

export async function approveAgentAction(
  companyId: string,
  actionId: string,
  reviewerId: string,
  options: AgentActionStateChangeOptions = {}
) {
  let persistExpiredAfterRollback = false;

  try {
    const mapped = await runTransactionWithTenantSession(companyId, async (tx) => {
      await lockIdempotencyKey(tx, companyId, options);
      const row = await getActionRow(companyId, actionId, tx);

      const replay = await findIdempotentReplay(tx, companyId, row, "approve", options);
      if (replay) {
        return { mapped: replay, row, replayed: true };
      }

      assertExpectedVersion(row, options);
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
        .where(agentActionTransitionWhere(companyId, actionId, row.state))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw agentActionVersionConflictError();
      }

      await emitAgentActionAuditEvent(tx, {
        companyId,
        lifecycle: "proposal_approved",
        row: updated,
        actorId: reviewerId,
        actorType: "user",
        summary: "Agent proposal approved",
        ...(options.idempotencyKey ? { detail: idempotencyDetail("approve", options) } : {})
      });

      return { mapped: mapRow(updated), row: updated, replayed: false };
    });

    if (mapped.replayed) {
      return mapped.mapped;
    }

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

export async function rejectAgentAction(
  companyId: string,
  actionId: string,
  reviewerId: string,
  options: AgentActionStateChangeOptions = {}
) {
  const result = await runTransactionWithTenantSession(companyId, async (tx) => {
    const row = await getActionRow(companyId, actionId, tx);

    assertExpectedVersion(row, options);

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
      .where(agentActionTransitionWhere(companyId, actionId, row.state))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw agentActionVersionConflictError();
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
  patch: { channel?: "sms" | "email"; subject?: string | null; body: string },
  options: AgentActionStateChangeOptions = {}
) {
  const result = await runTransactionWithTenantSession(companyId, async (tx) => {
    const row = await getActionRow(companyId, actionId, tx);

    // TE-STALE-03: an edit made against a stale copy must not overwrite the current body.
    assertExpectedVersion(row, options);

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
      .where(agentActionTransitionWhere(companyId, actionId, "awaiting_approval"))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw agentActionVersionConflictError();
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

export async function executeAgentAction(
  companyId: string,
  actionId: string,
  actorId: string,
  options: AgentActionStateChangeOptions = {}
) {
  let persistExpiredAfterRollback = false;
  // Set only while the executor side effect runs. An unexpected (non-AppError) throw there, e.g. a provider or
  // adapter error, is recorded as `failed` (TE-FAIL-01). AppError rejections from the executor (validation,
  // cross-tenant, not found) and every check before it keep rolling back to the prior state so they can be fixed.
  let persistFailureAfterRollback = false;

  try {
    const result = await runTransactionWithTenantSession(companyId, async (tx) => {
      await lockIdempotencyKey(tx, companyId, options);
      const row = await getActionRow(companyId, actionId, tx);

      const replay = await findIdempotentReplay(tx, companyId, row, "execute", options);
      if (replay) {
        return { mapped: replay, row, detail: null, replayed: true };
      }

      assertExpectedVersion(row, options);

      if (isAgentActionExpired(row.expiresAt)) {
        persistExpiredAfterRollback = true;
        throw agentActionExpiredError();
      }

      assertAgentActionExecutable(toLifecycleSlice(row));
      // Fail closed: an action type with no registered executor cannot be executed.
      const executor = requireAgentActionExecutor(row.actionType);

      const executableParameters = resolveExecutableParameters(row);
      const target = row.target as CanonicalEntityRefV1;
      const liveRef = await resolveEntityRef(companyId, target.entityType, target.entityId);
      if (isStaleRecordVersion(target.recordVersion, liveRef.recordVersion)) {
        throw agentActionStaleTargetError();
      }

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
      const authorizationDecision = (await executor.beforeExecute?.(executionContext)) ?? null;

      const claimed = await tx
        .update(agentActions)
        .set({ state: "executing", updatedAt: new Date() })
        .where(agentActionTransitionWhere(companyId, actionId, row.state))
        .returning();
      if (!claimed[0]) {
        throw agentActionVersionConflictError();
      }

      // Side effects (e.g. FS-25 brief apply) commit atomically with the final state.
      persistFailureAfterRollback = true;
      await executor.applyInTransaction?.(executionContext);
      persistFailureAfterRollback = false;

      // Internal actions end `succeeded`; outbound actions stay `executing` with a `queued` receipt until a
      // provider callback moves delivery on (TE-RCPT-01/02). No provider send happens here.
      const { state: finalState, receipt } = buildAgentActionExecutionResultForType(row.actionType, {
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
      });

      const updatedRows = await tx
        .update(agentActions)
        .set({
          state: finalState,
          executionReceipt: receipt,
          updatedAt: new Date()
        })
        .where(agentActionTransitionWhere(companyId, actionId, "executing"))
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to execute agent action");
      }

      const detail = {
        actionType: row.actionType,
        receipt,
        ...idempotencyDetail("execute", options)
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

      return { mapped: mapRow(updated), row: updated, detail, replayed: false };
    });

    if (result.replayed || !result.detail) {
      return result.mapped;
    }

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
    if (persistFailureAfterRollback && !(error instanceof AppError)) {
      // The execute tx has rolled back (no row lock held). Record failed + receipt + execution_failed audit in a
      // fresh tenant tx; a failure to record must not mask the original error.
      try {
        await persistAgentActionExecutionFailure({ companyId, actionId, actorId, actorType: "user", error });
      } catch {
        // swallow: the original execution error below is what the caller needs
      }
    }
    throw error;
  }
}

export async function getAgentAction(companyId: string, actionId: string) {
  const row = await getActionRow(companyId, actionId);
  return mapRow(row);
}
