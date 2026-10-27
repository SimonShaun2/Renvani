import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import type { Job, Processor } from "bullmq";
import Papa from "papaparse";
import pino from "pino";

import { mapCsvColumns, recordImportAiObservation } from "@fsm/ai";
import {
  buildCommunicationsColumnMapping,
  inferCommunicationsPresetFromHeaders
} from "@fsm/config/import-communications-presets";
import {
  buildPresetColumnMapping,
  inferImportSourcePresetForSession
} from "@fsm/config/import-source-presets";
import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import {
  isQuickBooksIifContent,
  isQuickBooksIifFileName,
  isXlsxImportFileName,
  parseQuickBooksIifToTable,
  parseXlsxBufferToSheetRows,
  QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY
} from "@fsm/import-engine";
import { resolveSourceSystemForNotesImport } from "@fsm/config/import-notes-map";
import {
  commitCommunicationsRows,
  commitNoteImportRows,
  commitPriceBookRows,
  customers,
  db,
  emitEventWithExecutor,
  importSessions,
  properties,
  resolveSourceSystemForCommunicationsImport,
  resolveSourceSystemForPriceBookImport,
  validateCommunicationsRows,
  validateNoteImportRows,
  validatePriceBookRows
} from "@fsm/db";
import {
  buildImportChunkCommitManifest,
  initialImportSessionChunkProgress,
  isChunkCommitEligibleEntity
} from "@fsm/import-engine";
import { normalizeImportPhone } from "@fsm/import-normalize";
import { aiQueue } from "@fsm/jobs";
import {
  IMPORT_QUEUE_JOB_NAMES,
  assertMapCsvColumnsIdempotencyKey,
  buildMapCsvColumnsIdempotencyKey,
  buildMapCsvColumnsJobId,
  type ImportSessionStatus,
} from "@fsm/types";

import { emitImportWorkflowStepReceipt } from "../lib/import-workflow-step-receipt.js";
import { persistImportSessionReconciliationReportBestEffort } from "../lib/persist-import-session-reconciliation.js";
import { handleImportChunkCommit, IMPORT_CHUNK_COMMIT_JOB_NAME } from "./import-chunk-commit.processor.js";
import {
  handleImportCommunicationsCommit,
  IMPORT_COMMUNICATIONS_COMMIT_JOB_NAME
} from "./import-communications-chunk.processor.js";
import {
  handleImportEquipmentCommit,
  IMPORT_EQUIPMENT_COMMIT_JOB_NAME,
} from "./import-equipment-chunk.processor.js";
import {
  handleImportInvoiceBalanceCommit,
  IMPORT_INVOICE_BALANCE_COMMIT_JOB_NAME,
} from "./import-invoice-balance-chunk.processor.js";
import {
  sanitizeSpreadsheetCell,
  type ColumnMapping,
  type ImportCustomerUpdateSnapshotV1,
  type ValidationError
} from "@fsm/types";

type ImportSessionRow = typeof importSessions.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type CustomerInsert = typeof customers.$inferInsert;
type PropertyInsert = typeof properties.$inferInsert;

interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

interface CustomerImportRow {
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  tags: string[];
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  validationErrors: ValidationError[];
}

type DuplicateAction = "skip" | "update_existing" | "import_new";

interface CustomerDuplicateMatch {
  customer: CustomerRow;
  reason: "email" | "phone" | "name";
}

const logger = pino({
  name: "csv-import-processor"
});

const IMPORT_BATCH_SIZE = 100;

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

    if (
      typeof entry.row === "number" &&
      typeof entry.field === "string" &&
      typeof entry.message === "string" &&
      typeof entry.value === "string"
    ) {
      validationErrors.push({
        row: entry.row,
        field: entry.field,
        message: entry.message,
        value: sanitizeSpreadsheetCell(entry.value)
      });
    }
  }

  return validationErrors;
}

