import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import type { Job } from "bullmq";
import pino from "pino";

import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import {
  commitImportedEstimateRows,
  commitImportedJobRows,
  createDbHistoryChunkResolver,
  customers,
  db,
  emitEventWithExecutor,
  importChunkRuns,
  importSessions,
} from "@fsm/db";
import { parseTabularImportFile } from "@fsm/import-engine";
import {
  IMPORT_CHUNK_COMMIT_JOB_NAME,
  ImportChunkCommitPayloadSchema,
  buildImportChunkIdempotencyKey,
  type ImportChunkCommitPayload,
} from "@fsm/jobs";
import {
  IMPORT_QUEUE_JOB_NAMES,
  ImportEstimateCommitRowSchema,
  ImportJobCommitRowSchema,
  buildImportChunkCommitJobId,
  sanitizeSpreadsheetCell,
  type ColumnMapping,
} from "@fsm/types";

import { emitImportWorkflowStepReceipt } from "../lib/import-workflow-step-receipt.js";
import {
  normalizeImportValidationErrors,
  persistImportSessionReconciliationReportBestEffort
} from "../lib/persist-import-session-reconciliation.js";

import {
  mergeImportChunkSessionProgress,
  parseImportChunkSessionProgress,
} from "../lib/import-chunk-progress.js";

type ImportSessionRow = typeof importSessions.$inferSelect;
type CustomerInsert = typeof customers.$inferInsert;

interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

interface ChunkCommitResult {
  rowsOk: number;
  rowsFailed: number;
}

const logger = pino({
  name: "import-chunk-commit-processor",
});

class ImportChunkCommitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeColumnMappings(value: unknown): ColumnMapping {
  if (!isPlainObject(value)) {
    return {};
  }

  const mapping: ColumnMapping = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string" || entryValue === null) {
      mapping[key] = entryValue;
    }
  }

  return mapping;
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = sanitizeSpreadsheetCell(value.trim());
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseTabularRows(buffer: Buffer, fileName: string): ParsedCsvRow[] {
  return parseTabularImportFile(buffer, fileName).rows;
}

function resolveRowWindow(
  payload: ImportChunkCommitPayload,
  totalRows: number,
): { start: number; end: number } {
  if (payload.rowWindow) {
    return {
      start: payload.rowWindow.start,
      end: Math.min(payload.rowWindow.end, totalRows),
    };
  }

  const chunkSize = Math.max(1, Math.ceil(totalRows / payload.chunksTotal));
  const start = payload.chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, totalRows);

  return { start, end };
}

function mapCustomerRow(values: Record<string, string>, columnMapping: ColumnMapping) {
  const mappedValues: Record<string, string> = {};

  for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
      continue;
    }

    mappedValues[fieldName] = values[csvColumn] ?? "";
  }

  const firstName = normalizeTextValue(mappedValues.firstName);
  const lastName = normalizeTextValue(mappedValues.lastName);
  const displayName = normalizeTextValue(mappedValues.displayName);
  const sourceId = normalizeTextValue(mappedValues.sourceId);

  return {
    firstName: firstName ?? displayName ?? "",
    lastName: lastName ?? "",
    displayName,
    email: normalizeTextValue(mappedValues.email)?.toLowerCase() ?? null,
    phone: normalizeTextValue(mappedValues.phone),
    altPhone: normalizeTextValue(mappedValues.altPhone),
    notes: normalizeTextValue(mappedValues.notes),
    tags:
      normalizeTextValue(mappedValues.tags)
        ?.split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? [],
    sourceId,
  };
}

async function getImportSessionOrNull(
  companyId: string,
  importSessionId: string,
): Promise<ImportSessionRow | null> {
  return (
    (await db.query.importSessions.findFirst({
      where: (table, operators) =>
        operators.and(
          operators.eq(table.companyId, companyId),
          operators.eq(table.id, importSessionId),
          operators.isNull(table.deletedAt),
        ),
    })) ?? null
  );
}

async function findChunkRunByIdempotencyKey(idempotencyKey: string) {
  return (
    (await db.select().from(importChunkRuns).where(eq(importChunkRuns.idempotencyKey, idempotencyKey)))[0] ??
    null
  );
}

