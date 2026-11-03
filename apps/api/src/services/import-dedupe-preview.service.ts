import Papa from "papaparse";

import { downloadFile, getFileKeyFromUrl } from "@fsm/config/storage";
import { customers, db, importSessions } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type ColumnMapping,
  type ImportDuplicateAction,
  type MigrateDedupeCollision,
  type MigrateDedupePreviewResponse
} from "@fsm/types";
import { and, eq, isNull } from "drizzle-orm";

import {
  buildCustomerLookupMaps,
  buildDedupeCollisionKey,
  findDuplicateCustomer,
  mapCustomerRow
} from "./import-customer-dedupe.logic.js";

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

function normalizeDedupeDecisions(value: unknown): Record<string, ImportDuplicateAction> {
  if (!isPlainObject(value)) {
    return {};
  }

  const decisions: Record<string, ImportDuplicateAction> = {};
  for (const [key, action] of Object.entries(value)) {
    if (action === "skip" || action === "update_existing" || action === "import_new") {
      decisions[key] = action;
    }
  }
  return decisions;
}

function buildRowLabel(mappedRow: ReturnType<typeof mapCustomerRow>): string {
  const display = mappedRow.displayName ?? `${mappedRow.firstName} ${mappedRow.lastName}`.trim();
  return display.length > 0 ? display : `Row ${String(mappedRow.firstName)}`;
}

async function parseCustomerCsv(fileUrl: string): Promise<Array<{ rowNumber: number; values: Record<string, string> }>> {
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
      normalizedValues[key] = typeof entry === "string" ? entry : entry === null || entry === undefined ? "" : String(entry);
    }

    rows.push({ rowNumber, values: normalizedValues });
    rowNumber += 1;
  }

  return rows;
}

export async function buildDedupePreviewForBundle(
  companyId: string,
  bundleId: string,
  importSessionIds: string[],
  storedDecisions: Record<string, ImportDuplicateAction>
): Promise<MigrateDedupePreviewResponse> {
  if (importSessionIds.length === 0) {
    return {
      bundleId,
      collisions: [],
      unresolvedCount: 0,
      totalDuplicateRows: 0
    };
  }

  const sessions = await db
    .select()
    .from(importSessions)
    .where(
      and(
        eq(importSessions.companyId, companyId),
        isNull(importSessions.deletedAt)
      )
    );

  const bundleSessions = sessions.filter(
    (session) => session.importBundleId === bundleId && importSessionIds.includes(session.id)
  );

  if (bundleSessions.length !== importSessionIds.length) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more import sessions are not linked to this bundle");
  }

  const existingCustomers = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      displayName: customers.displayName,
      email: customers.email,
      phone: customers.phone
    })
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)));

  const lookupMaps = buildCustomerLookupMaps(existingCustomers);
  const collisions: MigrateDedupeCollision[] = [];

  for (const session of bundleSessions) {
    if (session.entityType !== "customers") {
      continue;
    }

    if (session.status !== "preview" && session.status !== "importing" && session.status !== "completed") {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Import session ${session.id} must reach preview before dedupe preview`
      );
    }

    const columnMapping = normalizeColumnMappings(session.columnMappings);
    const rows = await parseCustomerCsv(session.fileUrl);

    for (const row of rows) {
      const mappedRow = mapCustomerRow(row.values, columnMapping);
      const duplicateMatch = findDuplicateCustomer(mappedRow, lookupMaps);
      if (!duplicateMatch) {
        continue;
      }

      const collisionKey = buildDedupeCollisionKey(session.id, row.rowNumber);
      const matchedCustomer = duplicateMatch.customer;
      const matchedCustomerName =
        matchedCustomer.displayName ?? `${matchedCustomer.firstName} ${matchedCustomer.lastName}`.trim();

      collisions.push({
        collisionKey,
        importSessionId: session.id,
        rowNumber: row.rowNumber,
        rowLabel: buildRowLabel(mappedRow),
        matchReason: duplicateMatch.reason,
        matchedCustomerId: matchedCustomer.id,
        matchedCustomerName,
        matchedCustomerEmail: matchedCustomer.email,
        matchedCustomerPhone: matchedCustomer.phone,
        sourceValues: row.values,
        action: storedDecisions[collisionKey] ?? "skip"
      });
    }
  }

  const unresolvedCount = collisions.filter((collision) => collision.action === "skip").length;

  return {
    bundleId,
    collisions,
    unresolvedCount,
    totalDuplicateRows: collisions.length
  };
}

export function mergeDedupeDecisions(
  existing: Record<string, ImportDuplicateAction>,
  updates: Array<{ collisionKey: string; action: ImportDuplicateAction }>
): Record<string, ImportDuplicateAction> {
  const merged = { ...normalizeDedupeDecisions(existing) };
  for (const update of updates) {
    merged[update.collisionKey] = update.action;
  }
  return merged;
}

export function buildDuplicateActionsBySession(
  collisions: MigrateDedupeCollision[],
  decisions: Record<string, ImportDuplicateAction>
): Record<string, Record<string, ImportDuplicateAction>> {
  const bySession: Record<string, Record<string, ImportDuplicateAction>> = {};

  for (const collision of collisions) {
    const action = decisions[collision.collisionKey] ?? collision.action;
    const sessionActions = bySession[collision.importSessionId] ?? {};
    sessionActions[String(collision.rowNumber)] = action;
    bySession[collision.importSessionId] = sessionActions;
  }

  return bySession;
}