function normalizeAiInferences(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function readPriceBookSourceSystem(
  aiInferences: unknown,
  headers: string[],
  entityType: string
): ReturnType<typeof resolveSourceSystemForPriceBookImport> {
  const inferences = normalizeAiInferences(aiInferences);
  if (typeof inferences.sourceSystem === "string") {
    return inferences.sourceSystem as ReturnType<typeof resolveSourceSystemForPriceBookImport>;
  }

  const presetId = inferImportSourcePresetForSession(headers, entityType);
  return resolveSourceSystemForPriceBookImport(presetId ?? "generic");
}

function readNotesSourceSystem(
  aiInferences: unknown,
  headers: string[],
  entityType: string
): ReturnType<typeof resolveSourceSystemForNotesImport> {
  const inferences = normalizeAiInferences(aiInferences);
  if (typeof inferences.sourceSystem === "string") {
    return inferences.sourceSystem as ReturnType<typeof resolveSourceSystemForNotesImport>;
  }

  const presetId = inferImportSourcePresetForSession(headers, entityType);
  return resolveSourceSystemForNotesImport(presetId ?? "generic");
}

function readCommunicationsSourceSystem(aiInferences: unknown, headers: string[]): string {
  const inferences = normalizeAiInferences(aiInferences);
  if (typeof inferences.sourceSystem === "string") {
    return inferences.sourceSystem;
  }

  const presetId = inferCommunicationsPresetFromHeaders(headers);
  return resolveSourceSystemForCommunicationsImport(presetId ?? "generic");
}

function normalizeDuplicateActions(value: unknown): Record<string, DuplicateAction> {
  if (!isPlainObject(value)) {
    return {};
  }

  const duplicateActions: Record<string, DuplicateAction> = {};

  for (const [key, action] of Object.entries(value)) {
    if (action === "skip" || action === "update_existing" || action === "import_new") {
      duplicateActions[key] = action;
    }
  }

  return duplicateActions;
}

function buildEmptyMapping(headers: string[]): ColumnMapping {
  return Object.fromEntries(headers.map((header) => [header, null]));
}

function countMappedColumns(mapping: ColumnMapping): number {
  return Object.values(mapping).filter((value) => typeof value === "string" && value.length > 0).length;
}

async function mirrorImportAiMappingToLangfuse(input: {
  companyId: string;
  importSessionId: string;
  entityType: string;
  outcome: "succeeded" | "failed" | "fallback";
  headerCount: number;
  columnMapping: ColumnMapping;
  errorMessage?: string;
}): Promise<void> {
  await recordImportAiObservation({
    companyId: input.companyId,
    importSessionId: input.importSessionId,
    entityType: input.entityType,
    outcome: input.outcome,
    headerCount: input.headerCount,
    mappedColumnCount: countMappedColumns(input.columnMapping),
    occurredAt: new Date().toISOString(),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {})
  });
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = sanitizeSpreadsheetCell(value.trim());
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeEmailValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeTextValue(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function normalizeCustomerNameValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeTextValue(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function getMappedCustomerName(mappedRow: CustomerImportRow): string | null {
  if (mappedRow.displayName) {
    return mappedRow.displayName;
  }

  const fullName = `${mappedRow.firstName} ${mappedRow.lastName}`.trim();
  return fullName.length > 0 ? fullName : null;
}

function buildCustomerLookupMaps(existingCustomers: CustomerRow[]) {
  const emailMap = new Map<string, CustomerRow>();
  const phoneMap = new Map<string, CustomerRow>();
  const nameMap = new Map<string, CustomerRow>();

  for (const customer of existingCustomers) {
    const normalizedEmail = normalizeEmailValue(customer.email);
    const normalizedPhone = normalizeImportPhone(customer.phone);
    const normalizedName = normalizeCustomerNameValue(
      customer.displayName ?? `${customer.firstName} ${customer.lastName}`.trim()
    );

    if (normalizedEmail && !emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, customer);
    }

    if (normalizedPhone && !phoneMap.has(normalizedPhone)) {
      phoneMap.set(normalizedPhone, customer);
    }

    if (normalizedName && !nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, customer);
    }
  }

  return {
    emailMap,
    phoneMap,
    nameMap
  };
}

function findDuplicateCustomer(
  mappedRow: CustomerImportRow,
  existingCustomers: ReturnType<typeof buildCustomerLookupMaps>
): CustomerDuplicateMatch | null {
  const normalizedEmail = normalizeEmailValue(mappedRow.email);
  if (normalizedEmail) {
    const customer = existingCustomers.emailMap.get(normalizedEmail);
    if (customer) {
      return { customer, reason: "email" };
    }
  }

  const normalizedPhone = normalizeImportPhone(mappedRow.phone);
  if (normalizedPhone) {
    const customer = existingCustomers.phoneMap.get(normalizedPhone);
    if (customer) {
      return { customer, reason: "phone" };
    }
  }

  const normalizedName = normalizeCustomerNameValue(getMappedCustomerName(mappedRow));
  if (normalizedName) {
    const customer = existingCustomers.nameMap.get(normalizedName);
    if (customer) {
      return { customer, reason: "name" };
    }
  }

  return null;
}

function buildCustomerUpdateValues(
  existingCustomer: CustomerRow,
  mappedRow: CustomerImportRow,
  importSessionId: string,
  now: Date
) {
  const mergedTags = Array.from(
    new Set([...(existingCustomer.tags ?? []), ...mappedRow.tags])
  );
  const mergedNotes = mappedRow.notes
    ? existingCustomer.internalNotes
      ? existingCustomer.internalNotes.includes(mappedRow.notes)
        ? existingCustomer.internalNotes
        : `${existingCustomer.internalNotes}\n${mappedRow.notes}`
      : mappedRow.notes
    : existingCustomer.internalNotes;

  return {
    ...(existingCustomer.firstName.trim().length === 0 && mappedRow.firstName.length > 0
      ? { firstName: mappedRow.firstName }
      : {}),
    ...(existingCustomer.lastName.trim().length === 0 && mappedRow.lastName.length > 0
      ? { lastName: mappedRow.lastName }
      : {}),
    ...(existingCustomer.displayName === null && mappedRow.displayName
      ? { displayName: mappedRow.displayName }
      : {}),
    ...(existingCustomer.email === null && mappedRow.email
      ? { email: mappedRow.email }
      : {}),
    ...(existingCustomer.phone === null && mappedRow.phone
      ? { phone: mappedRow.phone }
      : {}),
    ...(existingCustomer.altPhone === null && mappedRow.altPhone
      ? { altPhone: mappedRow.altPhone }
      : {}),
    tags: mergedTags,
    internalNotes: mergedNotes,
    importSessionId,
    updatedAt: now
  };
}

function parseCsv(buffer: Buffer): { headers: string[]; rows: ParsedCsvRow[] } {
  const csvText = buffer.toString("utf8").replace(/^\uFEFF/u, "");
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true
  });
  const headers = (result.meta.fields ?? []).map((header) => header.trim());
  const rows: ParsedCsvRow[] = [];

  for (let index = 0; index < result.data.length; index += 1) {
    const sourceRow = result.data[index];
    const normalizedRow: Record<string, string> = {};

    for (const header of headers) {
      const rawValue = sourceRow?.[header];
      normalizedRow[header] =
        typeof rawValue === "string" ? sanitizeSpreadsheetCell(rawValue.trim()) : "";
    }

    rows.push({
      rowNumber: index + 2,
      values: normalizedRow
    });
  }

  return {
    headers,
    rows
  };
}

