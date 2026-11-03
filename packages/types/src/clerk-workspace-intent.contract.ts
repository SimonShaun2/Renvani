import { z } from "zod";

/** FS-235 pre-tenant reservation. The verified Clerk subject is derived server-side. */
export const ReserveClerkWorkspaceIntentBodySchema = z.object({
  name: z.string().trim().min(1).max(80)
}).strict();

export const ClerkWorkspaceIntentResponseSchema = z.object({
  id: z.string().uuid(),
  requestedName: z.string(),
  status: z.enum(["pending", "claimed", "uncertain", "reconciled"]),
  organizationId: z.string().min(1).optional(),
  createdAt: z.string().datetime()
}).strict();

export type ReserveClerkWorkspaceIntentBody = z.infer<typeof ReserveClerkWorkspaceIntentBodySchema>;
export type ClerkWorkspaceIntentResponse = z.infer<typeof ClerkWorkspaceIntentResponseSchema>;
