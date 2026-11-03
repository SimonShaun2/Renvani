import { z } from "zod";

export const ImportJobCommitRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  sourceId: z.string().min(1).max(256),
  jobNumber: z.string().min(1).max(30),
  customerId: z.string().uuid().optional(),
  customerSourceId: z.string().min(1).max(256).optional(),
  propertySourceId: z.string().min(1).max(256).optional(),
  title: z.string().min(1).max(255),
  status: z.string().max(64).optional(),
  type: z.string().max(64).optional(),
  priority: z.string().max(32).optional(),
  leadSource: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  scheduledStart: z.coerce.date().optional().nullable(),
  scheduledEnd: z.coerce.date().optional().nullable(),
  actualStart: z.coerce.date().optional().nullable(),
  actualEnd: z.coerce.date().optional().nullable(),
  estimateTotal: z.string().optional().nullable(),
  invoiceTotal: z.string().optional().nullable(),
  amountPaid: z.string().optional().nullable(),
});

export type ImportJobCommitRow = z.infer<typeof ImportJobCommitRowSchema>;

export const ImportEstimateCommitRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  sourceId: z.string().min(1).max(256),
  estimateNumber: z.string().min(1).max(30),
  customerId: z.string().uuid().optional(),
  customerSourceId: z.string().min(1).max(256).optional(),
  jobSourceId: z.string().min(1).max(256).optional(),
  status: z.string().max(64).optional(),
  title: z.string().max(255).optional().nullable(),
  subtotal: z.string().optional(),
  total: z.string().min(1),
  sentAt: z.coerce.date().optional().nullable(),
  approvedAt: z.coerce.date().optional().nullable(),
  declinedAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  approvedByName: z.string().max(255).optional().nullable(),
});

export type ImportEstimateCommitRow = z.infer<typeof ImportEstimateCommitRowSchema>;

export interface ImportHistoryChunkCommitContext {
  companyId: string;
  importSessionId: string;
  sourceSystem: string;
  actorId?: string;
}

export interface ImportHistoryChunkCommitRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportHistoryChunkCommitResult {
  rowsCommitted: number;
  rowsFailed: number;
  errors: ImportHistoryChunkCommitRowError[];
}
