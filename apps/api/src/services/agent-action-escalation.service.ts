import { and, eq, inArray, isNull } from "drizzle-orm";

import { agentActions, runTransactionWithTenantSession } from "@fsm/db";
import { AppError, ErrorCode, type CanonicalEntityRefV1 } from "@fsm/types";

import { emitAgentActionAuditEvent, mirrorAgentActionAuditToLangfuse } from "./agent-action-audit.js";
import { getAgentActionExecutor } from "./agent-action.executors.js";
import { getAgentAction } from "./agent-action.service.js";

/** States a human can hand off to an owner/admin. "escalated" is terminal (TERMINAL_AGENT_ACTION_STATES_V1). */
export const ESCALATABLE_AGENT_ACTION_STATES = ["policy_evaluated", "awaiting_approval", "approved"] as const;

export interface EscalateAgentActionInput {
  reason?: string;
  expectedVersion?: number;
}

/** Optimistic-concurrency token: row updatedAt in ms (matches `version` on agent action responses). */
export function agentActionRowVersion(row: { updatedAt: Date }): number {
  return row.updatedAt.getTime();
}

export const ESCALATION_AUDIT_SUMMARY = "Agent proposal escalated";

function escalationAuditDetail(previousState: string, input: EscalateAgentActionInput): Record<string, unknown> {
  return { outcome: "escalated", previousState, hasReason: Boolean(input.reason) };
}

/**
 * Escalate a pending proposal: terminal state "escalated", escalation recorded on the execution receipt,
 * executor holds released via onRejectInTransaction. No side effects, no external sends.
 */
export async function escalateAgentAction(
  companyId: string,
  actionId: string,
  actorId: string,
  input: EscalateAgentActionInput = {}
) {
  const escalated = await runTransactionWithTenantSession(companyId, async (tx) => {
    const scoped = and(
      eq(agentActions.companyId, companyId),
      eq(agentActions.id, actionId),
      isNull(agentActions.deletedAt)
    );
    const [row] = await tx.select().from(agentActions).where(scoped).limit(1);
    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Agent action not found");
    }
    const previousState = row.state;
    if (input.expectedVersion !== undefined && input.expectedVersion !== agentActionRowVersion(row)) {
      throw new AppError(ErrorCode.CONFLICT, "Agent action changed since it was loaded; reload and retry");
    }
    if (!(ESCALATABLE_AGENT_ACTION_STATES as readonly string[]).includes(row.state)) {
      throw new AppError(ErrorCode.CONFLICT, `Agent action in state ${row.state} cannot be escalated`);
    }

    await getAgentActionExecutor(row.actionType)?.onRejectInTransaction?.({
      tx,
      companyId,
      actionId,
      actorId,
      actionType: row.actionType,
      target: row.target as CanonicalEntityRefV1,
      parameters: (row.parameters as Record<string, unknown>) ?? {}
    });

    const now = new Date();
    const updated = await tx
      .update(agentActions)
      .set({
        state: "escalated",
        reviewerId: actorId,
        executionReceipt: {
          outcome: "escalated",
          escalatedBy: actorId,
          escalatedAt: now.toISOString(),
          reason: input.reason ?? null
        },
        updatedAt: now
      })
      .where(and(scoped, inArray(agentActions.state, [...ESCALATABLE_AGENT_ACTION_STATES])))
      .returning();
    const [updatedRow] = updated;
    if (!updatedRow) {
      throw new AppError(ErrorCode.CONFLICT, "Agent action changed since it was loaded; reload and retry");
    }

    // FS-42 audit, same transaction. No escalate value in the activity_event_type enum, so this is
    // recorded as a proposal_rejected lifecycle with detail.outcome = "escalated" (no migration).
    // Ids and flags only: the free-text reason stays on the execution receipt, not in the event payload.
    await emitAgentActionAuditEvent(tx, {
      companyId,
      lifecycle: "proposal_rejected",
      row: updatedRow,
      actorId,
      actorType: "user",
      summary: ESCALATION_AUDIT_SUMMARY,
      detail: escalationAuditDetail(previousState, input)
    });
    return { row: updatedRow, previousState };
  });

  await mirrorAgentActionAuditToLangfuse({
    companyId,
    lifecycle: "proposal_rejected",
    row: escalated.row,
    actorId,
    actorType: "user",
    summary: ESCALATION_AUDIT_SUMMARY,
    detail: escalationAuditDetail(escalated.previousState, input)
  });

  return getAgentAction(companyId, actionId);
}
