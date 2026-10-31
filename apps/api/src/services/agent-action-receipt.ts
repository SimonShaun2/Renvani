/**
 * Ticket A (FS-256) TE-FAIL-01 / TE-RCPT-01 / TE-RCPT-02 building blocks. Pure helpers plus one post-rollback
 * writer, so `executeAgentAction` can adopt them with a few lines once #370 (which owns agent-action.service.ts)
 * merges. No provider send, no network, no env reads.
 *
 * - Internal actions: execute ends `succeeded` with outcome `succeeded` (the side effect is in the same tx).
 * - Outbound actions: execute ends in `executing` with outcome `queued` + deliveryState `queued`. Only a provider
 *   callback may later move delivery to `provider_accepted` / `delivered` (Figma 331:4230). Never `succeeded` here.
 * - Failures: after the execute tx rolls back, a second tenant tx writes `failed` + a failed receipt + an
 *   `execution_failed` audit event. Rollback first means no row lock is held, so this cannot deadlock.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";

import { agentActions, runTransactionWithTenantSession } from "@fsm/db";
import { AppError, type AgentActionDeliveryStateV1 } from "@fsm/types";

import { emitAgentActionAuditEvent } from "./agent-action-audit.js";
import { getAgentActionDeliveryKind, type AgentActionDeliveryKind } from "./agent-action.executors.js";

export const AGENT_ACTION_QUEUED_NOTE = "Queued for delivery; no provider send has happened (provider adapter disabled)";
const ERROR_MESSAGE_MAX = 500;

export interface AgentActionExecutionReceiptBase {
  approvedParameters: Record<string, unknown>;
  approvedParametersHash: string;
  executedAt: string;
  authorizationDecision?: { policyVersion: string; reason: string };
}

export type AgentActionExecutionResult =
  | { state: "succeeded"; receipt: AgentActionExecutionReceiptBase & { outcome: "succeeded"; emittedEventIds: string[] } }
  | {
      state: "executing";
      receipt: AgentActionExecutionReceiptBase & {
        outcome: "queued";
        deliveryState: Extract<AgentActionDeliveryStateV1, "queued">;
        emittedEventIds: string[];
        note: string;
      };
    };

/** State + receipt a successful execute must write, by delivery kind. */
export function buildAgentActionExecutionResult(
  delivery: AgentActionDeliveryKind,
  base: AgentActionExecutionReceiptBase
): AgentActionExecutionResult {
  if (delivery === "outbound") {
    return {
      state: "executing",
      receipt: { outcome: "queued", deliveryState: "queued", emittedEventIds: [], note: AGENT_ACTION_QUEUED_NOTE, ...base }
    };
  }
  return { state: "succeeded", receipt: { outcome: "succeeded", emittedEventIds: [], ...base } };
}

export function buildAgentActionExecutionResultForType(actionType: string, base: AgentActionExecutionReceiptBase) {
  return buildAgentActionExecutionResult(getAgentActionDeliveryKind(actionType), base);
}

export interface AgentActionFailedReceipt {
  outcome: "failed";
  emittedEventIds: string[];
  deliveryState?: Extract<AgentActionDeliveryStateV1, "failed">;
  error: { code: string; message: string };
  failedAt: string;
}

/** Failed receipt. Error text is truncated; AppError codes are kept, anything else reads EXECUTION_FAILED. */
export function buildAgentActionFailedReceipt(delivery: AgentActionDeliveryKind, error: unknown, now: Date = new Date()): AgentActionFailedReceipt {
  const code = error instanceof AppError ? String(error.code) : "EXECUTION_FAILED";
  const raw = error instanceof Error ? error.message : "Execution failed";
  return {
    outcome: "failed",
    emittedEventIds: [],
    ...(delivery === "outbound" ? { deliveryState: "failed" as const } : {}),
    error: { code, message: raw.slice(0, ERROR_MESSAGE_MAX) },
    failedAt: now.toISOString()
  };
}

/** States a failed execute may be recorded from (the row is back at `approved` after rollback). */
export const AGENT_ACTION_FAILABLE_STATES = ["approved", "executing"] as const;

/**
 * Call AFTER the execute transaction rolled back. Tenant-scoped compare-and-set from approved/executing to
 * `failed`; returns null (writes nothing) when the row moved on, e.g. a concurrent execute succeeded.
 */
export async function persistAgentActionExecutionFailure(input: {
  companyId: string;
  actionId: string;
  actorId: string;
  error: unknown;
  now?: Date;
}) {
  return runTransactionWithTenantSession(input.companyId, async (tx) => {
    const [current] = await tx
      .select()
      .from(agentActions)
      .where(and(eq(agentActions.id, input.actionId), eq(agentActions.companyId, input.companyId), isNull(agentActions.deletedAt)))
      .limit(1);
    if (!current) return null;
    const receipt = buildAgentActionFailedReceipt(getAgentActionDeliveryKind(current.actionType), input.error, input.now);
    const [updated] = await tx
      .update(agentActions)
      .set({ state: "failed", executionReceipt: receipt, updatedAt: input.now ?? new Date() })
      .where(
        and(
          eq(agentActions.id, input.actionId),
          eq(agentActions.companyId, input.companyId),
          isNull(agentActions.deletedAt),
          inArray(agentActions.state, [...AGENT_ACTION_FAILABLE_STATES])
        )
      )
      .returning();
    if (!updated) return null;
    await emitAgentActionAuditEvent(tx, {
      companyId: input.companyId,
      lifecycle: "execution_failed",
      row: updated,
      actorId: input.actorId,
      actorType: "user",
      summary: `Agent action execution failed (${updated.actionType})`,
      detail: { actionType: updated.actionType, receipt }
    });
    return updated;
  });
}
