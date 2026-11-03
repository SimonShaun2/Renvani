import { z } from "zod";

export const communicationsImportRowSchema = z.object({
  sourceId: z.string().min(1).max(256),
  customerSourceId: z.string().min(1).max(256).optional(),
  jobSourceId: z.string().min(1).max(256).optional(),
  channel: z.enum(["sms", "email", "in_app"]),
  direction: z.enum(["outbound", "inbound"]),
  toAddress: z.string().min(1).max(255),
  fromAddress: z.string().max(255).optional().nullable(),
  subject: z.string().max(255).optional().nullable(),
  body: z.string().min(1),
  sentAt: z.coerce.date().optional().nullable(),
  providerMessageId: z.string().max(255).optional().nullable(),
  providerStatus: z.string().max(50).optional().nullable(),
});

export type CommunicationsImportRow = z.infer<typeof communicationsImportRowSchema>;

export const ImportCommunicationCommitRowSchema = communicationsImportRowSchema.extend({
  rowNumber: z.number().int().positive(),
  customerId: z.string().uuid().optional(),
});

export type ImportCommunicationCommitRow = z.infer<typeof ImportCommunicationCommitRowSchema>;

export interface ImportCommunicationsCommitContext {
  companyId: string;
  importSessionId: string;
  sourceSystem: string;
  actorId?: string;
}

export interface ImportCommunicationsCommitRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportCommunicationsCommitResult {
  messagesCommitted: number;
  rowsFailed: number;
  errors: ImportCommunicationsCommitRowError[];
}
