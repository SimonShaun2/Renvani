import type { Job } from "bullmq";
import Papa from "papaparse";
import pino from "pino";

import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import { buildLineageEquipmentResolver, commitImportedEquipmentRows, db } from "@fsm/db";
import {
  IMPORT_EQUIPMENT_COMMIT_JOB_NAME,
  ImportEquipmentCommitPayloadSchema,
  type ImportEquipmentCommitPayload,
} from "@fsm/jobs";
import {
  ImportEquipmentCommitRowSchema,
  normalizeImportedAssetType,
  normalizeImportedIsoDate,
  parseImportedBoolean,
  type ColumnMapping,
  sanitizeSpreadsheetCell,
} from "@fsm/types";

const logger = pino({
  name: "import-equipment-chunk-processor",
});

interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
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
  const trimmed = sanitizeSpreadsheetCell(value.trim());
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsv(buffer: Buffer): ParsedCsvRow[] {
  const csvText = buffer.toString("utf8").replace(/^\uFEFF/u, "");
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
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
    rows.push({ rowNumber: index + 2, values: normalizedRow });
  }

  return rows;
}

function mapRowValues(values: Record<string, string>, columnMapping: ColumnMapping): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
      continue;
    }
    mapped[fieldName] = values[csvColumn] ?? "";
  }
  return mapped;
}

function resolveRowWindow(
  rowWindow: { start: number; end: number } | undefined,
  totalRows: number,
  chunkIndex: number,
  chunksTotal: number,
): { start: number; end: number } {
  if (rowWindow) {
    return {
      start: rowWindow.start,
      end: Math.min(rowWindow.end, totalRows),
    };
  }

  const chunkSize = Math.max(1, Math.ceil(totalRows / chunksTotal));
  const start = chunkIndex * chunkSize;
  return { start, end: Math.min(start + chunkSize, totalRows) };
}

export function mapEquipmentRow(row: ParsedCsvRow, columnMapping: ColumnMapping) {
  const mapped = mapRowValues(row.values, columnMapping);
  const assetType =
    normalizeImportedAssetType(mapped.assetType) ??
    normalizeImportedAssetType(mapped.equipmentType) ??
    "equipment";

  return ImportEquipmentCommitRowSchema.parse({
    rowNumber: row.rowNumber,
    sourceId: normalizeTextValue(mapped.sourceId) ?? normalizeTextValue(mapped.equipmentId) ?? "",
    name: normalizeTextValue(mapped.name) ?? normalizeTextValue(mapped.equipmentName) ?? "",
    assetType,
    customerId: normalizeTextValue(mapped.customerId) ?? undefined,
    customerSourceId: normalizeTextValue(mapped.customerSourceId) ?? undefined,
    propertyId: normalizeTextValue(mapped.propertyId) ?? undefined,
    propertySourceId:
      normalizeTextValue(mapped.propertySourceId) ??
      normalizeTextValue(mapped.locationSourceId) ??
      undefined,
    brand: normalizeTextValue(mapped.brand) ?? undefined,
    model: normalizeTextValue(mapped.model) ?? undefined,
    serialNumber:
      normalizeTextValue(mapped.serialNumber) ?? normalizeTextValue(mapped.serial) ?? undefined,
    installDate: normalizeImportedIsoDate(mapped.installDate) ?? undefined,
    warrantyExpiration: normalizeImportedIsoDate(mapped.warrantyExpiration) ?? undefined,
    lastServiceDate:
      normalizeImportedIsoDate(mapped.lastServiceDate) ??
      normalizeImportedIsoDate(mapped.lastServicedOn) ??
      undefined,
    lastServiceJobSourceId:
      normalizeTextValue(mapped.lastServiceJobSourceId) ??
      normalizeTextValue(mapped.lastJobSourceId) ??
      undefined,
    condition: normalizeTextValue(mapped.condition) ?? undefined,
    notes: normalizeTextValue(mapped.notes) ?? undefined,
    isActive: parseImportedBoolean(mapped.isActive, true),
  });
}

export async function handleImportEquipmentCommit(job: Job<Record<string, unknown>>): Promise<void> {
  const parsedPayload = ImportEquipmentCommitPayloadSchema.safeParse(job.data);
  if (!parsedPayload.success) {
    logger.warn({ jobId: job.id ?? null }, "Equipment import chunk missing valid payload");
    return;
  }

  const payload = parsedPayload.data;
  const importSession = await db.query.importSessions.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.companyId, payload.companyId),
        operators.eq(table.id, payload.importSessionId),
        operators.isNull(table.deletedAt),
      ),
  });

  if (!importSession) {
    logger.warn(
      { companyId: payload.companyId, importSessionId: payload.importSessionId },
      "Equipment import chunk skipped — session not found",
    );
    return;
  }

  const fileBuffer = await downloadFile(getFileKeyFromUrl(importSession.fileUrl));
  const parsedRows = parseCsv(fileBuffer);
  const columnMapping = normalizeColumnMappings(importSession.columnMappings);
  const window = resolveRowWindow(
    payload.rowWindow,
    parsedRows.length,
    payload.chunkIndex,
    payload.chunksTotal,
  );
  const chunkRows = parsedRows.slice(window.start, window.end);

  const equipmentRows = chunkRows.map((row) => mapEquipmentRow(row, columnMapping));

  const resolver = await buildLineageEquipmentResolver(
    payload.companyId,
    payload.sourceSystem,
    payload.lineageMaps,
  );

  const result = await commitImportedEquipmentRows(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      sourceSystem: payload.sourceSystem,
    },
    equipmentRows,
    resolver,
  );

  logger.info(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      chunkIndex: payload.chunkIndex,
      assetsCommitted: result.assetsCommitted,
      rowsFailed: result.rowsFailed,
    },
    "Equipment import chunk committed",
  );
}

export { IMPORT_EQUIPMENT_COMMIT_JOB_NAME };