function parseImportTabular(
  buffer: Buffer,
  fileName: string,
  importEntityType: string
): { headers: string[]; rows: ParsedCsvRow[] } {
  if (isXlsxImportFileName(fileName)) {
    const sheet = parseXlsxBufferToSheetRows(new Uint8Array(buffer));
    const headers = sheet.headers.map((header) => header.trim());
    const rows: ParsedCsvRow[] = sheet.rows.map((row, index) => {
      const values: Record<string, string> = {};
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
        const header = headers[columnIndex];
        if (!header) {
          continue;
        }
        values[header] = (row[columnIndex] ?? "").trim();
      }
      return { rowNumber: index + 2, values };
    });
    return { headers, rows };
  }

  const text = buffer.toString("utf8");
  if (isQuickBooksIifFileName(fileName) || isQuickBooksIifContent(text)) {
    const preferredRecordType = QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY[importEntityType];
    const table = parseQuickBooksIifToTable(text, preferredRecordType);
    if (!table) {
      return { headers: [], rows: [] };
    }

    const rows: ParsedCsvRow[] = table.rows.map((values, index) => ({
      rowNumber: index + 2,
      values
    }));
    return { headers: table.headers, rows };
  }

  return parseCsv(buffer);
}

function mapCustomerRow(values: Record<string, string>, columnMapping: ColumnMapping): CustomerImportRow {
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

  return {
    firstName: firstName ?? (displayName ?? ""),
    lastName: lastName ?? "",
    displayName,
    email: normalizeEmailValue(mappedValues.email),
    phone: normalizeTextValue(mappedValues.phone),
    altPhone: normalizeTextValue(mappedValues.altPhone),
    addressLine1: normalizeTextValue(mappedValues.addressLine1),
    city: normalizeTextValue(mappedValues.city),
    state: normalizeTextValue(mappedValues.state),
    zip: normalizeTextValue(mappedValues.zip),
    notes: normalizeTextValue(mappedValues.notes),
    tags: normalizeTextValue(mappedValues.tags)
      ?.split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0) ?? []
  };
}

function validateCustomerRows(rows: ParsedCsvRow[], columnMapping: ColumnMapping, existingCustomers: CustomerRow[]): ValidationResult {
  const validationErrors: ValidationError[] = [];
  const rowErrors = new Set<number>();
  let duplicateRows = 0;
  const customerLookupMaps = buildCustomerLookupMaps(existingCustomers);

  for (const row of rows) {
    const mappedRow = mapCustomerRow(row.values, columnMapping);
    const hasDisplayName = mappedRow.displayName !== null;
    const hasFirstAndLastName = mappedRow.firstName.length > 0 && mappedRow.lastName.length > 0;

    if (!hasDisplayName && !hasFirstAndLastName) {
      validationErrors.push({
        row: row.rowNumber,
        field: "firstName",
        message: "Required field missing",
        value: mappedRow.firstName
      });
      rowErrors.add(row.rowNumber);
    }

    if (mappedRow.email && !isValidEmail(mappedRow.email)) {
      validationErrors.push({
        row: row.rowNumber,
        field: "email",
        message: "Invalid email format",
        value: mappedRow.email
      });
      rowErrors.add(row.rowNumber);
    }

    if (rowErrors.has(row.rowNumber)) {
      continue;
    }

    if (findDuplicateCustomer(mappedRow, customerLookupMaps)) {
      duplicateRows += 1;
    }
  }

  return {
    totalRows: rows.length,
    validRows: rows.length - rowErrors.size - duplicateRows,
    errorRows: rowErrors.size,
    duplicateRows,
    validationErrors
  };
}

