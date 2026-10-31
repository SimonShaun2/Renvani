import { and, eq, inArray, isNull } from "drizzle-orm";
import pino from "pino";

import {
  assets,
  customers,
  db,
  emitEvent,
  emitEventWithExecutor,
  importSessions,
  jobs,
  properties,
  softDeleteCommunicationsImport,
  softDeleteNotesImport,
  softDeleteServiceAgreementsImport,
  softDeletePriceBookImport
} from "@fsm/db";
import { importsQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  IMPORT_QUEUE_JOB_NAMES,
  buildImportWorkflowAuditPayloadV1,
  buildMapCsvColumnsIdempotencyKey,
  buildMapCsvColumnsJobId,
  sanitizeSpreadsheetCell,
  type ColumnMapping,
  type ImportCustomerUpdateSnapshotV1,
  type ImportEntityType,
  type ImportSession,
  type ImportSessionStatus,
  type ListImportsQuery,
  type PaginatedResult,
  type ValidationError
} from "@fsm/types";

import { scheduleEquipmentImportChunksFromSessionAiInferences } from "./import-equipment-commit.service.js";
import { scheduleMigrateFileBatchesFromSessionAiInferences } from "./import-migrate-file-batch.service.js";
import { rollbackImportedBilling } from "./import-rollback-billing.js";
import { scheduleImportChunkCommitsFromSessionAiInferences } from "./import-workflow-runtime.service.js";
import { uploadCsvToR2 } from "./file-upload.service.js";

type ImportSessionRow = typeof importSessions.$inferSelect;
type ImportSessionInsert = typeof importSessions.$inferInsert;
type TransactionExecutor = Pick<typeof db, "select" | "update" | "insert">;

interface CreateImportSessionOptions {
  entityType?: ImportEntityType;
  mimeType?: string;
}

type DuplicateAction = "skip" | "update_existing" | "import_new";

const logger = pino({
  name: "import-service"
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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

function normalizeValidationErrors(value: unknown): ValidationError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validationErrors: ValidationError[] = [];

  for (const entry of value) {
    if (!isPlainObject(entry)) {
      continue;
    }

    const row = entry.row;
    const field = entry.field;
    const message = entry.message;
    const rawValue = entry.value;

    if (
      typeof row === "number" &&
      typeof field === "string" &&
      typeof message === "string" &&
      typeof rawValue === "string"
    ) {
      validationErrors.push({
        row,
        field,
        message,
        value: rawValue
      });
    }
  }

  return validationErrors;
}

function normalizeAiInferences(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function extractCustomerUpdateSnapshots(aiInferences: unknown): ImportCustomerUpdateSnapshotV1[] {
  const root = normalizeAiInferences(aiInferences);
  const rollbackSnapshots = root.rollbackSnapshots;

  if (!isPlainObject(rollbackSnapshots)) {
    return [];
  }

  const updates = rollbackSnapshots.customerUpdates;

  if (!Array.isArray(updates)) {
    return [];
  }

  const snapshots: ImportCustomerUpdateSnapshotV1[] = [];

  for (const entry of updates) {
    if (!isPlainObject(entry) || typeof entry.customerId !== "string") {
      continue;
    }

    const before = entry.before;

    if (!isPlainObject(before)) {
      continue;
    }

    if (
      typeof before.firstName !== "string" ||
      typeof before.lastName !== "string" ||
      !Array.isArray(before.tags)
    ) {
      continue;
    }

    const propertyIds = Array.isArray(entry.propertyIds)
      ? entry.propertyIds.filter((id): id is string => typeof id === "string")
      : [];

    snapshots.push({
      customerId: entry.customerId,
      before: {
        firstName: before.firstName,
        lastName: before.lastName,
        displayName: typeof before.displayName === "string" ? before.displayName : null,
        email: typeof before.email === "string" ? before.email : null,
        phone: typeof before.phone === "string" ? before.phone : null,
        altPhone: typeof before.altPhone === "string" ? before.altPhone : null,
        tags: before.tags.filter((tag): tag is string => typeof tag === "string"),
        internalNotes: typeof before.internalNotes === "string" ? before.internalNotes : null
      },
      propertyIds
    });
  }

  return snapshots;
}

function toImportSession(row: ImportSessionRow): ImportSession {
  return {
    id: row.id,
    companyId: row.companyId,
    createdById: row.createdById,
    entityType: row.entityType as ImportEntityType,
    status: row.status as ImportSessionStatus,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    totalRows: row.totalRows,
    validRows: row.validRows,
    errorRows: row.errorRows,
    importedRows: row.importedRows,
    skippedRows: row.skippedRows,
    duplicateRows: row.duplicateRows,
    columnMappings: normalizeColumnMappings(row.columnMappings),
    validationErrors: normalizeValidationErrors(row.validationErrors),
    aiInferences: normalizeAiInferences(row.aiInferences),
    rolledBackAt: row.rolledBackAt,
    rolledBackById: row.rolledBackById,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

async function getImportSessionRow(
  companyId: string,
  importSessionId: string,
  executor: Pick<typeof db, "select">
): Promise<ImportSessionRow> {
  const rows = await executor
    .select()
    .from(importSessions)
    .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
    .limit(1);
  const importSession = rows[0];

  if (!importSession) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
  }

  return importSession;
}

async function markImportSessionFailed(
  companyId: string,
  importSessionId: string,
  message: string
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const importSession = await getImportSessionRow(companyId, importSessionId, tx);
      const now = new Date();

      await tx
        .update(importSessions)
        .set({
          status: "failed",
          errorMessage: message,
          updatedAt: now
        })
        .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
        .returning();

      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "import.failed",
        entityType: "import_session",
        entityId: importSession.id,
        payload: {
          errorMessage: message
        },
        summary: `Import ${importSession.fileName} failed`,
        actorType: "system"
      });
    });
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        companyId,
        importSessionId
      },
      "Failed to mark import session as failed"
    );
  }
}

