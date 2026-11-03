import { z } from "zod";

import { UuidSchema } from "../zod-shared.js";

export const LoyaltyReminderRuleFamilyV1Schema = z.enum(["plan_cadence", "lapsed_reactivation"]);

export const LoyaltyReminderProposeParamsV1Schema = z.object({
  customerId: UuidSchema,
  ruleFamily: LoyaltyReminderRuleFamilyV1Schema,
  maintenancePlanId: UuidSchema.optional(),
  evidenceJobId: UuidSchema.optional(),
  /** FS-MIGRATE-M8 — migrated job-history chunk provenance when rule is history-driven */
  importSessionId: UuidSchema.optional(),
  daysSinceLastService: z.number().int().nonnegative().optional(),
  summary: z.string().min(1).max(500)
});

export type LoyaltyReminderRuleFamilyV1 = z.infer<typeof LoyaltyReminderRuleFamilyV1Schema>;
export type LoyaltyReminderProposeParamsV1 = z.infer<typeof LoyaltyReminderProposeParamsV1Schema>;