async function writeImportReconciliationReport(
  companyId: string,
  importSessionId: string,
  validationErrors: ValidationError[]
): Promise<void> {
  // Best-effort: never let report generation fail or retry an already-committed import.
  try {
    const session = await getImportSessionOrNull(companyId, importSessionId);
    if (!session) {
      return;
    }

    await persistImportSessionReconciliationReportBestEffort(companyId, session, validationErrors);
  } catch (error: unknown) {
    logger.warn(
      { companyId, importSessionId, err: error instanceof Error ? error.message : String(error) },
      "Failed to load import session for reconciliation report (best-effort; import unaffected)"
    );
  }
}

async function getImportSessionOrNull(companyId: string, importSessionId: string): Promise<ImportSessionRow | null> {
  return (
    await db.query.importSessions.findFirst({
      where: (table, operators) =>
        operators.and(
          operators.eq(table.companyId, companyId),
          operators.eq(table.id, importSessionId),
          operators.isNull(table.deletedAt)
        )
    })
  ) ?? null;
}

async function getCompanyCustomers(companyId: string): Promise<CustomerRow[]> {
  return db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)));
}

async function markImportFailed(importSession: ImportSessionRow, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : "CSV import failed";
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(importSessions)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: now
      })
      .where(
        and(
          eq(importSessions.companyId, importSession.companyId),
          eq(importSessions.id, importSession.id),
          isNull(importSessions.deletedAt)
        )
      )
      .returning();

    await emitEventWithExecutor(tx, {
      companyId: importSession.companyId,
      eventType: "import.failed",
      actorType: "system",
      entityType: "import_session",
      entityId: importSession.id,
      payload: {
        errorMessage
      },
      summary: `Import ${importSession.fileName} failed`
    });
  });
}

const MAP_CSV_TERMINAL_STATUSES: ReadonlySet<ImportSessionStatus> = new Set([
  "mapping",
  "preview",
  "importing",
  "completed",
]);

function resolveMapCsvIdempotencyKey(importSessionId: string, job: Job<Record<string, unknown>>): string {
  const fromJob = typeof job.data.idempotencyKey === "string" ? job.data.idempotencyKey : null;
  const key = fromJob ?? buildMapCsvColumnsIdempotencyKey(importSessionId);
  assertMapCsvColumnsIdempotencyKey(importSessionId, key);
  return key;
}

export async function handleMapCsvColumns(job: Job<Record<string, unknown>>): Promise<void> {
  const companyId = typeof job.data.companyId === "string" ? job.data.companyId : null;
  const importSessionId = typeof job.data.importSessionId === "string" ? job.data.importSessionId : null;

  if (!companyId || !importSessionId) {
    logger.warn({ jobId: job.id ?? null }, "CSV mapping job missing required identifiers");
    return;
  }

  const importSession = await getImportSessionOrNull(companyId, importSessionId);

  if (!importSession) {
    logger.warn({ companyId, importSessionId }, "CSV mapping job skipped because import session was not found");
    return;
  }

  const idempotencyKey = resolveMapCsvIdempotencyKey(importSessionId, job);
  const mapJobId = typeof job.id === "string" ? job.id : buildMapCsvColumnsJobId(importSessionId);

  if (MAP_CSV_TERMINAL_STATUSES.has(importSession.status)) {
    await emitImportWorkflowStepReceipt({
      companyId,
      importSessionId,
      stepKind: IMPORT_QUEUE_JOB_NAMES.mapCsvColumns,
      idempotencyKey,
      state: "deduped_completed",
      jobId: mapJobId,
      summary: `CSV column mapping deduped (session already ${importSession.status})`,
    });
    return;
  }

  try {
    const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
    const parsedCsv = parseImportTabular(fileBuffer, importSession.fileName, importSession.entityType);
    const sourcePresetId =
      importSession.entityType === "communications"
        ? inferCommunicationsPresetFromHeaders(parsedCsv.headers)
        : inferImportSourcePresetForSession(parsedCsv.headers, importSession.entityType);
    const presetMapping =
      importSession.entityType === "communications"
        ? buildCommunicationsColumnMapping(parsedCsv.headers, sourcePresetId)
        : sourcePresetId
          ? buildPresetColumnMapping(parsedCsv.headers, sourcePresetId)
          : {};
    let columnMapping: ColumnMapping = { ...presetMapping };
    const headerCount = parsedCsv.headers.length;

    try {
      const aiMapping = await mapCsvColumns(
        parsedCsv.headers,
        parsedCsv.rows.slice(0, 5).map((row) => row.values),
        importSession.entityType
      );
      columnMapping = { ...aiMapping, ...presetMapping };
      await mirrorImportAiMappingToLangfuse({
        companyId,
        importSessionId,
        entityType: importSession.entityType,
        outcome: "succeeded",
        headerCount,
        columnMapping
      });
    } catch (error: unknown) {
      logger.error(
        {
          err: error,
          companyId,
          importSessionId,
          sourcePresetId
        },
        "AI column mapping failed; falling back to vendor preset or empty mapping"
      );
      columnMapping =
        Object.keys(presetMapping).length > 0 ? presetMapping : buildEmptyMapping(parsedCsv.headers);
      const errorMessage = error instanceof Error ? error.message : "AI column mapping failed";
      await mirrorImportAiMappingToLangfuse({
        companyId,
        importSessionId,
        entityType: importSession.entityType,
        outcome: Object.keys(presetMapping).length > 0 ? "fallback" : "failed",
        headerCount,
        columnMapping,
        errorMessage
      });
    }

    const priorInferences = normalizeAiInferences(importSession.aiInferences);
    const sourceSystem =
      importSession.entityType === "communications"
        ? readCommunicationsSourceSystem(importSession.aiInferences, parsedCsv.headers)
        : resolveSourceSystemForPriceBookImport(sourcePresetId ?? "generic");

    await db
      .update(importSessions)
      .set({
        columnMappings: columnMapping,
        status: "mapping",
        aiInferences: {
          ...priorInferences,
          sourcePresetId,
          sourceSystem
        },
        updatedAt: new Date()
      })
      .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
      .returning();

    await emitImportWorkflowStepReceipt({
      companyId,
      importSessionId,
      stepKind: IMPORT_QUEUE_JOB_NAMES.mapCsvColumns,
      idempotencyKey,
      state: "completed",
      jobId: mapJobId,
      summary: `CSV column mapping completed for ${importSession.fileName}`,
    });
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        companyId,
        importSessionId
      },
      "CSV mapping job failed"
    );
    await emitImportWorkflowStepReceipt({
      companyId,
      importSessionId,
      stepKind: IMPORT_QUEUE_JOB_NAMES.mapCsvColumns,
      idempotencyKey,
      state: "failed",
      jobId: mapJobId,
      summary: `CSV column mapping failed for ${importSession.fileName}`,
    });
    await markImportFailed(importSession, error);
    throw error;
  }
}

