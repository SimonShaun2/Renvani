import { and, eq, isNull } from "drizzle-orm";

import { bookingRequests, jobs, type db } from "@fsm/db";
import { AppError, ErrorCode, type CanonicalEntityRefV1 } from "@fsm/types";

import { assertLoyaltyReminderExecutionAllowed } from "./agent-action.policy.js";
import { applyApprovedJobServiceBriefInTransaction } from "./job-service-brief.service.js";
import { authorizeAgentActionExecution } from "./outbound-policy-engine.service.js";

type ExecuteTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type AuthorizationDecision = Awaited<ReturnType<typeof authorizeAgentActionExecution>>;

export interface AgentActionExecutionContext {
  tx: ExecuteTx;
  companyId: string;
  actionId: string;
  actorId: string;
  actionType: string;
  target: CanonicalEntityRefV1;
  parameters: Record<string, unknown>;
  requiresApproval: boolean;
  state: string;
}

/**
 * Per-action-type execution hooks, registered by type (FS-25 follow-up). Both run inside the
 * execute transaction: `beforeExecute` gates (may return an authorization decision for the
 * receipt), `applyInTransaction` performs side effects before the action is marked succeeded,
 * so a failure rolls the whole execute back.
 */
export interface AgentActionExecutor {
  beforeExecute?: (ctx: AgentActionExecutionContext) => Promise<AuthorizationDecision | void> | void;
  applyInTransaction?: (ctx: AgentActionExecutionContext) => Promise<void>;
  /** Optional side effect when an operator rejects the proposal (runs inside the reject transaction). */
  onRejectInTransaction?: (ctx: AgentActionRejectContext) => Promise<void>;
}

export interface AgentActionRejectContext {
  tx: ExecuteTx;
  companyId: string;
  actionId: string;
  actorId: string;
  actionType: string;
  target: CanonicalEntityRefV1;
  parameters: Record<string, unknown>;
}

/** Shared outbound consent/policy gate for executors that would contact a customer. */
export async function authorizeOutboundAgentActionExecution(ctx: AgentActionExecutionContext) {
  const decision = await authorizeAgentActionExecution({
    companyId: ctx.companyId,
    actorId: ctx.actorId,
    actorType: "user",
    actionType: ctx.actionType,
    parameters: ctx.parameters,
    target: ctx.target,
    requiresApproval: ctx.requiresApproval,
    state: ctx.state as Parameters<typeof authorizeAgentActionExecution>[0]["state"]
  });
  if (!decision.allowed) {
    throw new AppError(decision.errorCode ?? ErrorCode.POLICY_DENIED, decision.reason);
  }
  return decision;
}

const executors = new Map<string, AgentActionExecutor>();

export function registerAgentActionExecutor(actionType: string, executor: AgentActionExecutor): void {
  executors.set(actionType, executor);
}

export function getAgentActionExecutor(actionType: string): AgentActionExecutor | undefined {
  return executors.get(actionType);
}

/** Execute fails closed for action types with no registered executor (no silent no-op "success"). */
export function requireAgentActionExecutor(actionType: string): AgentActionExecutor {
  const executor = executors.get(actionType);
  if (!executor) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `No executor is registered for action type ${actionType}`);
  }
  return executor;
}

export function listAgentActionExecutorTypes(): string[] {
  return [...executors.keys()];
}

/**
 * Internal (non-outbound) executors re-check, inside the tenant-scoped execute transaction, that the
 * record the proposal is about still exists in this tenant. Nothing is sent to a customer; the
 * execution receipt + audit event are the outcome. Registry of target lookups keyed by parameter.
 */
const INTERNAL_TARGET_LOOKUPS = {
  jobId: async (ctx: AgentActionExecutionContext, id: string) =>
    ctx.tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.companyId, ctx.companyId), eq(jobs.id, id), isNull(jobs.deletedAt)))
      .limit(1),
  bookingRequestId: async (ctx: AgentActionExecutionContext, id: string) =>
    ctx.tx
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .where(and(eq(bookingRequests.companyId, ctx.companyId), eq(bookingRequests.id, id), isNull(bookingRequests.deletedAt)))
      .limit(1)
} as const;

export function internalRecordExecutor(parameterKey: keyof typeof INTERNAL_TARGET_LOOKUPS): AgentActionExecutor {
  return {
    applyInTransaction: async (ctx) => {
      const id = ctx.parameters[parameterKey] ?? (parameterKey === "jobId" && ctx.target.entityType === "job" ? ctx.target.entityId : undefined);
      if (typeof id !== "string" || id.length === 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Proposal is missing ${parameterKey}`);
      }
      const [found] = await INTERNAL_TARGET_LOOKUPS[parameterKey](ctx, id);
      if (!found) {
        throw new AppError(ErrorCode.CONFLICT, "The record this proposal is about no longer exists");
      }
    }
  };
}

registerAgentActionExecutor("loyalty.reminder.propose", {
  beforeExecute: () => {
    assertLoyaltyReminderExecutionAllowed();
  }
});

registerAgentActionExecutor("message.send_proposed", {
  beforeExecute: authorizeOutboundAgentActionExecution
});

registerAgentActionExecutor("service.job_brief.propose", {
  applyInTransaction: (ctx) =>
    applyApprovedJobServiceBriefInTransaction(ctx.tx, {
      companyId: ctx.companyId,
      jobId: ctx.target.entityId,
      actorId: ctx.actorId,
      agentActionId: ctx.actionId,
      parameters: ctx.parameters
    })
});

// Scheduling: operator acknowledges a customer self-service reschedule/cancel notice (internal only).
registerAgentActionExecutor("scheduling.booking.self_service", internalRecordExecutor("jobId"));

// Revenue: inquiry qualification metadata (internal only; no customer contact).
registerAgentActionExecutor("revenue.inquiry.qualify", internalRecordExecutor("bookingRequestId"));