export async function createImportSession(
  companyId: string,
  actorId: string,
  fileName: string,
  fileBuffer: Buffer,
  options: CreateImportSessionOptions = {}
): Promise<ImportSession> {
  const mimeType = options.mimeType ?? "text/csv";
  const entityType = options.entityType ?? "customers";
  const uploadedFile = await uploadCsvToR2(companyId, fileName, fileBuffer, mimeType);

  const importSession = await db.transaction(async (tx) => {
    const insertedSessions = await tx
      .insert(importSessions)
      .values({
        companyId,
        createdById: actorId,
        entityType,
        status: "uploaded",
        fileName,
        fileUrl: uploadedFile.fileUrl,
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        importedRows: 0,
        skippedRows: 0,
        duplicateRows: 0,
        columnMappings: {},
        validationErrors: [],
        aiInferences: {}
      } satisfies ImportSessionInsert)
      .returning();
    const createdSession = insertedSessions[0];

    if (!createdSession) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create import session");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "import.started",
      entityType: "import_session",
      entityId: createdSession.id,
      actorId,
      payload: {
        entityType,
        fileName
      },
      summary: `Import ${fileName} uploaded`
    });

    return createdSession;
  });

  try {
    const mapJobId = buildMapCsvColumnsJobId(importSession.id);
    const mapIdempotencyKey = buildMapCsvColumnsIdempotencyKey(importSession.id);

    await importsQueue.add(
      IMPORT_QUEUE_JOB_NAMES.mapCsvColumns,
      {
        companyId,
        importSessionId: importSession.id,
        idempotencyKey: mapIdempotencyKey,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        jobId: mapJobId
      }
    );

    await emitEvent({
      companyId,
      actorId,
      actorType: "system",
      eventType: "import.started",
      entityType: "import_session",
      entityId: importSession.id,
      payload: buildImportWorkflowAuditPayloadV1({
        stepKind: IMPORT_QUEUE_JOB_NAMES.mapCsvColumns,
        idempotencyKey: mapIdempotencyKey,
        state: "scheduled",
        importSessionId: importSession.id,
        jobId: mapJobId,
      }),
      summary: `CSV column mapping scheduled for ${fileName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to enqueue column mapping job";
    await markImportSessionFailed(companyId, importSession.id, message);
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to enqueue CSV column mapping");
  }

  return toImportSession(importSession);
}

export async function getImportSession(
  companyId: string,
  importSessionId: string
): Promise<ImportSession> {
  return toImportSession(await getImportSessionRow(companyId, importSessionId, db));
}

export async function listImportSessions(
  companyId: string,
  query: ListImportsQuery
): Promise<PaginatedResult<ImportSession>> {
  const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const rows = await db
    .select()
    .from(importSessions)
    .where(and(eq(importSessions.companyId, companyId), isNull(importSessions.deletedAt)));

  const filteredRows = rows.filter((row) => {
    if (query.status && row.status !== query.status) {
      return false;
    }

    if (query.entityType && row.entityType !== query.entityType) {
      return false;
    }

    return true;
  });

  const sortedRows = [...filteredRows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const startIndex = (page - 1) * limit;
  const pageRows = sortedRows.slice(startIndex, startIndex + limit);
  const total = filteredRows.length;

  return {
    data: pageRows.map((row) => toImportSession(row)),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit)
  };
}

export async function confirmMapping(
  companyId: string,
  _actorId: string,
  importSessionId: string,
  mappingOverrides: Record<string, string | null>
): Promise<ImportSession> {
  const importSession = await getImportSessionRow(companyId, importSessionId, db);

  if (importSession.status !== "mapping") {
    throw new AppError(ErrorCode.CONFLICT, "Import session is not ready for mapping confirmation");
  }

  const mergedMappings: ColumnMapping = {
    ...normalizeColumnMappings(importSession.columnMappings)
  };

  for (const [columnName, fieldName] of Object.entries(mappingOverrides)) {
    if (fieldName === null) {
      mergedMappings[columnName] = null;
      continue;
    }

    const trimmedFieldName = fieldName.trim();
    mergedMappings[columnName] = trimmedFieldName.length > 0 ? trimmedFieldName : null;
  }

  const now = new Date();
  const updatedSessions = await db
    .update(importSessions)
    .set({
      columnMappings: mergedMappings,
      status: "preview",
      errorMessage: null,
      updatedAt: now
    })
    .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
    .returning();
  const updatedSession = updatedSessions[0];

  if (!updatedSession) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
  }

  try {
    await importsQueue.add(
      "validate-csv-rows",
      {
        companyId,
        importSessionId
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        jobId: `validate-csv-rows-${importSessionId}-${now.getTime()}`
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to enqueue CSV validation job";
    await markImportSessionFailed(companyId, importSessionId, message);
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to enqueue CSV validation");
  }

  return toImportSession(updatedSession);
}

export async function startImport(
  companyId: string,
  _actorId: string,
  importSessionId: string,
  duplicateActions: Record<string, DuplicateAction> = {}
): Promise<ImportSession> {
  const importSession = await getImportSessionRow(companyId, importSessionId, db);

  if (importSession.status !== "preview") {
    throw new AppError(ErrorCode.CONFLICT, "Import session is not ready to start");
  }

  const nextAiInferences = {
    ...normalizeAiInferences(importSession.aiInferences),
    duplicateActions
  };

  const now = new Date();
  const updatedSessions = await db
    .update(importSessions)
    .set({
      status: "importing",
      importedRows: 0,
      skippedRows: 0,
      errorMessage: null,
      aiInferences: nextAiInferences,
      updatedAt: now
    })
    .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
    .returning();
  const updatedSession = updatedSessions[0];

  if (!updatedSession) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
  }

  try {
    const chunkedSteps = await scheduleImportChunkCommitsFromSessionAiInferences(
      companyId,
      _actorId,
      importSessionId
    );

    if (chunkedSteps === 0) {
      await importsQueue.add(
        "execute-import",
        {
          companyId,
          importSessionId
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          },
          jobId: `execute-import-${importSessionId}-${now.getTime()}`
        }
      );
    }

    await scheduleMigrateFileBatchesFromSessionAiInferences(companyId, importSessionId);
    await scheduleEquipmentImportChunksFromSessionAiInferences(companyId, importSessionId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to enqueue import execution job";
    await markImportSessionFailed(companyId, importSessionId, message);
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to enqueue import execution");
  }

  return toImportSession(updatedSession);
}

export async function rollbackImport(
  companyId: string,
  actorId: string,
  importSessionId: string
): Promise<ImportSession> {
  const importSession = await getImportSessionRow(companyId, importSessionId, db);

  if (importSession.status !== "completed") {
    throw new AppError(ErrorCode.CONFLICT, "Only completed imports can be rolled back");
  }

  const customerUpdateSnapshots = extractCustomerUpdateSnapshots(importSession.aiInferences);

  return db.transaction(async (tx) => {
    const now = new Date();

    // Billing first: refuses (no writes) when imported invoices have payments or estimates were accepted.
    await rollbackImportedBilling(tx, companyId, importSessionId, now);

    for (const snapshot of customerUpdateSnapshots) {
      await tx
        .update(customers)
        .set({
          firstName: snapshot.before.firstName,
          lastName: snapshot.before.lastName,
          displayName: snapshot.before.displayName,
          email: snapshot.before.email,
          phone: snapshot.before.phone,
          altPhone: snapshot.before.altPhone,
          tags: snapshot.before.tags,
          internalNotes: snapshot.before.internalNotes,
          importSessionId: null,
          updatedAt: now
        })
        .where(
          and(
            eq(customers.companyId, companyId),
            eq(customers.id, snapshot.customerId),
            isNull(customers.deletedAt)
          )
        );

      if (snapshot.propertyIds.length > 0) {
        await tx
          .update(properties)
          .set({
            deletedAt: now,
            updatedAt: now
          })
          .where(
            and(
              eq(properties.companyId, companyId),
              inArray(properties.id, snapshot.propertyIds),
              isNull(properties.deletedAt)
            )
          );
      }
    }

    await tx
      .update(customers)
      .set({
        deletedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(customers.companyId, companyId),
          eq(customers.importSessionId, importSessionId),
          isNull(customers.deletedAt)
        )
      )
      .returning();

    await tx
      .update(properties)
      .set({
        deletedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(properties.companyId, companyId),
          eq(properties.importSessionId, importSessionId),
          isNull(properties.deletedAt)
        )
      )
      .returning();

    await tx
      .update(assets)
      .set({
        deletedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(assets.companyId, companyId),
          eq(assets.importSessionId, importSessionId),
          isNull(assets.deletedAt)
        )
      )
      .returning();

    await tx
      .update(jobs)
      .set({
        deletedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.importSessionId, importSessionId),
          isNull(jobs.deletedAt)
        )
      )
      .returning();

    if (importSession.entityType === "price_book") {
      await softDeletePriceBookImport(companyId, importSessionId);
    }

    if (importSession.entityType === "notes") {
      await softDeleteNotesImport(companyId, importSessionId);
    }

    if (importSession.entityType === "communications") {
      await softDeleteCommunicationsImport(companyId, importSessionId);
    }

    if (importSession.entityType === "service_agreements") {
      await softDeleteServiceAgreementsImport(companyId, importSessionId);
    }

    const updatedSessions = await tx
      .update(importSessions)
      .set({
        status: "rolled_back",
        rolledBackAt: now,
        rolledBackById: actorId,
        updatedAt: now
      })
      .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
      .returning();
    const updatedSession = updatedSessions[0];

    if (!updatedSession) {
      throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "import.rolled_back",
      entityType: "import_session",
      entityId: updatedSession.id,
      actorId,
      payload: {
        fileName: updatedSession.fileName
      },
      summary: `Import ${updatedSession.fileName} rolled back`
    });

    return toImportSession(updatedSession);
  });
}

export async function getImportErrors(
  companyId: string,
  importSessionId: string
): Promise<ValidationError[]> {
  const importSession = await getImportSessionRow(companyId, importSessionId, db);
  return normalizeValidationErrors(importSession.validationErrors).map((entry) => ({
    ...entry,
    value: sanitizeSpreadsheetCell(entry.value)
  }));
}