export async function handleValidateCsvRows(job: Job<Record<string, unknown>>): Promise<void> {
  const companyId = typeof job.data.companyId === "string" ? job.data.companyId : null;
  const importSessionId = typeof job.data.importSessionId === "string" ? job.data.importSessionId : null;

  if (!companyId || !importSessionId) {
    logger.warn({ jobId: job.id ?? null }, "CSV validation job missing required identifiers");
    return;
  }

  const importSession = await getImportSessionOrNull(companyId, importSessionId);

  if (!importSession) {
    logger.warn({ companyId, importSessionId }, "CSV validation job skipped because import session was not found");
    return;
  }

  try {
    const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
    const parsedCsv = parseImportTabular(fileBuffer, importSession.fileName, importSession.entityType);
    const columnMapping = normalizeColumnMappings(importSession.columnMappings);

    const validationResult =
      importSession.entityType === "price_book"
        ? validatePriceBookRows(
            parsedCsv.rows,
            columnMapping,
            readPriceBookSourceSystem(importSession.aiInferences, parsedCsv.headers, importSession.entityType)
          )
        : importSession.entityType === "notes"
          ? validateNoteImportRows(parsedCsv.rows, columnMapping)
          : importSession.entityType === "communications"
            ? validateCommunicationsRows(parsedCsv.rows, columnMapping)
          : validateCustomerRows(parsedCsv.rows, columnMapping, await getCompanyCustomers(companyId));

    const priorInferences = normalizeAiInferences(importSession.aiInferences);
    const sourceSystem =
      typeof priorInferences.sourceSystem === "string"
        ? priorInferences.sourceSystem
        : importSession.sourceSystem ?? "manual_csv";

    const chunkManifest =
      isChunkCommitEligibleEntity(importSession.entityType, columnMapping)
        ? buildImportChunkCommitManifest({
            totalDataRows: validationResult.totalRows,
            entityType: importSession.entityType,
            sourceSystem,
            ...(importSession.importBundleId
              ? { importBundleId: importSession.importBundleId }
              : {})
          })
        : null;

    const nextAiInferences = chunkManifest
      ? {
          ...priorInferences,
          importChunkCommitManifest: chunkManifest
        }
      : priorInferences;

    const nextProgress = chunkManifest ? initialImportSessionChunkProgress(chunkManifest) : undefined;

    await db
      .update(importSessions)
      .set({
        totalRows: validationResult.totalRows,
        validRows: validationResult.validRows,
        errorRows: validationResult.errorRows,
        duplicateRows: validationResult.duplicateRows,
        validationErrors: validationResult.validationErrors,
        status: "preview",
        aiInferences: nextAiInferences,
        ...(nextProgress ? { progress: nextProgress } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt)))
      .returning();

    await job.updateProgress?.(100);
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        companyId,
        importSessionId
      },
      "CSV validation job failed"
    );
    await markImportFailed(importSession, error);
    throw error;
  }
}

