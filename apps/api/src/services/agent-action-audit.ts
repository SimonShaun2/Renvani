import type { EmitEventContext } from "@fsm/db";
import { emitEventWithExecutor } from "@fsm/db";
import { recordAgentAuditObservation } from "@fsm/ai/langfuse";
import { featureFlags } from "@fsm/config/feature-flags";
import {
  type AgentActivityAuditPayloadV1,
  type AgentAuditLifecycleKindV1,
  type AgentProductV1,
  buildAgentActivityAuditPayloadV1
} from "@fsm/types";

type ActivityEventType = EmitEventContext["eventType"];

const LIFECYCLE_TO_EVENT_TYPE: Record<AgentAuditLifecycleKindV1, ActivityEventType> = {
  proposal_created: "agent.proposal_created",
  proposal_approved: "agent.proposal_approved",
  proposal_rejected: "agent.proposal_rejected",
  proposal_edited: "agent.proposal_edited",
  execution_succeeded: "agent.execution_succeeded",
  execution_failed: "agent.execution_failed"
};

type AgentActionAuditRow = {
  id: string;
  agentProduct: string;
  actionType: string;
  policyVersion: string;
  requiresApproval: boolean;
};

type EventExecutor = Parameters<typeof emitEventWithExecutor>[0];

export function buildAgentActionAuditPayload(
  lifecycle: AgentAuditLifecycleKindV1,
  row: AgentActionAuditRow,
  detail?: Record<string, unknown>
): AgentActivityAuditPayloadV1 {
  const base = {
    lifecycle,
    policyVersion: row.policyVersion,
    agentProduct: row.agentProduct as AgentProductV1,
    actionType: row.actionType,
    requiresApproval: row.requiresApproval,
    agentActionId: row.id,
    loyaltyRemindersDryRun: featureFlags.loyaltyRemindersDryRun,
    loyaltyRemindersEnabled: featureFlags.loyaltyRemindersEnabled
  };

  if (detail) {
    return buildAgentActivityAuditPayloadV1({ ...base, detail });
  }

  return buildAgentActivityAuditPayloadV1(base);
}

export async function emitAgentActionAuditEvent(
  executor: EventExecutor,
  input: {
    companyId: string;
    lifecycle: AgentAuditLifecycleKindV1;
    row: AgentActionAuditRow;
    actorId?: string;
    actorType?: EmitEventContext["actorType"];
    summary: string;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  const audit = buildAgentActionAuditPayload(input.lifecycle, input.row, input.detail);
  const eventType = LIFECYCLE_TO_EVENT_TYPE[input.lifecycle];

  await emitEventWithExecutor(executor, {
    companyId: input.companyId,
    eventType,
    actorId: input.actorId,
    actorType: input.actorType,
    entityType: "agent_action",
    entityId: input.row.id,
    payload: {
      audit,
      ...(input.detail ?? {})
    },
    summary: input.summary
  });
}

export async function mirrorAgentActionAuditToLangfuse(input: {
  companyId: string;
  lifecycle: AgentAuditLifecycleKindV1;
  row: AgentActionAuditRow;
  actorId?: string;
  actorType?: string;
  summary: string;
  detail?: Record<string, unknown>;
  occurredAt?: string;
}): Promise<void> {
  const audit = buildAgentActionAuditPayload(input.lifecycle, input.row, input.detail);
  const eventType = LIFECYCLE_TO_EVENT_TYPE[input.lifecycle];

  await recordAgentAuditObservation({
    companyId: input.companyId,
    eventType,
    summary: input.summary,
    audit,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorType ? { actorType: input.actorType } : {})
  });
}
