import { z } from "zod";

import { AgentProductV1Schema } from "./tenant-context.js";
import { UuidSchema } from "./zod-shared.js";

export const AgentAuditLifecycleKindV1Schema = z.enum([
  "proposal_created",
  "proposal_approved",
  "proposal_rejected",
  "proposal_edited",
  "execution_succeeded",
  "execution_failed"
]);

export type AgentAuditLifecycleKindV1 = z.infer<typeof AgentAuditLifecycleKindV1Schema>;

export const AgentActivityAuditPayloadV1Schema = z.object({
  auditSchemaVersion: z.literal("agent-activity-audit-v1"),
  lifecycle: AgentAuditLifecycleKindV1Schema,
  policyVersion: z.string().min(1),
  agentProduct: AgentProductV1Schema,
  actionType: z.string().min(1),
  requiresApproval: z.boolean(),
  agentActionId: UuidSchema,
  /** FS-72: customer send remains gated until founder approval */
  loyaltyRemindersDryRun: z.boolean(),
  loyaltyRemindersEnabled: z.boolean(),
  detail: z.record(z.unknown()).optional()
});

export type AgentActivityAuditPayloadV1 = z.infer<typeof AgentActivityAuditPayloadV1Schema>;

export function buildAgentActivityAuditPayloadV1(input: {
  lifecycle: AgentAuditLifecycleKindV1;
  policyVersion: string;
  agentProduct: z.infer<typeof AgentProductV1Schema>;
  actionType: string;
  requiresApproval: boolean;
  agentActionId: string;
  loyaltyRemindersDryRun: boolean;
  loyaltyRemindersEnabled: boolean;
  detail?: Record<string, unknown>;
}): AgentActivityAuditPayloadV1 {
  return AgentActivityAuditPayloadV1Schema.parse({
    auditSchemaVersion: "agent-activity-audit-v1",
    lifecycle: input.lifecycle,
    policyVersion: input.policyVersion,
    agentProduct: input.agentProduct,
    actionType: input.actionType,
    requiresApproval: input.requiresApproval,
    agentActionId: input.agentActionId,
    loyaltyRemindersDryRun: input.loyaltyRemindersDryRun,
    loyaltyRemindersEnabled: input.loyaltyRemindersEnabled,
    detail: input.detail
  });
}
