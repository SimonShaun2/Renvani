import { AppError, ErrorCode } from "../../errors.js";

import { AGENT_CONTROL_PLANE_ERROR_CODES } from "./agent-errors.js";
import type { AgentActionStateV1 } from "./agent-action-state.js";
import { AgentToolNameV1Schema, type AgentToolNameV1 } from "./tools/registry.js";

/** Terminal states — no further lifecycle transitions except idempotent reads. */
export const TERMINAL_AGENT_ACTION_STATES_V1: ReadonlySet<AgentActionStateV1> = new Set([
  "succeeded",
  "failed",
  "expired",
  "cancelled",
  "escalated",
  "reversed"
]);

/** Tools that may cause outbound or customer-visible side effects when executed. */
export const SIDE_EFFECT_AGENT_TOOLS_V1: ReadonlySet<AgentToolNameV1> = new Set([
  "message.send_proposed"
]);

export interface AgentActionActorV1 {
  actorId: string;
  actorType: "user" | "system" | "ai" | "customer";
}

export interface AgentActionPolicyContextV1 {
  agentProduct: string;
  actionType: string;
  actorType: AgentActionActorV1["actorType"];
  policyVersion: string;
  requiresApproval: boolean;
}

export interface AgentActionLifecycleSliceV1 {
  companyId: string;
  state: AgentActionStateV1;
  actionType: string;
  requiresApproval: boolean;
  expiresAt: Date;
}

export interface AgentActionPolicyDecisionV1 {
  initialState: AgentActionStateV1;
  requiresApproval: boolean;
  allowsAutoExecute: boolean;
}

const AUTO_APPROVED_TOOLS_V1: ReadonlySet<AgentToolNameV1> = new Set([
  "context.resolve",
  "message.draft"
]);

function isKnownTool(actionType: string): actionType is AgentToolNameV1 {
  return AgentToolNameV1Schema.safeParse(actionType).success;
}

export function isTerminalAgentActionState(state: AgentActionStateV1): boolean {
  return TERMINAL_AGENT_ACTION_STATES_V1.has(state);
}

export function isAgentActionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}

export function agentActionExpiredError(): AppError {
  return new AppError(ErrorCode.CONFLICT, "Agent action has expired");
}

export function agentActionStaleTargetError(): AppError {
  return new AppError(
    AGENT_CONTROL_PLANE_ERROR_CODES.staleRecordVersion,
    "Target recordVersion is stale; re-resolve context"
  );
}

/**
 * FS37-NT-09 — wrong-tenant access surfaces as NOT_FOUND (no cross-tenant leakage).
 */
export function assertAgentActionTenantScope(callerCompanyId: string, actionCompanyId: string): void {
  if (callerCompanyId !== actionCompanyId) {
    throw new AppError(ErrorCode.NOT_FOUND, "Agent action not found");
  }
}

export function evaluateAgentActionPolicyDecision(
  context: AgentActionPolicyContextV1
): AgentActionPolicyDecisionV1 {
  if (!isKnownTool(context.actionType)) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Action type is not a registered v1 tool");
  }

  const requiresApproval =
    context.actionType === "message.send_proposed" ||
    context.actionType === "loyalty.reminder.propose" ||
    (!AUTO_APPROVED_TOOLS_V1.has(context.actionType) && context.requiresApproval);

  const initialState: AgentActionStateV1 = requiresApproval ? "awaiting_approval" : "policy_evaluated";

  return {
    initialState,
    requiresApproval,
    allowsAutoExecute: !requiresApproval && AUTO_APPROVED_TOOLS_V1.has(context.actionType)
  };
}

export function assertAgentActionNotTerminal(action: AgentActionLifecycleSliceV1): void {
  if (isTerminalAgentActionState(action.state)) {
    throw new AppError(ErrorCode.CONFLICT, `Agent action is terminal (${action.state})`);
  }
}

export function assertAgentActionApprovable(action: AgentActionLifecycleSliceV1): void {
  assertAgentActionNotTerminal(action);
  if (action.state !== "awaiting_approval" && action.state !== "policy_evaluated") {
    throw new AppError(ErrorCode.CONFLICT, "Agent action is not awaiting approval");
  }
}

export function assertAgentActionRejectable(action: AgentActionLifecycleSliceV1): void {
  assertAgentActionApprovable(action);
}

/**
 * Blocks execution that would emit side effects without human approval (FS37-NT-11 / U10).
 */
export function assertNoUnapprovedSideEffects(action: AgentActionLifecycleSliceV1): void {
  const tool = action.actionType;
  if (!isKnownTool(tool) || !SIDE_EFFECT_AGENT_TOOLS_V1.has(tool)) {
    return;
  }

  if (action.requiresApproval && action.state !== "approved") {
    throw new AppError(
      AGENT_CONTROL_PLANE_ERROR_CODES.moneyStateWithoutApproval,
      "Agent action requires approval before execution"
    );
  }
}

/**
 * Prevents duplicate customer-visible sends for the same proposal (idempotent replay only when already succeeded).
 */
export function assertNoDuplicateSideEffectExecution(action: AgentActionLifecycleSliceV1): void {
  if (!isKnownTool(action.actionType) || !SIDE_EFFECT_AGENT_TOOLS_V1.has(action.actionType)) {
    return;
  }

  if (action.state === "executing") {
    throw new AppError(ErrorCode.CONFLICT, "Agent action is already executing");
  }

  if (action.state === "succeeded") {
    throw new AppError(ErrorCode.CONFLICT, "Agent action already completed");
  }
}

export function assertAgentActionExecutable(action: AgentActionLifecycleSliceV1): void {
  assertAgentActionNotTerminal(action);
  assertNoUnapprovedSideEffects(action);
  assertNoDuplicateSideEffectExecution(action);

  if (isAgentActionExpired(action.expiresAt)) {
    throw agentActionExpiredError();
  }

  if (action.requiresApproval && action.state !== "approved") {
    throw new AppError(ErrorCode.CONFLICT, "Agent action requires approval before execution");
  }

  if (
    !action.requiresApproval &&
    action.state !== "policy_evaluated" &&
    action.state !== "approved"
  ) {
    throw new AppError(ErrorCode.CONFLICT, "Agent action is not executable");
  }
}

/** Retry is only meaningful before a terminal outcome; callers must use a new idempotency key for a new proposal. */
export function assertAgentActionRetryAllowed(action: AgentActionLifecycleSliceV1): void {
  if (action.state === "failed") {
    throw new AppError(ErrorCode.CONFLICT, "Failed agent actions cannot be retried in place; create a new proposal");
  }
  if (isTerminalAgentActionState(action.state)) {
    throw new AppError(ErrorCode.CONFLICT, `Agent action is terminal (${action.state})`);
  }
}
