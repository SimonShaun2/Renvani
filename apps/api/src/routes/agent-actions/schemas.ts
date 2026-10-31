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

/** Optional optimistic-concurrency token (the `version` from the last read); mismatch → 409. Used by reject. */
export const AgentActionStateChangeBodySchema = z
  .object({ expectedVersion: z.number().int().nonnegative().optional() })
  .nullish()
  .transform((value) => value ?? {});
export type AgentActionStateChangeBody = z.infer<typeof AgentActionStateChangeBodySchema>;

/**
 * Approve and execute must name the `version` the operator saw (TE-STALE-01/02): missing → 400,
 * mismatch → 409. Never applied blind.
 */
export const AgentActionGuardedStateChangeBodySchema = z.object({
  expectedVersion: z.number().int().nonnegative()
});
export type AgentActionGuardedStateChangeBody = z.infer<typeof AgentActionGuardedStateChangeBodySchema>;

export const agentActionStateChangeValidation = withZodValidation({
  params: AgentActionIdParamsV1Schema,
  body: AgentActionStateChangeBodySchema
});

export const agentActionGuardedStateChangeValidation = withZodValidation({
  params: AgentActionIdParamsV1Schema,
  body: AgentActionGuardedStateChangeBodySchema
});

/** Optional `Idempotency-Key` header for approve/execute (TE-DUP-01/02). */
export const AGENT_ACTION_IDEMPOTENCY_KEY_MAX = 128;

export function readIdempotencyKeyHeader(headers: Record<string, unknown>): string | undefined {
  const raw = headers["idempotency-key"];
  if (typeof raw !== "string") {
    return undefined;
  }
  const key = raw.trim();
  return key.length > 0 && key.length <= AGENT_ACTION_IDEMPOTENCY_KEY_MAX ? key : undefined;
}
