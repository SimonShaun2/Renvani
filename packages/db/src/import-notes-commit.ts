import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { noteImportRowSchema, type ImportSourceSystemId, type NotesImportCommitResult } from "@fsm/types";

import { db } from "./client.js";
import { mapNoteImportRow, type ParsedImportRow } from "./import-notes-rows.js";
import { customerNotes, customers, jobNotes, jobs } from "./schema.js";

export type { ParsedImportRow, NotesValidationResult } from "./import-notes-rows.js";
export { mapNoteImportRow, validateNoteImportRows } from "./import-notes-rows.js";

async function resolveCustomerIdByLineage(
  companyId: string,
  sourceSystem: ImportSourceSystemId,
  customerSourceId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.companyId, companyId),
        eq(customers.sourceSystem, sourceSystem),
        eq(customers.sourceId, customerSourceId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

async function resolveJobIdByLineage(
  companyId: string,
  sourceSystem: ImportSourceSystemId,
  jobSourceId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        eq(jobs.sourceSystem, sourceSystem),
        eq(jobs.sourceId, jobSourceId),
        isNull(jobs.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

async function upsertCustomerNote(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  customerId: string;
  row: ReturnType<typeof noteImportRowSchema.parse>;
  now: Date;
}): Promise<void> {
  const notedAt = options.row.notedAt ?? options.now;
  const existing = await db
    .select({ id: customerNotes.id })
    .from(customerNotes)
    .where(
      and(
        eq(customerNotes.companyId, options.companyId),
        eq(customerNotes.sourceSystem, options.sourceSystem),
        eq(customerNotes.sourceId, options.row.sourceId),
        isNull(customerNotes.deletedAt),
      ),
    )
    .limit(1);

  const noteId = existing[0]?.id ?? randomUUID();

  if (existing.length === 0) {
    await db.insert(customerNotes).values({
      id: noteId,
      companyId: options.companyId,
      customerId: options.customerId,
      content: options.row.content,
      isInternal: options.row.isInternal,
      notedAt,
      sourceSystem: options.sourceSystem,
      sourceId: options.row.sourceId,
      importSessionId: options.importSessionId,
      createdAt: notedAt,
      updatedAt: options.now,
    });
    return;
  }

  await db
    .update(customerNotes)
    .set({
      customerId: options.customerId,
      content: options.row.content,
      isInternal: options.row.isInternal,
      notedAt,
      importSessionId: options.importSessionId,
      updatedAt: options.now,
    })
    .where(and(eq(customerNotes.companyId, options.companyId), eq(customerNotes.id, noteId), isNull(customerNotes.deletedAt)));
}

async function upsertJobNote(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  jobId: string;
  row: ReturnType<typeof noteImportRowSchema.parse>;
  now: Date;
}): Promise<void> {
  const notedAt = options.row.notedAt ?? options.now;
  const existing = await db
    .select({ id: jobNotes.id })
    .from(jobNotes)
    .where(
      and(
        eq(jobNotes.companyId, options.companyId),
        eq(jobNotes.sourceSystem, options.sourceSystem),
        eq(jobNotes.sourceId, options.row.sourceId),
        isNull(jobNotes.deletedAt),
      ),
    )
    .limit(1);

  const noteId = existing[0]?.id ?? randomUUID();

  if (existing.length === 0) {
    await db.insert(jobNotes).values({
      id: noteId,
      companyId: options.companyId,
      jobId: options.jobId,
      content: options.row.content,
      isInternal: options.row.isInternal,
      notedAt,
      sourceSystem: options.sourceSystem,
      sourceId: options.row.sourceId,
      importSessionId: options.importSessionId,
      createdAt: notedAt,
      updatedAt: options.now,
    });
    return;
  }

  await db
    .update(jobNotes)
    .set({
      jobId: options.jobId,
      content: options.row.content,
      isInternal: options.row.isInternal,
      notedAt,
      importSessionId: options.importSessionId,
      updatedAt: options.now,
    })
    .where(and(eq(jobNotes.companyId, options.companyId), eq(jobNotes.id, noteId), isNull(jobNotes.deletedAt)));
}

export async function commitNoteImportRows(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  rows: ParsedImportRow[];
  columnMapping: Record<string, string | null>;
  invalidRowNumbers: Set<number>;
}): Promise<NotesImportCommitResult> {
  let importedRows = 0;
  let skippedRows = 0;
  let customerNoteCount = 0;
  let jobNoteCount = 0;
  const now = new Date();

  for (const row of options.rows) {
    if (options.invalidRowNumbers.has(row.rowNumber)) {
      skippedRows += 1;
      continue;
    }

    const mapped = mapNoteImportRow(row.values, options.columnMapping);
    if (!mapped) {
      skippedRows += 1;
      continue;
    }

    const parsed = noteImportRowSchema.safeParse(mapped);
    if (!parsed.success) {
      skippedRows += 1;
      continue;
    }

    if (parsed.data.scope === "customer") {
      const customerId = await resolveCustomerIdByLineage(
        options.companyId,
        options.sourceSystem,
        parsed.data.customerSourceId!,
      );

      if (!customerId) {
        skippedRows += 1;
        continue;
      }

      await upsertCustomerNote({
        companyId: options.companyId,
        importSessionId: options.importSessionId,
        sourceSystem: options.sourceSystem,
        customerId,
        row: parsed.data,
        now,
      });
      customerNoteCount += 1;
      importedRows += 1;
      continue;
    }

    const jobId = await resolveJobIdByLineage(
      options.companyId,
      options.sourceSystem,
      parsed.data.jobSourceId!,
    );

    if (!jobId) {
      skippedRows += 1;
      continue;
    }

    await upsertJobNote({
      companyId: options.companyId,
      importSessionId: options.importSessionId,
      sourceSystem: options.sourceSystem,
      jobId,
      row: parsed.data,
      now,
    });
    jobNoteCount += 1;
    importedRows += 1;
  }

  return {
    importedRows,
    skippedRows,
    customerNotes: customerNoteCount,
    jobNotes: jobNoteCount,
  };
}

export async function softDeleteNotesImport(companyId: string, importSessionId: string): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(customerNotes)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(customerNotes.companyId, companyId),
          eq(customerNotes.importSessionId, importSessionId),
          isNull(customerNotes.deletedAt),
        ),
      );

    await tx
      .update(jobNotes)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(jobNotes.companyId, companyId),
          eq(jobNotes.importSessionId, importSessionId),
          isNull(jobNotes.deletedAt),
        ),
      );
  });
}
