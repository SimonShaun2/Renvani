import { z } from "zod";

import { EditAgentActionParametersSchema, EscalateAgentActionBodySchema, ListAgentActionsQueryV1Schema } from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const listAgentActionsQuerySchema = ListAgentActionsQueryV1Schema;

export const operatorInboxIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const jobProvenanceParamsSchema = z.object({
  jobId: z.string().uuid()
});

export const jobProvenanceQuerySchema = z.object({
  eventIds: z.string().min(1)
});

/**
 * The inbox edit PATCH must name the item `version` the operator saw (TE-STALE-03): missing → 400, mismatch → 409.
 * The shared @fsm/types schema keeps it optional so the web input type is unchanged (#371 adds it in the hook).
 */
export const editAgentActionBodySchema = EditAgentActionParametersSchema.extend({
  expectedVersion: z.number().int().nonnegative()
});

export type EditAgentActionBody = z.infer<typeof editAgentActionBodySchema>;

export const operatorInboxCountsQuerySchema = ListAgentActionsQueryV1Schema.pick({ agentProduct: true }).strict();

export const operatorInboxCountsValidation = withZodValidation({ query: operatorInboxCountsQuerySchema });
export const operatorInboxIdValidation = withZodValidation({ params: operatorInboxIdParamsSchema });
export const listOperatorInboxValidation = withZodValidation({ query: listAgentActionsQuerySchema });
export const jobProvenanceValidation = withZodValidation({
  params: jobProvenanceParamsSchema,
  query: jobProvenanceQuerySchema
});
export const editAgentActionValidation = withZodValidation({
  params: operatorInboxIdParamsSchema,
  body: editAgentActionBodySchema
});
export const escalateAgentActionValidation = withZodValidation({
  params: operatorInboxIdParamsSchema,
  body: EscalateAgentActionBodySchema
});
