import { communicationsImportRowSchema, type ValidationError } from "@fsm/types";

import {
  normalizeImportedMessageChannel,
  normalizeImportedMessageDirection,
  resolveImportedMessageToAddress,
  type ImportedMessageChannel,
} from "./import-communications-commit.logic.js";

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface CommunicationsValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  validationErrors: ValidationError[];
}

function getMappedValue(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
  field: string,
): string | null {
  for (const [columnName, mappedField] of Object.entries(columnMapping)) {
    if (mappedField === field) {
      const raw = values[columnName];
      if (raw !== undefined) {
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  return null;
}

export function mapCommunicationsRow(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
): ReturnType<typeof communicationsImportRowSchema.safeParse>["data"] | null {
  const sourceId =
    getMappedValue(values, columnMapping, "sourceId") ??
    getMappedValue(values, columnMapping, "messageId");

  const channelRaw =
    getMappedValue(values, columnMapping, "channel") ?? getMappedValue(values, columnMapping, "type");
  const channel = normalizeImportedMessageChannel(channelRaw) ?? ("sms" as ImportedMessageChannel);

  const directionRaw = getMappedValue(values, columnMapping, "direction");
  const direction =
    normalizeImportedMessageDirection(directionRaw) ??
    normalizeImportedMessageDirection(getMappedValue(values, columnMapping, "status")) ??
    "outbound";

  const body =
    getMappedValue(values, columnMapping, "body") ??
    getMappedValue(values, columnMapping, "message") ??
    getMappedValue(values, columnMapping, "content");

  const toAddress = resolveImportedMessageToAddress({
    toAddress: getMappedValue(values, columnMapping, "toAddress"),
    email: getMappedValue(values, columnMapping, "email"),
    phone: getMappedValue(values, columnMapping, "phone"),
    channel,
  });

  if (!sourceId || !body || !toAddress) {
    return null;
  }

  const rowPayload: Record<string, string | Date> = {
    sourceId,
    channel,
    direction,
    toAddress,
    body,
  };

  const customerSourceId = getMappedValue(values, columnMapping, "customerSourceId");
  const jobSourceId = getMappedValue(values, columnMapping, "jobSourceId");
  const fromAddress = getMappedValue(values, columnMapping, "fromAddress");
  const subject = getMappedValue(values, columnMapping, "subject");
  const sentAtRaw = getMappedValue(values, columnMapping, "sentAt");
  const providerMessageId = getMappedValue(values, columnMapping, "providerMessageId");
  const providerStatus = getMappedValue(values, columnMapping, "providerStatus");

  if (customerSourceId) {
    rowPayload.customerSourceId = customerSourceId;
  }
  if (jobSourceId) {
    rowPayload.jobSourceId = jobSourceId;
  }
  if (fromAddress) {
    rowPayload.fromAddress = fromAddress;
  }
  if (subject) {
    rowPayload.subject = subject;
  }
  if (sentAtRaw) {
    rowPayload.sentAt = sentAtRaw;
  }
  if (providerMessageId) {
    rowPayload.providerMessageId = providerMessageId;
  }
  if (providerStatus) {
    rowPayload.providerStatus = providerStatus;
  }

  const parsed = communicationsImportRowSchema.safeParse(rowPayload);

  return parsed.success ? parsed.data : null;
}

export function validateCommunicationsRows(
  rows: ParsedImportRow[],
  columnMapping: Record<string, string | null>,
): CommunicationsValidationResult {
  const validationErrors: ValidationError[] = [];
  const seenSourceIds = new Set<string>();
  let validRows = 0;

  for (const row of rows) {
    const mapped = mapCommunicationsRow(row.values, columnMapping);
    if (!mapped) {
      validationErrors.push({
        row: row.rowNumber,
        field: "sourceId",
        message: "Missing message id, body, or destination address",
        value: "",
      });
      continue;
    }

    if (seenSourceIds.has(mapped.sourceId)) {
      validationErrors.push({
        row: row.rowNumber,
        field: "sourceId",
        message: "Duplicate vendor message id in file",
        value: mapped.sourceId,
      });
      continue;
    }

    seenSourceIds.add(mapped.sourceId);
    validRows += 1;
  }

  const errorRows = validationErrors.length;
  const duplicateRows = validationErrors.filter((entry) => entry.message.includes("Duplicate")).length;

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    duplicateRows,
    validationErrors,
  };
}
