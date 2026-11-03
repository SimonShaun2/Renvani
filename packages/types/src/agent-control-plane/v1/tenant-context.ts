import { z } from "zod";

import { ContractVersionV1Schema, UuidSchema } from "./zod-shared.js";

export const ActorTypeV1Schema = z.enum(["user", "system", "ai", "customer"]);

export const AgentProductV1Schema = z.enum([
  "revenue",
  "scheduling",
  "service",
  "retention",
  "owner",
  "loyalty"
]);

export const ActorV1Schema = z.object({
  id: UuidSchema.optional(),
  type: ActorTypeV1Schema,
  agentProduct: AgentProductV1Schema.optional()
});

export const TenantContextV1Schema = z.object({
  contractVersion: ContractVersionV1Schema,
  companyId: UuidSchema,
  timezone: z.string().min(1),
  actor: ActorV1Schema,
  policyVersion: z.string().min(1),
  sessionId: UuidSchema.optional()
});

export type ActorTypeV1 = z.infer<typeof ActorTypeV1Schema>;
export type AgentProductV1 = z.infer<typeof AgentProductV1Schema>;
export type ActorV1 = z.infer<typeof ActorV1Schema>;
export type TenantContextV1 = z.infer<typeof TenantContextV1Schema>;