async function executeNotesImport(
  job: Job<Record<string, unknown>>,
  companyId: string,
  importSessionId: string,
  importSession: ImportSessionRow
): Promise<void> {
  const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
  const parsedCsv = parseImportTabular(fileBuffer, importSession.fileName, importSession.entityType);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);
  const validationErrors = normalizeValidationErrors(importSession.validationErrors);
  const invalidRowNumbers = new Set(validationErrors.map((validationError) => validationError.row));
  const sourceSystem = readNotesSourceSystem(
    importSession.aiInferences,
    parsedCsv.headers,
    importSession.entityType
  );

  const result = await commitNoteImportRows({
    companyId,
    importSessionId,
    sourceSystem,
    rows: parsedCsv.rows,
    columnMapping,
    invalidRowNumbers
  });

  const completedAt = new Date();
  const priorInferences = normalizeAiInferences(importSession.aiInferences);

  await db.transaction(async (tx) => {
    await tx
      .update(importSessions)
      .set({
        status: "completed",
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        duplicateRows: 0,
        completedAt,
        errorMessage: null,
        aiInferences: {
          ...priorInferences,
          notesImport: {
            customerNotes: result.customerNotes,
            jobNotes: result.jobNotes
          }
        },
        updatedAt: completedAt
      })
      .where(
        and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt))
      )
      .returning();

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "import.completed",
      actorType: "system",
      entityType: "import_session",
      entityId: importSessionId,
      payload: {
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        entityType: "notes",
        customerNotes: result.customerNotes,
        jobNotes: result.jobNotes
      },
      summary: `Notes import ${importSession.fileName} completed`
    });
  });

  await writeImportReconciliationReport(companyId, importSessionId, validationErrors);
  await job.updateProgress?.(100);
}

async function executeCommunicationsImport(
  job: Job<Record<string, unknown>>,
  companyId: string,
  importSessionId: string,
  importSession: ImportSessionRow
): Promise<void> {
  const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
  const parsedCsv = parseImportTabular(fileBuffer, importSession.fileName, importSession.entityType);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);
  const validationErrors = normalizeValidationErrors(importSession.validationErrors);
  const invalidRowNumbers = new Set(validationErrors.map((validationError) => validationError.row));
  const sourceSystem = readCommunicationsSourceSystem(importSession.aiInferences, parsedCsv.headers);

  const result = await commitCommunicationsRows({
    companyId,
    importSessionId,
    sourceSystem,
    rows: parsedCsv.rows,
    columnMapping,
    invalidRowNumbers
  });

  const completedAt = new Date();
  const priorInferences = normalizeAiInferences(importSession.aiInferences);

  await db.transaction(async (tx) => {
    await tx
      .update(importSessions)
      .set({
        status: "completed",
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        duplicateRows: 0,
        completedAt,
        errorMessage: null,
        aiInferences: {
          ...priorInferences,
          communicationsImported: result.importedRows
        },
        updatedAt: completedAt
      })
      .where(
        and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt))
      )
      .returning();

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "import.completed",
      actorType: "system",
      entityType: "import_session",
      entityId: importSessionId,
      payload: {
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        entityType: "communications"
      },
      summary: `Communications import ${importSession.fileName} completed`
    });
  });

  await writeImportReconciliationReport(companyId, importSessionId, validationErrors);
  await job.updateProgress?.(100);
}

async function executePriceBookImport(
  job: Job<Record<string, unknown>>,
  companyId: string,
  importSessionId: string,
  importSession: ImportSessionRow
): Promise<void> {
  const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
  const parsedCsv = parseImportTabular(fileBuffer, importSession.fileName, importSession.entityType);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);
  const validationErrors = normalizeValidationErrors(importSession.validationErrors);
  const invalidRowNumbers = new Set(validationErrors.map((validationError) => validationError.row));
  const sourceSystem = readPriceBookSourceSystem(
    importSession.aiInferences,
    parsedCsv.headers,
    importSession.entityType
  );

  const result = await commitPriceBookRows({
    companyId,
    importSessionId,
    sourceSystem,
    rows: parsedCsv.rows,
    columnMapping,
    invalidRowNumbers
  });

  const completedAt = new Date();
  const priorInferences = normalizeAiInferences(importSession.aiInferences);

  await db.transaction(async (tx) => {
    await tx
      .update(importSessions)
      .set({
        status: "completed",
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        duplicateRows: 0,
        completedAt,
        errorMessage: null,
        aiInferences: {
          ...priorInferences,
          priceBookLineSeeds: result.lineSeeds.length
        },
        updatedAt: completedAt
      })
      .where(
        and(eq(importSessions.companyId, companyId), eq(importSessions.id, importSessionId), isNull(importSessions.deletedAt))
      )
      .returning();

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "import.completed",
      actorType: "system",
      entityType: "import_session",
      entityId: importSessionId,
      payload: {
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        entityType: "price_book"
      },
      summary: `Price book import ${importSession.fileName} completed`
    });
  });

  await writeImportReconciliationReport(companyId, importSessionId, validationErrors);
  await job.updateProgress?.(100);
}

