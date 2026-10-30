import { z } from "zod";

import { AgentActionStateV1Schema } from "./agent-action-state.js";
import { CanonicalEntityRefV1Schema } from "./entity-ref.schema.js";
import { AgentProductV1Schema } from "./tenant-context.js";
import { ContextResolveParamsV1Schema } from "./tools/context-resolve.params.js";
import { MessageDraftParamsV1Schema } from "./tools/message-draft.params.js";
import { MessageSendProposedParamsV1Schema } from "./tools/message-send-proposed.params.js";
import { LoyaltyReminderProposeParamsV1Schema } from "./tools/loyalty-reminder-propose.params.js";
import { ServiceJobBriefProposeParamsV1Schema } from "./tools/service-job-brief-propose.params.js";
import { AgentToolNameV1Schema } from "./tools/registry.js";
import {
  ContractVersionV1Schema,
  IdempotencyKeyV1Schema,
  IsoDateTimeSchema,
  UuidSchema
} from "./zod-shared.js";

export const ExecutionReceiptV1Schema = z.object({
  outcome: z.enum(["succeeded", "failed", "dry_run"]),
  emittedEventIds: z.array(UuidSchema)
});

export type ExecutionReceiptV1 = z.infer<typeof ExecutionReceiptV1Schema>;

const AgentActionProposalBaseV1Schema = z.object({
  contractVersion: ContractVersionV1Schema,
  id: UuidSchema,
  companyId: UuidSchema,
  agentProduct: AgentProductV1Schema,
  target: CanonicalEntityRefV1Schema,
  sourceEventIds: z.array(UuidSchema),
  idempotencyKey: IdempotencyKeyV1Schema,
  policyVersion: z.string().min(1),
  requiresApproval: z.boolean(),
  expiresAt: IsoDateTimeSchema,
  state: AgentActionStateV1Schema,
  reviewerId: UuidSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().max(4000).optional(),
  executionReceipt: ExecutionReceiptV1Schema.optional()
});

export const ContextResolveProposalV1Schema = AgentActionProposalBaseV1Schema.extend({
  actionType: z.literal("context.resolve"),
  parameters: ContextResolveParamsV1Schema
});

export const MessageDraftProposalV1Schema = AgentActionProposalBaseV1Schema.extend({
  actionType: z.literal("message.draft"),
  parameters: MessageDraftParamsV1Schema
});

export const MessageSendProposedProposalV1Schema = AgentActionProposalBaseV1Schema.extend({
  actionType: z.literal("message.send_proposed"),
  parameters: MessageSendProposedParamsV1Schema
});

export const LoyaltyReminderProposeProposalV1Schema = AgentActionProposalBaseV1Schema.extend({
  actionType: z.literal("loyalty.reminder.propose"),
  parameters: LoyaltyReminderProposeParamsV1Schema
});

export const ServiceJobBriefProposeProposalV1Schema = AgentActionProposalBaseV1Schema.extend({
  actionType: z.literal("service.job_brief.propose"),
  parameters: ServiceJobBriefProposeParamsV1Schema
});

export const AgentActionProposalV1Schema = z.discriminatedUnion("actionType", [
  ContextResolveProposalV1Schema,
  MessageDraftProposalV1Schema,
  MessageSendProposedProposalV1Schema,
  LoyaltyReminderProposeProposalV1Schema,
  ServiceJobBriefProposeProposalV1Schema
]);

export type AgentActionProposalV1 = z.infer<typeof AgentActionProposalV1Schema>;

/** Create payload (no server-assigned id/state). */
export const CreateAgentActionProposalV1Schema = z.discriminatedUnion("actionType", [
  AgentActionProposalBaseV1Schema.omit({ id: true, state: true }).extend({
    actionType: z.literal("context.resolve"),
    parameters: ContextResolveParamsV1Schema
  }),
  AgentActionProposalBaseV1Schema.omit({ id: true, state: true }).extend({
    actionType: z.literal("message.draft"),
    parameters: MessageDraftParamsV1Schema
  }),
  AgentActionProposalBaseV1Schema.omit({ id: true, state: true }).extend({
    actionType: z.literal("message.send_proposed"),
    parameters: MessageSendProposedParamsV1Schema
  }),
  AgentActionProposalBaseV1Schema.omit({ id: true, state: true }).extend({
    actionType: z.literal("loyalty.reminder.propose"),
    parameters: LoyaltyReminderProposeParamsV1Schema
  }),
  AgentActionProposalBaseV1Schema.omit({ id: true, state: true }).extend({
    actionType: z.literal("service.job_brief.propose"),
    parameters: ServiceJobBriefProposeParamsV1Schema
  })
]);

export type CreateAgentActionProposalV1 = z.infer<typeof CreateAgentActionProposalV1Schema>;

export const AgentToolParametersV1Schema = z.union([
  ContextResolveParamsV1Schema,
  MessageDraftParamsV1Schema,
  MessageSendProposedParamsV1Schema,
  LoyaltyReminderProposeParamsV1Schema,
  ServiceJobBriefProposeParamsV1Schema
]);

export function parseAgentActionProposalV1(input: unknown): AgentActionProposalV1 {
  return AgentActionProposalV1Schema.parse(input);
}

export function parseCreateAgentActionProposalV1(input: unknown): CreateAgentActionProposalV1 {
  return CreateAgentActionProposalV1Schema.parse(input);
}

export function assertActionTypeMatchesToolName(
  actionType: z.infer<typeof AgentToolNameV1Schema>,
  parameters: unknown
): void {
  switch (actionType) {
    case "context.resolve":
      ContextResolveParamsV1Schema.parse(parameters);
      return;
    case "message.draft":
      MessageDraftParamsV1Schema.parse(parameters);
      return;
    case "message.send_proposed":
      MessageSendProposedParamsV1Schema.parse(parameters);
      return;
    case "loyalty.reminder.propose":
      LoyaltyReminderProposeParamsV1Schema.parse(parameters);
      return;
    case "service.job_brief.propose":
      ServiceJobBriefProposeParamsV1Schema.parse(parameters);
      return;
  }
}
