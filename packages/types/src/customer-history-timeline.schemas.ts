import { z } from "zod";

export const customerHistoryTimelineItemTypeSchema = z.enum([
  "job",
  "estimate",
  "invoice",
  "payment",
  "note",
  "communication"
]);

export type CustomerHistoryTimelineItemType = z.infer<typeof customerHistoryTimelineItemTypeSchema>;

export const customerHistoryTimelineLineageSchema = z.enum(["native", "imported"]);

export const customerHistoryTimelineItemSchema = z.object({
  id: z.string().uuid(),
  type: customerHistoryTimelineItemTypeSchema,
  occurredAt: z.string().datetime(),
  title: z.string(),
  subtitle: z.string().nullable(),
  status: z.string().nullable(),
  amount: z.string().nullable(),
  lineage: customerHistoryTimelineLineageSchema,
  sourceSystem: z.string().nullable(),
  sourceId: z.string().nullable(),
  importSessionId: z.string().uuid().nullable(),
  href: z.string().nullable()
});

export type CustomerHistoryTimelineItem = z.infer<typeof customerHistoryTimelineItemSchema>;

export const customerHistoryTimelineResponseSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(customerHistoryTimelineItemSchema),
  nextCursor: z.string().nullable()
});

export type CustomerHistoryTimelineResponse = z.infer<typeof customerHistoryTimelineResponseSchema>;

export const listCustomerHistoryTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
  types: z.string().min(1).optional()
});

export type ListCustomerHistoryTimelineQuery = z.infer<typeof listCustomerHistoryTimelineQuerySchema>;
