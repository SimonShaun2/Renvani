import type { Job } from "bullmq";
import Papa from "papaparse";
import pino from "pino";

import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import {
  commitImportedCommunicationRows,
  db,
  resolveSourceSystemForCommunicationsImport,
} from "@fsm/db";
import {
  IMPORT_COMMUNICATIONS_COMMIT_JOB_NAME,
  ImportCommunicationsCommitPayloadSchema,
  type ImportCommunicationsCommitPayload,
} from "@fsm/jobs";
import { ImportCommunicationCommitRowSchema, type ColumnMapping, sanitizeSpreadsheetCell } from "@fsm/types";

const logger = pino({
  name: "import-communications-chunk-processor",
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

function buildResolver(lineageMaps: ImportCommunicationsCommitPayload["lineageMaps"]) {
  const customers = lineageMaps?.customers ?? {};
  const jobs = lineageMaps?.jobs ?? {};

  return {
    async resolveCustomerId({
      customerId,
      customerSourceId,
    }: {
      customerId?: string;
      customerSourceId?: string;
    }) {
      if (customerId) {
        return customerId;
      }
      if (customerSourceId && customers[customerSourceId]) {
        return customers[customerSourceId];
      }
      return null;
    },
    async resolveJobId({ jobSourceId }: { jobSourceId: string }) {
      return jobs[jobSourceId] ?? null;
    },
  };
}

export async function handleImportCommunicationsCommit(
  job: Job<Record<string, unknown>>,
): Promise<void> {
  const parsedPayload = ImportCommunicationsCommitPayloadSchema.safeParse(job.data);
  if (!parsedPayload.success) {
    logger.warn({ jobId: job.id ?? null }, "Communications import chunk missing valid payload");
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
      "Communications import chunk skipped — session not found",
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
  const resolver = buildResolver(payload.lineageMaps);
  const ctx = {
    companyId: payload.companyId,
    importSessionId: payload.importSessionId,
    sourceSystem: payload.sourceSystem,
  };

  const communicationRows = chunkRows.map((row) => {
    const mapped = mapRowValues(row.values, columnMapping);
    return ImportCommunicationCommitRowSchema.parse({
      rowNumber: row.rowNumber,
      sourceId: normalizeTextValue(mapped.sourceId) ?? `row-${String(row.rowNumber)}`,
      customerId: normalizeTextValue(mapped.customerId) ?? undefined,
      customerSourceId: normalizeTextValue(mapped.customerSourceId) ?? undefined,
      jobSourceId: normalizeTextValue(mapped.jobSourceId) ?? undefined,
      channel: mapped.channel,
      direction: mapped.direction,
      toAddress: mapped.toAddress,
      fromAddress: normalizeTextValue(mapped.fromAddress) ?? undefined,
      subject: normalizeTextValue(mapped.subject) ?? undefined,
      body: mapped.body,
      sentAt: normalizeTextValue(mapped.sentAt) ?? undefined,
      providerMessageId: normalizeTextValue(mapped.providerMessageId) ?? undefined,
      providerStatus: normalizeTextValue(mapped.providerStatus) ?? undefined,
    });
  });

  const result = await commitImportedCommunicationRows(ctx, communicationRows, resolver);
  logger.info(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      chunkIndex: payload.chunkIndex,
      messagesCommitted: result.messagesCommitted,
      rowsFailed: result.rowsFailed,
    },
    "Communications import chunk committed",
  );
}

export { IMPORT_COMMUNICATIONS_COMMIT_JOB_NAME };
