import type { Job } from "bullmq";
import Papa from "papaparse";
import pino from "pino";
import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import {
  commitImportedInvoiceRows,
  commitImportedPaymentRows,
  db,
  normalizeImportedPaymentMethod,
  type ImportInvoiceBalanceEntityResolver,
} from "@fsm/db";
import {
  IMPORT_INVOICE_BALANCE_COMMIT_JOB_NAME,
  ImportInvoiceBalanceCommitPayloadSchema,
  type ImportInvoiceBalanceCommitPayload,
} from "@fsm/jobs";
import {
  ImportInvoiceCommitRowSchema,
  ImportPaymentCommitRowSchema,
  type ColumnMapping,
  sanitizeSpreadsheetCell,
} from "@fsm/types";

const logger = pino({
  name: "import-invoice-balance-chunk-processor",
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

export function mapInvoiceCommitRow(row: ParsedCsvRow, columnMapping: ColumnMapping) {
  const mapped = mapRowValues(row.values, columnMapping);
  return ImportInvoiceCommitRowSchema.parse({
    rowNumber: row.rowNumber,
    sourceId: normalizeTextValue(mapped.sourceId) ?? mapped.invoiceNumber,
    invoiceNumber: mapped.invoiceNumber,
    customerId: normalizeTextValue(mapped.customerId) ?? undefined,
    customerSourceId: normalizeTextValue(mapped.customerSourceId) ?? undefined,
    jobSourceId: normalizeTextValue(mapped.jobSourceId) ?? undefined,
    total: mapped.total,
    balanceDue: normalizeTextValue(mapped.balanceDue) ?? undefined,
    amountPaid: normalizeTextValue(mapped.amountPaid) ?? undefined,
    issuedAt: normalizeTextValue(mapped.issuedAt) ?? undefined,
    dueAt: normalizeTextValue(mapped.dueAt) ?? undefined,
    paidAt: normalizeTextValue(mapped.paidAt) ?? undefined,
    title: normalizeTextValue(mapped.title) ?? undefined,
  });
}

function buildResolver(
  lineageMaps: ImportInvoiceBalanceCommitPayload["lineageMaps"],
): ImportInvoiceBalanceEntityResolver {
  const customers = lineageMaps?.customers ?? {};
  const jobs = lineageMaps?.jobs ?? {};
  const invoices = lineageMaps?.invoices ?? {};

  return {
    async resolveCustomerId({ customerId, customerSourceId }) {
      if (customerId) {
        return customerId;
      }
      if (customerSourceId && customers[customerSourceId]) {
        return customers[customerSourceId];
      }
      return null;
    },
    async resolveJobId({ jobSourceId }) {
      return jobs[jobSourceId] ?? null;
    },
    async resolveInvoiceId({ invoiceSourceId }) {
      return invoices[invoiceSourceId] ?? null;
    },
  };
}

export async function handleImportInvoiceBalanceCommit(
  job: Job<Record<string, unknown>>,
): Promise<void> {
  const parsedPayload = ImportInvoiceBalanceCommitPayloadSchema.safeParse(job.data);
  if (!parsedPayload.success) {
    logger.warn({ jobId: job.id ?? null }, "Invoice balance import chunk missing valid payload");
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
      "Invoice balance import chunk skipped — session not found",
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

  if (payload.entityType === "invoices") {
    const invoiceRows = chunkRows.map((row) => mapInvoiceCommitRow(row, columnMapping));

    const result = await commitImportedInvoiceRows(ctx, invoiceRows, resolver);
    logger.info(
      {
        companyId: payload.companyId,
        importSessionId: payload.importSessionId,
        chunkIndex: payload.chunkIndex,
        invoicesCommitted: result.invoicesCommitted,
        rowsFailed: result.rowsFailed,
      },
      "Invoice import chunk committed",
    );
    return;
  }

  const paymentRows = chunkRows.map((row) => {
    const mapped = mapRowValues(row.values, columnMapping);
    return ImportPaymentCommitRowSchema.parse({
      rowNumber: row.rowNumber,
      sourceId: normalizeTextValue(mapped.sourceId) ?? `${mapped.invoiceSourceId}-${mapped.paidAt}`,
      invoiceSourceId: mapped.invoiceSourceId,
      amount: mapped.amount,
      paidAt: mapped.paidAt,
      method: normalizeImportedPaymentMethod(mapped.method),
      referenceNumber: normalizeTextValue(mapped.referenceNumber) ?? undefined,
      notes: normalizeTextValue(mapped.notes) ?? undefined,
    });
  });

  const result = await commitImportedPaymentRows(ctx, paymentRows, resolver);
  logger.info(
    {
      companyId: payload.companyId,
      importSessionId: payload.importSessionId,
      chunkIndex: payload.chunkIndex,
      paymentsCommitted: result.paymentsCommitted,
      rowsFailed: result.rowsFailed,
    },
    "Payment import chunk committed",
  );
}

export { IMPORT_INVOICE_BALANCE_COMMIT_JOB_NAME };
