import { z } from "zod";

export const IMPORT_INVOICE_BALANCE_COMMIT_JOB_NAME = "import-invoice-balance-commit";

const importBundleEntitySchema = z.enum(["invoices", "payments"]);

export const ImportInvoiceBalanceCommitPayloadSchema = z.object({
  companyId: z.string().uuid(),
  importSessionId: z.string().uuid(),
  sourceSystem: z.string().min(1).max(64),
  entityType: importBundleEntitySchema,
  chunkIndex: z.number().int().nonnegative().default(0),
  chunksTotal: z.number().int().positive().default(1),
  rowWindow: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .optional(),
  lineageMaps: z
    .object({
      customers: z.record(z.string(), z.string().uuid()).optional(),
      jobs: z.record(z.string(), z.string().uuid()).optional(),
      invoices: z.record(z.string(), z.string().uuid()).optional(),
    })
    .optional(),
});

export type ImportInvoiceBalanceCommitPayload = z.infer<typeof ImportInvoiceBalanceCommitPayloadSchema>;
