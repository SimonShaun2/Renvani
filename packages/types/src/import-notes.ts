import { z } from "zod";

import { IMPORT_SOURCE_SYSTEM_IDS, type ImportSourceSystemId } from "./import-price-book.js";

export const IMPORT_NOTE_SCOPES = ["customer", "job"] as const;

export type ImportNoteScope = (typeof IMPORT_NOTE_SCOPES)[number];

export interface NoteImportRow {
  sourceId: string;
  scope: ImportNoteScope;
  content: string;
  isInternal: boolean;
  customerSourceId?: string;
  jobSourceId?: string;
  notedAt: Date | null;
}

export const noteImportRowSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(256),
    scope: z.enum(IMPORT_NOTE_SCOPES),
    content: z.string().trim().min(1).max(50_000),
    isInternal: z.boolean(),
    customerSourceId: z.string().trim().min(1).max(256).optional(),
    jobSourceId: z.string().trim().min(1).max(256).optional(),
    notedAt: z.coerce.date().nullable().optional(),
  })
  .superRefine((row, ctx) => {
    if (row.scope === "customer" && !row.customerSourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customerSourceId is required for customer-scoped notes",
        path: ["customerSourceId"],
      });
    }

    if (row.scope === "job" && !row.jobSourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "jobSourceId is required for job-scoped notes",
        path: ["jobSourceId"],
      });
    }
  });

export interface NotesImportCommitResult {
  importedRows: number;
  skippedRows: number;
  customerNotes: number;
  jobNotes: number;
}

export type { ImportSourceSystemId };
export { IMPORT_SOURCE_SYSTEM_IDS };
