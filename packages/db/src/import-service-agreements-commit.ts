import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  serviceAgreementImportRowSchema,
  type ImportSourceSystemId,
  type ServiceAgreementsImportCommitResult,
} from "@fsm/types";

import { db } from "./client.js";
import {
  mapServiceAgreementImportRow,
  type ParsedImportRow,
} from "./import-service-agreements-rows.js";
import { customers, maintenancePlans } from "./schema.js";

export type { ParsedImportRow, ServiceAgreementsValidationResult } from "./import-service-agreements-rows.js";
export {
  mapServiceAgreementImportRow,
  validateServiceAgreementImportRows,
} from "./import-service-agreements-rows.js";

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

async function upsertMaintenancePlanFromImport(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  customerId: string;
  row: ReturnType<typeof serviceAgreementImportRowSchema.parse>;
  now: Date;
}): Promise<void> {
  const existing = await db
    .select({ id: maintenancePlans.id })
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.companyId, options.companyId),
        eq(maintenancePlans.sourceSystem, options.sourceSystem),
        eq(maintenancePlans.sourceId, options.row.sourceId),
        isNull(maintenancePlans.deletedAt),
      ),
    )
    .limit(1);

  const planId = existing[0]?.id ?? randomUUID();

  if (existing.length === 0) {
    await db.insert(maintenancePlans).values({
      id: planId,
      companyId: options.companyId,
      customerId: options.customerId,
      name: options.row.name,
      frequency: options.row.frequency,
      status: options.row.status,
      price: options.row.price,
      startDate: options.row.startDate,
      nextServiceDate: options.row.nextServiceDate,
      sourceSystem: options.sourceSystem,
      sourceId: options.row.sourceId,
      importSessionId: options.importSessionId,
      createdAt: options.now,
      updatedAt: options.now,
    });
    return;
  }

  await db
    .update(maintenancePlans)
    .set({
      customerId: options.customerId,
      name: options.row.name,
      frequency: options.row.frequency,
      status: options.row.status,
      price: options.row.price,
      startDate: options.row.startDate,
      nextServiceDate: options.row.nextServiceDate,
      importSessionId: options.importSessionId,
      updatedAt: options.now,
    })
    .where(
      and(
        eq(maintenancePlans.companyId, options.companyId),
        eq(maintenancePlans.id, planId),
        isNull(maintenancePlans.deletedAt),
      ),
    );
}

export async function commitServiceAgreementImportRows(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  rows: ParsedImportRow[];
  columnMapping: Record<string, string | null>;
  invalidRowNumbers: Set<number>;
}): Promise<ServiceAgreementsImportCommitResult> {
  let importedRows = 0;
  let skippedRows = 0;
  let maintenancePlanCount = 0;
  const now = new Date();

  for (const row of options.rows) {
    if (options.invalidRowNumbers.has(row.rowNumber)) {
      skippedRows += 1;
      continue;
    }

    const mapped = mapServiceAgreementImportRow(row.values, options.columnMapping);
    if (!mapped) {
      skippedRows += 1;
      continue;
    }

    const parsed = serviceAgreementImportRowSchema.safeParse(mapped);
    if (!parsed.success) {
      skippedRows += 1;
      continue;
    }

    const customerId = await resolveCustomerIdByLineage(
      options.companyId,
      options.sourceSystem,
      parsed.data.customerSourceId,
    );

    if (!customerId) {
      skippedRows += 1;
      continue;
    }

    await upsertMaintenancePlanFromImport({
      companyId: options.companyId,
      importSessionId: options.importSessionId,
      sourceSystem: options.sourceSystem,
      customerId,
      row: parsed.data,
      now,
    });
    maintenancePlanCount += 1;
    importedRows += 1;
  }

  return {
    importedRows,
    skippedRows,
    maintenancePlans: maintenancePlanCount,
  };
}

export async function softDeleteServiceAgreementsImport(
  companyId: string,
  importSessionId: string,
): Promise<void> {
  const now = new Date();

  await db
    .update(maintenancePlans)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(maintenancePlans.companyId, companyId),
        eq(maintenancePlans.importSessionId, importSessionId),
        isNull(maintenancePlans.deletedAt),
      ),
    );
}