async function upsertCustomerByLineage(
  companyId: string,
  importSessionId: string,
  sourceSystem: string,
  sourceId: string,
  mappedRow: ReturnType<typeof mapCustomerRow>,
): Promise<void> {
  const existing =
    (
      await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.companyId, companyId),
            eq(customers.sourceSystem, sourceSystem),
            eq(customers.sourceId, sourceId),
            isNull(customers.deletedAt),
          ),
        )
    )[0] ?? null;

  const now = new Date();
  const sharedValues = {
    firstName: mappedRow.firstName,
    lastName: mappedRow.lastName,
    displayName: mappedRow.displayName,
    email: mappedRow.email,
    phone: mappedRow.phone,
    altPhone: mappedRow.altPhone,
    internalNotes: mappedRow.notes,
    tags: mappedRow.tags,
    sourceSystem,
    sourceId,
    importSessionId,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(customers)
      .set(sharedValues)
      .where(
        and(eq(customers.companyId, companyId), eq(customers.id, existing.id), isNull(customers.deletedAt)),
      )
      .returning();
    return;
  }

  const insertValues: CustomerInsert = {
    id: randomUUID(),
    companyId,
    ...sharedValues,
  };

  await db.insert(customers).values(insertValues).returning();
}

function mapRowValues(values: Record<string, string>, columnMapping: ColumnMapping): Record<string, string> {
  const mappedValues: Record<string, string> = {};

  for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
      continue;
    }

    mappedValues[fieldName] = values[csvColumn] ?? "";
  }

  return mappedValues;
}

async function loadChunkRows(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
): Promise<ParsedCsvRow[]> {
  const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
  const parsedRows = parseTabularRows(fileBuffer, importSession.fileName);
  const { start, end } = resolveRowWindow(payload, parsedRows.length);
  return parsedRows.slice(start, end);
}

async function commitCustomerChunk(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
): Promise<ChunkCommitResult> {
  const chunkRows = await loadChunkRows(payload, importSession);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);

  let rowsOk = 0;
  let rowsFailed = 0;

  for (const row of chunkRows) {
    if (!row) {
      continue;
    }

    const mappedRow = mapCustomerRow(row.values, columnMapping);

    if (!mappedRow.sourceId) {
      rowsFailed += 1;
      continue;
    }

    if (mappedRow.firstName.length === 0 && mappedRow.lastName.length === 0 && !mappedRow.displayName) {
      rowsFailed += 1;
      continue;
    }

    await upsertCustomerByLineage(
      payload.companyId,
      payload.importSessionId,
      payload.sourceSystem,
      mappedRow.sourceId,
      mappedRow,
    );
    rowsOk += 1;
  }

  return { rowsOk, rowsFailed };
}

async function commitJobHistoryChunk(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
): Promise<ChunkCommitResult> {
  const chunkRows = await loadChunkRows(payload, importSession);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);
  const resolver = await createDbHistoryChunkResolver(payload.companyId, payload.sourceSystem);

  const jobRows = chunkRows.map((row) => {
    const mapped = mapRowValues(row.values, columnMapping);
    return ImportJobCommitRowSchema.parse({
      rowNumber: row.rowNumber,
      sourceId: normalizeTextValue(mapped.sourceId) ?? mapped.jobNumber,
      jobNumber: mapped.jobNumber,
      customerId: normalizeTextValue(mapped.customerId) ?? undefined,
      customerSourceId: normalizeTextValue(mapped.customerSourceId) ?? undefined,
      propertySourceId: normalizeTextValue(mapped.propertySourceId) ?? undefined,
      title: normalizeTextValue(mapped.title) ?? mapped.jobNumber,
      status: normalizeTextValue(mapped.status) ?? undefined,
      type: normalizeTextValue(mapped.type) ?? undefined,
      priority: normalizeTextValue(mapped.priority) ?? undefined,
      leadSource: normalizeTextValue(mapped.leadSource) ?? undefined,
      description: normalizeTextValue(mapped.description) ?? undefined,
      scheduledStart: normalizeTextValue(mapped.scheduledStart) ?? undefined,
      scheduledEnd: normalizeTextValue(mapped.scheduledEnd) ?? undefined,
      actualStart: normalizeTextValue(mapped.actualStart) ?? undefined,
      actualEnd: normalizeTextValue(mapped.actualEnd) ?? undefined,
      estimateTotal: normalizeTextValue(mapped.estimateTotal) ?? undefined,
      invoiceTotal: normalizeTextValue(mapped.invoiceTotal) ?? undefined,
      amountPaid: normalizeTextValue(mapped.amountPaid) ?? undefined,
    });
  });

  const result = await commitImportedJobRows(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      sourceSystem: payload.sourceSystem,
    },
    jobRows,
    resolver,
  );

  return {
    rowsOk: result.rowsCommitted,
    rowsFailed: result.rowsFailed,
  };
}

