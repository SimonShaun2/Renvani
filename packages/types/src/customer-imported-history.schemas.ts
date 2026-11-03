import { z } from "zod";

const importedHistoryJobSchema = z.object({
  id: z.string().uuid(),
  jobNumber: z.string(),
  title: z.string(),
  status: z.string(),
  occurredAt: z.string().datetime(),
  sourceSystem: z.string().nullable(),
  sourceId: z.string().nullable(),
  importSessionId: z.string().uuid().nullable()
});

const importedHistoryEstimateSchema = z.object({
  id: z.string().uuid(),
  estimateNumber: z.string(),
  title: z.string().nullable(),
  status: z.string(),
  total: z.string(),
  occurredAt: z.string().datetime(),
  sourceSystem: z.string().nullable(),
  sourceId: z.string().nullable(),
  importSessionId: z.string().uuid().nullable()
});

export const customerImportedHistoryResponseSchema = z.object({
  customerId: z.string().uuid(),
  jobs: z.array(importedHistoryJobSchema),
  estimates: z.array(importedHistoryEstimateSchema)
});

export type CustomerImportedHistoryResponse = z.infer<typeof customerImportedHistoryResponseSchema>;
export type CustomerImportedHistoryJob = z.infer<typeof importedHistoryJobSchema>;
export type CustomerImportedHistoryEstimate = z.infer<typeof importedHistoryEstimateSchema>;
