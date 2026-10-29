import { z } from "zod";

/** FS-235. This slice only reserves an intent; it does not create or activate an org. */
export const ReserveClerkWorkspaceIntentBodySchema = z.object({
  name: z.string().trim().min(1).max(80)
}).strict();

export const ClerkWorkspaceIntentResponseSchema = z.object({
  id: z.string().uuid(),
  requestedName: z.string(),
  status: z.literal("reserved"),
  createdAt: z.string().datetime()
}).strict();

export type ReserveClerkWorkspaceIntentBody = z.infer<typeof ReserveClerkWorkspaceIntentBodySchema>;
export type ClerkWorkspaceIntentResponse = z.infer<typeof ClerkWorkspaceIntentResponseSchema>;