async function commitEstimateHistoryChunk(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
): Promise<ChunkCommitResult> {
  const chunkRows = await loadChunkRows(payload, importSession);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);
  const resolver = await createDbHistoryChunkResolver(payload.companyId, payload.sourceSystem);

  const estimateRows = chunkRows.map((row) => {
    const mapped = mapRowValues(row.values, columnMapping);
    return ImportEstimateCommitRowSchema.parse({
      rowNumber: row.rowNumber,
      sourceId: normalizeTextValue(mapped.sourceId) ?? mapped.estimateNumber,
      estimateNumber: mapped.estimateNumber,
      customerId: normalizeTextValue(mapped.customerId) ?? undefined,
      customerSourceId: normalizeTextValue(mapped.customerSourceId) ?? undefined,
      jobSourceId: normalizeTextValue(mapped.jobSourceId) ?? undefined,
      status: normalizeTextValue(mapped.status) ?? undefined,
      title: normalizeTextValue(mapped.title) ?? undefined,
      subtotal: normalizeTextValue(mapped.subtotal) ?? undefined,
      total: mapped.total,
      sentAt: normalizeTextValue(mapped.sentAt) ?? undefined,
      approvedAt: normalizeTextValue(mapped.approvedAt) ?? undefined,
      declinedAt: normalizeTextValue(mapped.declinedAt) ?? undefined,
      expiresAt: normalizeTextValue(mapped.expiresAt) ?? undefined,
      approvedByName: normalizeTextValue(mapped.approvedByName) ?? undefined,
    });
  });

  const result = await commitImportedEstimateRows(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      sourceSystem: payload.sourceSystem,
    },
    estimateRows,
    resolver,
  );

  return {
    rowsOk: result.rowsCommitted,
    rowsFailed: result.rowsFailed,
  };
}

async function commitChunkForEntity(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
): Promise<ChunkCommitResult> {
  switch (payload.entityType) {
    case "customers":
      return commitCustomerChunk(payload, importSession);
    case "jobs":
      return commitJobHistoryChunk(payload, importSession);
    case "estimates":
      return commitEstimateHistoryChunk(payload, importSession);
    default:
      throw new ImportChunkCommitError(
        "UNSUPPORTED_ENTITY_TYPE",
        `Chunk commit is not implemented for entity type ${payload.entityType}`,
      );
  }
}

function assertPayloadIdempotencyKey(payload: ImportChunkCommitPayload): void {
  const expectedKey = buildImportChunkIdempotencyKey(
    payload.importSessionId,
    payload.entityType,
    payload.chunkIndex,
  );

  if (payload.idempotencyKey !== expectedKey) {
    throw new ImportChunkCommitError(
      "IDEMPOTENCY_KEY_MISMATCH",
      "import-chunk-commit idempotencyKey does not match session, entity, and chunk index",
    );
  }
}

function assertSessionMatchesPayload(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
): void {
  if (importSession.entityType !== payload.entityType) {
    throw new ImportChunkCommitError(
      "ENTITY_TYPE_MISMATCH",
      "Import session entity type does not match chunk payload",
    );
  }

  if (
    payload.importBundleId !== undefined &&
    importSession.importBundleId !== null &&
    importSession.importBundleId !== payload.importBundleId
  ) {
    throw new ImportChunkCommitError(
      "BUNDLE_MISMATCH",
      "importBundleId does not match import session",
    );
  }
}

