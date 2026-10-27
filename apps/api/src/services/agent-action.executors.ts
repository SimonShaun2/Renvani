import type { db } from "@fsm/db";
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
}

const executors = new Map<string, AgentActionExecutor>();

export function registerAgentActionExecutor(actionType: string, executor: AgentActionExecutor): void {
  executors.set(actionType, executor);
}

export function getAgentActionExecutor(actionType: string): AgentActionExecutor | undefined {
  return executors.get(actionType);
}

registerAgentActionExecutor("loyalty.reminder.propose", {
  beforeExecute: () => {
    assertLoyaltyReminderExecutionAllowed();
  }
});

registerAgentActionExecutor("message.send_proposed", {
  beforeExecute: async (ctx) => {
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
