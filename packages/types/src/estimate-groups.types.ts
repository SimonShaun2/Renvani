import { z } from "zod";

/** Priority preserves the existing list's selected/converted option semantics. */
export const ESTIMATE_GROUP_STATUS_PRIORITY = [
  "converted",
  "approved",
  "viewed",
  "sent",
  "declined",
  "expired",
  "revised",
  "draft",
] as const;
export const EstimateGroupStatusSchema = z.enum(ESTIMATE_GROUP_STATUS_PRIORITY);
export const EstimateGroupsQuerySchema = z
  .object({
    status: EstimateGroupStatusSchema.optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type EstimateGroupsQuery = z.infer<typeof EstimateGroupsQuerySchema>;

const money = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const isoDate = z.string().datetime();
export const EstimateGroupListItemSchema = z.object({
  id: z.string(),
  estimateId: z.string().uuid(),
  estimateIds: z.array(z.string().uuid()).min(1),
  estimateNumber: z.string(),
  title: z.string().nullable(),
  status: EstimateGroupStatusSchema,
  total: money,
  subtotal: money,
  customer: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  sentAt: isoDate.nullable(),
  expiresAt: isoDate.nullable(),
  approvedAt: isoDate.nullable(),
  declinedAt: isoDate.nullable(),
  createdAt: isoDate,
  tierCount: z.number().int().positive(),
  tierLabel: z.string().nullable(),
  tierGroupId: z.string().uuid().nullable(),
});
export const EstimateGroupsResponseSchema = z.object({
  data: z.array(EstimateGroupListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type EstimateGroupListItem = z.infer<typeof EstimateGroupListItemSchema>;
export type EstimateGroupsResponse = z.infer<
  typeof EstimateGroupsResponseSchema
>;
