import Papa from "papaparse";

import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import { db, importSessions } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type ColumnMapping,
  type ImportBundleFileRef,
  type ImportBundleRelationalPreview,
  type MappedImportPreviewRow,
  type MigrateOnboardingFileRef,
  type RelationalPreviewFieldKeys
} from "@fsm/types";
import { and, eq, isNull } from "drizzle-orm";

import {
  buildImportBundleRelationalPreview,
  mappedImportPreviewRowsFromCsv
} from "./import-relational-preview.service.js";

export const DEFAULT_RELATIONAL_PREVIEW_FIELD_KEYS = {
  customers: {
    sourceId: "sourceId",
    displayName: "displayName"
  },
  properties: {
    sourceId: "sourceId",
    customerSourceId: "customerSourceId",
    label: "label"
  },
  jobs: {
    sourceId: "sourceId",
    propertySourceId: "propertySourceId",
    businessDate: "completedAt",
    label: "label"
  },
  estimates: {
    sourceId: "sourceId",
    jobSourceId: "jobSourceId",
    businessDate: "issuedAt",
    label: "label"
  }
} satisfies {
  customers: RelationalPreviewFieldKeys;
  properties: RelationalPreviewFieldKeys;
  jobs: RelationalPreviewFieldKeys;
  estimates: RelationalPreviewFieldKeys;
};

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

async function parseTabularImportFile(
  fileUrl: string
): Promise<Array<{ rowNumber: number; values: Record<string, string> }>> {
  const objectKey = getFileKeyFromUrl(fileUrl);
  const fileBuffer = await downloadFile(objectKey);
  const csvText = fileBuffer.toString("utf8");

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  const rows: Array<{ rowNumber: number; values: Record<string, string> }> = [];
  let rowNumber = 2;

  for (const values of parsed.data) {
    if (!values || typeof values !== "object") {
      continue;
    }

    const normalizedValues: Record<string, string> = {};
    for (const [key, entry] of Object.entries(values)) {
      normalizedValues[key] =
        typeof entry === "string" ? entry : entry === null || entry === undefined ? "" : String(entry);
    }

    rows.push({ rowNumber, values: normalizedValues });
    rowNumber += 1;
  }

  return rows;
}

function toBundleFileRef(file: MigrateOnboardingFileRef): ImportBundleFileRef {
  if (file.entityType === "customers") {
    return {
      importSessionId: file.importSessionId,
      kind: "customers",
      fileName: file.fileName
    };
  }

  if (file.entityType === "properties") {
    return {
      importSessionId: file.importSessionId,
      kind: "properties",
      fileName: file.fileName
    };
  }

  if (file.entityType === "jobs") {
    return {
      importSessionId: file.importSessionId,
      kind: "jobs",
      fileName: file.fileName
    };
  }

  return {
    importSessionId: file.importSessionId,
    kind: "estimates",
    fileName: file.fileName
  };
}

export async function buildRelationalPreviewForBundle(
  companyId: string,
  bundleId: string,
  files: MigrateOnboardingFileRef[]
): Promise<ImportBundleRelationalPreview> {
  if (files.length === 0) {
    return buildImportBundleRelationalPreview({
      bundleId,
      files: [],
      customerMappedRows: [],
      propertyMappedRows: [],
      fieldKeys: DEFAULT_RELATIONAL_PREVIEW_FIELD_KEYS
    });
  }

  const sessionIds = files.map((file) => file.importSessionId);
  const sessions = await db
    .select()
    .from(importSessions)
    .where(and(eq(importSessions.companyId, companyId), isNull(importSessions.deletedAt)));

  const bundleSessions = sessions.filter(
    (session) => session.importBundleId === bundleId && sessionIds.includes(session.id)
  );

  if (bundleSessions.length !== sessionIds.length) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more import sessions are not linked to this bundle");
  }

  const sessionById = new Map(bundleSessions.map((session) => [session.id, session]));
  const bundleFileRefs: ImportBundleFileRef[] = [];
  let customerMappedRows: MappedImportPreviewRow[] = [];
  let propertyMappedRows: MappedImportPreviewRow[] = [];
  let jobMappedRows: MappedImportPreviewRow[] | undefined;
  let estimateMappedRows: MappedImportPreviewRow[] | undefined;

  for (const file of files) {
    const session = sessionById.get(file.importSessionId);
    if (!session) {
      throw new AppError(ErrorCode.NOT_FOUND, `Import session ${file.importSessionId} not found`);
    }

    if (session.entityType !== file.entityType) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Import session entity type does not match bundle file metadata");
    }

    const mappingStepStatuses = new Set(["mapping", "preview"]);
    if (!mappingStepStatuses.has(session.status) && session.status !== "importing" && session.status !== "completed") {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Import session ${session.id} must reach mapping or preview before relational preview`
      );
    }

    bundleFileRefs.push(toBundleFileRef(file));
    const columnMapping = normalizeColumnMappings(session.columnMappings);
    const parsedRows = await parseTabularImportFile(session.fileUrl);
    const mappedRows = mappedImportPreviewRowsFromCsv(parsedRows, columnMapping);

    if (file.entityType === "customers") {
      customerMappedRows = mappedRows;
    } else if (file.entityType === "properties") {
      propertyMappedRows = mappedRows;
    } else if (file.entityType === "jobs") {
      jobMappedRows = mappedRows;
    } else {
      estimateMappedRows = mappedRows;
    }
  }

  const previewInput = {
    bundleId,
    files: bundleFileRefs,
    customerMappedRows,
    propertyMappedRows,
    fieldKeys: DEFAULT_RELATIONAL_PREVIEW_FIELD_KEYS,
    ...(jobMappedRows !== undefined ? { jobMappedRows } : {}),
    ...(estimateMappedRows !== undefined ? { estimateMappedRows } : {})
  };

  return buildImportBundleRelationalPreview(previewInput);
}