async function markChunkRunRunning(
  payload: ImportChunkCommitPayload,
  existingRun: Awaited<ReturnType<typeof findChunkRunByIdempotencyKey>>,
): Promise<string> {
  const now = new Date();

  if (existingRun) {
    await db
      .update(importChunkRuns)
      .set({
        status: "running",
        cursor: payload.cursor,
        updatedAt: now,
      })
      .where(eq(importChunkRuns.id, existingRun.id))
      .returning();

    return existingRun.id;
  }

  const chunkRunId = randomUUID();

  await db
    .insert(importChunkRuns)
    .values({
      id: chunkRunId,
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      entityType: payload.entityType,
      chunkIndex: payload.chunkIndex,
      chunksTotal: payload.chunksTotal,
      idempotencyKey: payload.idempotencyKey,
      status: "running",
      cursor: payload.cursor,
    })
    .returning();

  return chunkRunId;
}

async function finalizeChunkRun(
  payload: ImportChunkCommitPayload,
  importSession: ImportSessionRow,
  chunkResult: ChunkCommitResult,
  incrementChunksDone: boolean,
): Promise<void> {
  const now = new Date();
  const priorProgress = parseImportChunkSessionProgress(importSession.progress);
  const mergedProgress = mergeImportChunkSessionProgress(
    priorProgress,
    payload,
    chunkResult,
    incrementChunksDone,
  );
  const allChunksDone =
    typeof mergedProgress.chunksDone === "number" &&
    mergedProgress.chunksDone >= payload.chunksTotal;

  await db.transaction(async (tx) => {
    await tx
      .update(importChunkRuns)
      .set({
        status: "completed",
        rowsOk: chunkResult.rowsOk,
        rowsFailed: chunkResult.rowsFailed,
        completedAt: now,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(importChunkRuns.idempotencyKey, payload.idempotencyKey))
      .returning();

    await tx
      .update(importSessions)
      .set({
        status: allChunksDone ? "completed" : "importing",
        progress: mergedProgress,
        importedRows: (importSession.importedRows ?? 0) + chunkResult.rowsOk,
        errorRows: (importSession.errorRows ?? 0) + chunkResult.rowsFailed,
        completedAt: allChunksDone ? now : importSession.completedAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(importSessions.companyId, payload.companyId),
          eq(importSessions.id, payload.importSessionId),
          isNull(importSessions.deletedAt),
        ),
      )
      .returning();

    if (allChunksDone) {
      await emitEventWithExecutor(tx, {
        companyId: payload.companyId,
        eventType: "import.completed",
        actorType: "system",
        entityType: "import_session",
        entityId: payload.importSessionId,
        payload: {
          importedRows: mergedProgress.rowsOk ?? chunkResult.rowsOk,
          rowsFailed: mergedProgress.rowsFailed ?? chunkResult.rowsFailed,
          chunksTotal: payload.chunksTotal,
        },
        summary: `Import ${importSession.fileName} completed (chunked)`,
      });
    }
  });
}

async function markChunkRunFailed(payload: ImportChunkCommitPayload, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : "import-chunk-commit failed";
  const now = new Date();

  await db
    .update(importChunkRuns)
    .set({
      status: "failed",
      errorMessage,
      updatedAt: now,
    })
    .where(eq(importChunkRuns.idempotencyKey, payload.idempotencyKey))
    .returning();
}

export async function handleImportChunkCommit(job: Job<Record<string, unknown>>): Promise<void> {
  const parsed = ImportChunkCommitPayloadSchema.safeParse(job.data);

  if (!parsed.success) {
    logger.warn(
      { jobId: job.id ?? null, issues: parsed.error.issues },
      "import-chunk-commit job payload failed validation",
    );
    return;
  }

  const payload = parsed.data;

  try {
    assertPayloadIdempotencyKey(payload);

    const importSession = await getImportSessionOrNull(payload.companyId, payload.importSessionId);

    if (!importSession) {
      logger.warn(
        { companyId: payload.companyId, importSessionId: payload.importSessionId },
        "import-chunk-commit skipped because import session was not found",
      );
      return;
    }

    assertSessionMatchesPayload(payload, importSession);

    const existingRun = await findChunkRunByIdempotencyKey(payload.idempotencyKey);

    if (existingRun?.status === "completed") {
      logger.info(
        { idempotencyKey: payload.idempotencyKey, importSessionId: payload.importSessionId },
        "import-chunk-commit skipped; chunk already completed",
      );
      await emitImportWorkflowStepReceipt({
        companyId: payload.companyId,
        importSessionId: payload.importSessionId,
        ...(payload.importBundleId !== undefined ? { importBundleId: payload.importBundleId } : {}),
        stepKind: IMPORT_QUEUE_JOB_NAMES.importChunkCommit,
        idempotencyKey: payload.idempotencyKey,
        state: "deduped_completed",
        chunkIndex: payload.chunkIndex,
        jobId: buildImportChunkCommitJobId(payload.importSessionId, payload.chunkIndex),
        summary: `Import chunk ${payload.chunkIndex} deduped (already completed)`,
      });
      return;
    }

    await markChunkRunRunning(payload, existingRun);

    const chunkResult = await commitChunkForEntity(payload, importSession);
    await finalizeChunkRun(payload, importSession, chunkResult, true);

    // Chunks can finish out of order, so trigger on the session actually reaching
    // "completed" (all chunks done), not on the last chunk number. Best-effort.
    try {
      const refreshedSession = await getImportSessionOrNull(payload.companyId, payload.importSessionId);
      if (refreshedSession?.status === "completed") {
        await persistImportSessionReconciliationReportBestEffort(
          payload.companyId,
          refreshedSession,
          normalizeImportValidationErrors(refreshedSession.validationErrors)
        );
      }
    } catch (error: unknown) {
      logger.warn(
        {
          companyId: payload.companyId,
          importSessionId: payload.importSessionId,
          err: error instanceof Error ? error.message : String(error)
        },
        "Failed to write import reconciliation report (best-effort; chunk unaffected)"
      );
    }

    await emitImportWorkflowStepReceipt({
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      ...(payload.importBundleId !== undefined ? { importBundleId: payload.importBundleId } : {}),
      stepKind: IMPORT_QUEUE_JOB_NAMES.importChunkCommit,
      idempotencyKey: payload.idempotencyKey,
      state: "completed",
      chunkIndex: payload.chunkIndex,
      jobId: buildImportChunkCommitJobId(payload.importSessionId, payload.chunkIndex),
      summary: `Import chunk ${payload.chunkIndex} completed`,
    });

    const progressPercent =
      payload.chunksTotal === 0
        ? 100
        : Math.round(((payload.chunkIndex + 1) / payload.chunksTotal) * 100);
    await job.updateProgress?.(progressPercent);
  } catch (error: unknown) {
    if (parsed.success) {
      await markChunkRunFailed(parsed.data, error);
      await emitImportWorkflowStepReceipt({
        companyId: parsed.data.companyId,
        importSessionId: parsed.data.importSessionId,
        ...(parsed.data.importBundleId !== undefined ? { importBundleId: parsed.data.importBundleId } : {}),
        stepKind: IMPORT_QUEUE_JOB_NAMES.importChunkCommit,
        idempotencyKey: parsed.data.idempotencyKey,
        state: "failed",
        chunkIndex: parsed.data.chunkIndex,
        jobId: buildImportChunkCommitJobId(parsed.data.importSessionId, parsed.data.chunkIndex),
        summary: `Import chunk ${parsed.data.chunkIndex} failed`,
      });
    }

    logger.error(
      {
        err: error,
        companyId: parsed.success ? parsed.data.companyId : null,
        importSessionId: parsed.success ? parsed.data.importSessionId : null,
      },
      "import-chunk-commit job failed",
    );
    throw error;
  }
}

export { IMPORT_CHUNK_COMMIT_JOB_NAME };