export async function handleExecuteImport(job: Job<Record<string, unknown>>): Promise<void> {
  const companyId = typeof job.data.companyId === "string" ? job.data.companyId : null;
  const importSessionId = typeof job.data.importSessionId === "string" ? job.data.importSessionId : null;

  if (!companyId || !importSessionId) {
    logger.warn({ jobId: job.id ?? null }, "CSV import execution job missing required identifiers");
    return;
  }

  const importSession = await getImportSessionOrNull(companyId, importSessionId);

  if (!importSession) {
    logger.warn({ companyId, importSessionId }, "CSV import execution skipped because import session was not found");
    return;
  }

  try {
    if (importSession.entityType === "price_book") {
      await executePriceBookImport(job, companyId, importSessionId, importSession);
      return;
    }

    if (importSession.entityType === "notes") {
      await executeNotesImport(job, companyId, importSessionId, importSession);
      return;
    }

    if (importSession.entityType === "communications") {
      await executeCommunicationsImport(job, companyId, importSessionId, importSession);
      return;
    }

    const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
    const parsedCsv = parseImportTabular(fileBuffer, importSession.fileName, importSession.entityType);
    const columnMapping = normalizeColumnMappings(importSession.columnMappings);
    const validationErrors = normalizeValidationErrors(importSession.validationErrors);
    const duplicateActions = normalizeDuplicateActions(
      normalizeAiInferences(importSession.aiInferences).duplicateActions
    );
    const invalidRowNumbers = new Set(validationErrors.map((validationError) => validationError.row));
    const existingCustomers = await getCompanyCustomers(companyId);
    const customerLookupMaps = buildCustomerLookupMaps(existingCustomers);
    let importedRows = 0;
    let skippedRows = 0;
    let duplicateRows = 0;
    let processedRows = 0;
    const customerUpdateSnapshots: ImportCustomerUpdateSnapshotV1[] = [];

    for (let startIndex = 0; startIndex < parsedCsv.rows.length; startIndex += IMPORT_BATCH_SIZE) {
      const batch = parsedCsv.rows.slice(startIndex, startIndex + IMPORT_BATCH_SIZE);
      const customerInserts: CustomerInsert[] = [];
      const propertyInserts: PropertyInsert[] = [];

      for (const row of batch) {
        processedRows += 1;

        if (invalidRowNumbers.has(row.rowNumber)) {
          skippedRows += 1;
          continue;
        }

        const mappedRow = mapCustomerRow(row.values, columnMapping);
        const normalizedEmail = normalizeEmailValue(mappedRow.email);
        const normalizedPhone = normalizeImportPhone(mappedRow.phone);
        const duplicateMatch = findDuplicateCustomer(mappedRow, customerLookupMaps);

        if (duplicateMatch) {
          duplicateRows += 1;
          const duplicateAction = duplicateActions[String(row.rowNumber)] ?? "skip";

          if (duplicateAction === "skip") {
            skippedRows += 1;

            logger.debug(
              {
                companyId,
                importSessionId,
                rowNumber: row.rowNumber
              },
              "Skipping duplicate customer row during import"
            );
            continue;
          }

          if (duplicateAction === "update_existing") {
            const existingCustomer = duplicateMatch.customer;
            const snapshotBefore: ImportCustomerUpdateSnapshotV1["before"] = {
              firstName: existingCustomer.firstName,
              lastName: existingCustomer.lastName,
              displayName: existingCustomer.displayName,
              email: existingCustomer.email,
              phone: existingCustomer.phone,
              altPhone: existingCustomer.altPhone,
              tags: existingCustomer.tags ?? [],
              internalNotes: existingCustomer.internalNotes
            };
            const newPropertyIds: string[] = [];

            await db.transaction(async (tx) => {
              await tx
                .update(customers)
                .set(buildCustomerUpdateValues(existingCustomer, mappedRow, importSessionId, new Date()))
                .where(
                  and(
                    eq(customers.companyId, companyId),
                    eq(customers.id, existingCustomer.id),
                    isNull(customers.deletedAt)
                  )
                )
                .returning();

              if (mappedRow.addressLine1 && mappedRow.city && mappedRow.state && mappedRow.zip) {
                const propertyId = randomUUID();
                newPropertyIds.push(propertyId);
                await tx.insert(properties).values({
                  id: propertyId,
                  companyId,
                  customerId: existingCustomer.id,
                  addressLine1: mappedRow.addressLine1,
                  city: mappedRow.city,
                  state: mappedRow.state,
                  zip: mappedRow.zip,
                  type: "residential",
                  isPrimary: false,
                  importSessionId
                }).returning();
              }
            });

            customerUpdateSnapshots.push({
              customerId: existingCustomer.id,
              before: snapshotBefore,
              propertyIds: newPropertyIds
            });

            importedRows += 1;
            continue;
          }
        }

        const customerId = randomUUID();

        customerInserts.push({
          id: customerId,
          companyId,
          firstName: mappedRow.firstName,
          lastName: mappedRow.lastName,
          displayName: mappedRow.displayName,
          email: mappedRow.email,
          phone: mappedRow.phone,
          altPhone: mappedRow.altPhone,
          internalNotes: mappedRow.notes,
          tags: mappedRow.tags,
          importSessionId
        });

        if (mappedRow.addressLine1 && mappedRow.city && mappedRow.state && mappedRow.zip) {
          propertyInserts.push({
            id: randomUUID(),
            companyId,
            customerId,
            addressLine1: mappedRow.addressLine1,
            city: mappedRow.city,
            state: mappedRow.state,
            zip: mappedRow.zip,
            type: "residential",
            isPrimary: true,
            importSessionId
          });
        }

        if (normalizedEmail) {
          customerLookupMaps.emailMap.set(normalizedEmail, {
            id: customerId,
            companyId,
            firstName: mappedRow.firstName,
            lastName: mappedRow.lastName,
            displayName: mappedRow.displayName,
            email: mappedRow.email,
            phone: mappedRow.phone,
            altPhone: mappedRow.altPhone,
            leadSource: null,
            referredBy: null,
            tags: mappedRow.tags,
            internalNotes: mappedRow.notes,
            lifetimeValue: "0",
            totalJobs: 0,
            lastServiceDate: null,
            firstServiceDate: null,
            prefersSms: false,
            prefersEmail: false,
            doNotContact: false,
            stripeCustomerId: null,
            sourceSystem: null,
            sourceId: null,
            importSessionId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null
          });
        }

        if (normalizedPhone) {
          const mappedCustomer = customerLookupMaps.emailMap.get(normalizedEmail ?? "") ?? null;
          if (mappedCustomer) {
            customerLookupMaps.phoneMap.set(normalizedPhone, mappedCustomer);
          }
        }

        const normalizedName = normalizeCustomerNameValue(getMappedCustomerName(mappedRow));
        if (normalizedName) {
          const mappedCustomer =
            (normalizedEmail ? customerLookupMaps.emailMap.get(normalizedEmail) : undefined) ??
            (normalizedPhone ? customerLookupMaps.phoneMap.get(normalizedPhone) : undefined);
          if (mappedCustomer) {
            customerLookupMaps.nameMap.set(normalizedName, mappedCustomer);
          }
        }
      }

      if (customerInserts.length > 0 || propertyInserts.length > 0) {
        await db.transaction(async (tx) => {
          if (customerInserts.length > 0) {
            await tx.insert(customers).values(customerInserts).returning();
          }

          if (propertyInserts.length > 0) {
            await tx.insert(properties).values(propertyInserts).returning();
          }
        });
      }

      importedRows += customerInserts.length;
      const progress = parsedCsv.rows.length === 0
        ? 100
        : Math.round((processedRows / parsedCsv.rows.length) * 100);
      await db
        .update(importSessions)
        .set({
          importedRows,
          skippedRows,
          duplicateRows,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(importSessions.companyId, companyId),
            eq(importSessions.id, importSessionId),
            isNull(importSessions.deletedAt)
          )
        )
        .returning();
      await job.updateProgress?.(progress);
    }

    const completedAt = new Date();

    const priorInferences = normalizeAiInferences(importSession.aiInferences);

    await db.transaction(async (tx) => {
      await tx
        .update(importSessions)
        .set({
          status: "completed",
          importedRows,
          skippedRows,
          duplicateRows,
          completedAt,
          errorMessage: null,
          aiInferences: {
            ...priorInferences,
            rollbackSnapshots: {
              customerUpdates: customerUpdateSnapshots
            }
          },
          updatedAt: completedAt
        })
        .where(
          and(
            eq(importSessions.companyId, companyId),
            eq(importSessions.id, importSessionId),
            isNull(importSessions.deletedAt)
          )
        )
        .returning();

      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "import.completed",
        actorType: "system",
        entityType: "import_session",
        entityId: importSessionId,
        payload: {
          importedRows,
          skippedRows,
          duplicateRows
        },
        summary: `Import ${importSession.fileName} completed`
      });
    });

    await aiQueue.add(
      "dormant-customer-scan",
      {
        companyId,
        triggeredBy: "import"
      },
      {
        delay: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );

    await writeImportReconciliationReport(companyId, importSessionId, validationErrors);
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        companyId,
        importSessionId
      },
      "CSV import execution job failed"
    );
    await markImportFailed(importSession, error);
    throw error;
  }
}

export function createCsvImportProcessor(): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    switch (job.name) {
      case "map-csv-columns":
        await handleMapCsvColumns(job);
        return;
      case "validate-csv-rows":
        await handleValidateCsvRows(job);
        return;
      case "execute-import":
        await handleExecuteImport(job);
        return;
      case IMPORT_CHUNK_COMMIT_JOB_NAME:
        await handleImportChunkCommit(job);
        return;
      case IMPORT_COMMUNICATIONS_COMMIT_JOB_NAME:
        await handleImportCommunicationsCommit(job);
        return;
      case IMPORT_INVOICE_BALANCE_COMMIT_JOB_NAME:
        await handleImportInvoiceBalanceCommit(job);
        return;
      case IMPORT_EQUIPMENT_COMMIT_JOB_NAME:
        await handleImportEquipmentCommit(job);
        return;
      default:
        logger.warn({ jobId: job.id ?? null, jobName: job.name }, "Unknown CSV import job received");
    }
  };
}

export const processCsvImport = createCsvImportProcessor();
