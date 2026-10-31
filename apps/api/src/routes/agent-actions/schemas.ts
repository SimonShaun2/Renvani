import { z } from "zod";

import {
  AgentActionIdParamsV1Schema,
  ListAgentActionsQueryV1Schema,
  type ListAgentActionsQueryV1
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

export type ListAgentActionsQuery = ListAgentActionsQueryV1;

export const agentActionIdValidation = withZodValidation({ params: AgentActionIdParamsV1Schema });
export const listAgentActionsValidation = withZodValidation({ query: ListAgentActionsQueryV1Schema });

/** Optional optimistic-concurrency token (the `version` from the last read); mismatch → 409. */
export const AgentActionStateChangeBodySchema = z
  .object({ expectedVersion: z.number().int().nonnegative().optional() })
  .nullish()
  .transform((value) => value ?? {});
export type AgentActionStateChangeBody = z.infer<typeof AgentActionStateChangeBodySchema>;

export const agentActionStateChangeValidation = withZodValidation({
  params: AgentActionIdParamsV1Schema,
  body: AgentActionStateChangeBodySchema
});
