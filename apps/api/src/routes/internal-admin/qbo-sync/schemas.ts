import { z } from "zod";

export const listQboSyncIssuesQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

export const resolveQboSyncIssueParamsSchema = z.object({
  issueId: z.string().uuid()
});
