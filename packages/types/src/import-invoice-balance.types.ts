import { z } from "zod";

export const ImportInvoiceCommitRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  sourceId: z.string().min(1).max(256),
  invoiceNumber: z.string().min(1).max(30),
  customerId: z.string().uuid().optional(),
  customerSourceId: z.string().min(1).max(256).optional(),
  jobSourceId: z.string().min(1).max(256).optional(),
  total: z.string().min(1),
  balanceDue: z.string().optional(),
  amountPaid: z.string().optional(),
  issuedAt: z.coerce.date().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
  title: z.string().max(255).optional().nullable(),
});

export type ImportInvoiceCommitRow = z.infer<typeof ImportInvoiceCommitRowSchema>;

export const ImportPaymentCommitRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  sourceId: z.string().min(1).max(256),
  invoiceSourceId: z.string().min(1).max(256),
  amount: z.string().min(1),
  paidAt: z.coerce.date(),
  method: z
    .enum(["card", "ach", "cash", "check", "financing", "other"])
    .optional()
    .default("other"),
  referenceNumber: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ImportPaymentCommitRow = z.infer<typeof ImportPaymentCommitRowSchema>;

export interface ImportInvoiceBalanceCommitContext {
  companyId: string;
  importSessionId: string;
  sourceSystem: string;
  actorId?: string;
}

export interface ImportInvoiceBalanceCommitRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportInvoiceBalanceCommitResult {
  invoicesCommitted: number;
  paymentsCommitted: number;
  rowsFailed: number;
  errors: ImportInvoiceBalanceCommitRowError[];
}
