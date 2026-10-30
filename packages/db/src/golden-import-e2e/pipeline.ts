import { randomUUID } from "node:crypto";

import type { ImportSourceSystemId } from "@fsm/config/import-price-book-map";
import {
  getGoldenImportBundleManifest,
  parseGoldenBundleTabularTable,
  readGoldenImportBundleFile
} from "@fsm/config/import-golden-bundles";
import {
  buildPresetColumnMapping,
  inferImportSourcePresetFromHeaders
} from "@fsm/config/import-source-presets";
import type { GoldenBundleEntityType, GoldenImportBundleManifest } from "@fsm/types";
import {
  ImportEquipmentCommitRowSchema,
  ImportInvoiceCommitRowSchema,
  ImportJobCommitRowSchema,
  ImportPaymentCommitRowSchema,
  sanitizeSpreadsheetCell,
  type ColumnMapping
} from "@fsm/types";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../client.js";
import { buildLineageEquipmentResolver, commitImportedEquipmentRows } from "../import-equipment-commit.service.js";
import {
  commitImportedInvoiceRows,
  commitImportedPaymentRows
} from "../import-invoice-balance-commit.service.js";
import { commitImportedJobRows, createDbHistoryChunkResolver } from "../import-history-chunk-commit.service.js";
import { normalizeImportedPaymentMethod } from "../import-invoice-balance-commit.logic.js";
import { commitPriceBookRows } from "../import-price-book-commit.js";
import {
  assets,
  customers,
  companies,
  dataExportSessions,
  importInvoiceLineSeeds,
  qboEntityMappings,
  importSessions,
  invoices,
  jobs,
  payments,
  productCatalog,
  properties
} from "../schema.js";
import type { GoldenImportE2eSourceSystem } from "./expectations.js";

const ENTITY_COMMIT_RANK: Partial<Record<GoldenBundleEntityType, number>> = {
  products: 0,
  customers: 1,
  properties: 2,
  jobs: 3,
  invoices: 4,
  payments: 5,
  equipment: 6
};

interface ParsedGoldenRow {
  rowNumber: number;
  values: Record<string, string>;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = sanitizeSpreadsheetCell(value.trim());
  return trimmed.length > 0 ? trimmed : null;
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

function inferPresetId(
  manifest: GoldenImportBundleManifest,
  file: GoldenImportBundleManifest["files"][number],
  headers: string[]
): string {
  const presetId = inferImportSourcePresetFromHeaders(headers, file.presetEntityHint);
  if (presetId) {
    return presetId;
  }

  if (manifest.sourceSystem === "service_fusion" && file.relativePath.includes("price_book")) {
    return "service_fusion_price_book";
  }

  // Equipment has no vendor preset; the equipment commit reads vendor columns directly.
  if (file.entityType === "equipment") {
    return "generic";
  }

  if (manifest.sourceSystem === "qbd") {
    const slot = file.entityType === "payments" ? "payments" : file.entityType;
    const contractPreset = {
      customers: "quickbooks_desktop_customers",
      products: "quickbooks_desktop_items",
      invoices: "quickbooks_desktop_invoices",
      payments: "quickbooks_desktop_payments"
    } as const;
    if (slot in contractPreset) {
      return contractPreset[slot as keyof typeof contractPreset];
    }
  }

  throw new Error(`Could not infer import preset for ${manifest.sourceSystem}/${file.relativePath}`);
}

function parseGoldenFileRows(
  manifest: GoldenImportBundleManifest,
  file: GoldenImportBundleManifest["files"][number]
): { headers: string[]; rows: ParsedGoldenRow[] } {
  const content = readGoldenImportBundleFile(manifest.sourceSystem, file.relativePath);
  const table = parseGoldenBundleTabularTable(content, file.relativePath, file.entityType);
  const rows = table.rows.map((cells, index) => {
    const values: Record<string, string> = {};
    for (let columnIndex = 0; columnIndex < table.headers.length; columnIndex += 1) {
      const header = table.headers[columnIndex];
      if (!header) {
        continue;
      }
      values[header] = cells[columnIndex] ?? "";
    }
    return { rowNumber: index + 2, values };
  });

  return { headers: table.headers, rows };
}

function pickVendorSourceId(
  file: GoldenImportBundleManifest["files"][number],
  values: Record<string, string>,
  mapped: Record<string, string>
): string | null {
  const direct =
    normalizeText(mapped.sourceId) ??
    normalizeText(values["Customer ID"]) ??
    normalizeText(values["Job ID"]) ??
    normalizeText(values["Invoice ID"]) ??
    normalizeText(values["Payment ID"]) ??
    normalizeText(values["Equipment ID"]) ??
    normalizeText(values["Location ID"]) ??
    normalizeText(values["Item ID"]) ??
    normalizeText(values.NAME) ??
    normalizeText(values.Item) ??
    normalizeText(values["Invoice #"]) ??
    normalizeText(mapped.invoiceNumber) ??
    normalizeText(mapped.reference);

  return direct;
}

async function upsertCustomerByLineage(
  companyId: string,
  importSessionId: string,
  sourceSystem: string,
  sourceId: string,
  mapped: Record<string, string>
): Promise<void> {
  const firstName = normalizeText(mapped.firstName) ?? normalizeText(mapped.displayName) ?? sourceId;
  const lastName = normalizeText(mapped.lastName) ?? "";
  const displayName = normalizeText(mapped.displayName);

  const existing =
    (
      await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, companyId),
            eq(customers.sourceSystem, sourceSystem),
            eq(customers.sourceId, sourceId),
            isNull(customers.deletedAt)
          )
        )
        .limit(1)
    )[0] ?? null;

  const shared = {
    firstName,
    lastName,
    displayName,
    email: normalizeText(mapped.email)?.toLowerCase() ?? null,
    phone: normalizeText(mapped.phone),
    sourceSystem,
    sourceId,
    importSessionId,
    updatedAt: new Date()
  };

  if (existing) {
    await db
      .update(customers)
      .set(shared)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, existing.id)));
    return;
  }

  await db.insert(customers).values({
    id: randomUUID(),
    companyId,
    ...shared
  });
}

async function upsertPropertyByLineage(
  companyId: string,
  importSessionId: string,
  sourceSystem: string,
  sourceId: string,
  customerSourceId: string,
  values: Record<string, string>
): Promise<void> {
  const customer =
    (
      await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, companyId),
            eq(customers.sourceSystem, sourceSystem),
            eq(customers.sourceId, customerSourceId),
            isNull(customers.deletedAt)
          )
        )
        .limit(1)
    )[0] ?? null;

  if (!customer) {
    throw new Error(`Property ${sourceId} missing customer ${customerSourceId}`);
  }

  const existing =
    (
      await db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.companyId, companyId),
            eq(properties.sourceSystem, sourceSystem),
            eq(properties.sourceId, sourceId),
            isNull(properties.deletedAt)
          )
        )
        .limit(1)
    )[0] ?? null;

  const addressLine1 =
    normalizeText(values["Service Address"]) ?? normalizeText(values["Address 1"]) ?? "Unknown";
  const city = normalizeText(values.City) ?? "Unknown";
  const state = normalizeText(values.State) ?? "NA";
  const zip = normalizeText(values.ZIP) ?? "00000";

  const shared = {
    customerId: customer.id,
    addressLine1,
    city,
    state,
    zip,
    type: "residential" as const,
    isPrimary: true,
    sourceSystem,
    sourceId,
    importSessionId,
    updatedAt: new Date()
  };

  if (existing) {
    await db.update(properties).set(shared).where(eq(properties.id, existing.id));
    return;
  }

  await db.insert(properties).values({
    id: randomUUID(),
    companyId,
    ...shared
  });
}

async function commitGoldenFile(
  companyId: string,
  importSessionId: string,
  manifest: GoldenImportBundleManifest,
  file: GoldenImportBundleManifest["files"][number]
): Promise<void> {
  const { headers, rows } = parseGoldenFileRows(manifest, file);
  const presetId = inferPresetId(manifest, file, headers);
  const columnMapping: ColumnMapping = {
    ...buildPresetColumnMapping(headers, presetId as never)
  };
  if (columnMapping["Item ID"] === undefined && headers.includes("Item ID")) {
    columnMapping["Item ID"] = "sourceId";
  }
  if (columnMapping.Item === undefined && headers.includes("Item")) {
    columnMapping.Item = "sourceId";
  }
  const sourceSystem = manifest.sourceSystem as ImportSourceSystemId;
  const ctx = { companyId, importSessionId, sourceSystem };

  switch (file.entityType) {
    case "customers": {
      for (const row of rows) {
        const mapped = mapRowValues(row.values, columnMapping);
        const sourceId = pickVendorSourceId(file, row.values, mapped);
        if (!sourceId) {
          throw new Error(`Missing customer source id in ${file.relativePath} row ${row.rowNumber}`);
        }
        await upsertCustomerByLineage(companyId, importSessionId, sourceSystem, sourceId, mapped);
      }
      return;
    }
    case "properties": {
      for (const row of rows) {
        const sourceId = pickVendorSourceId(file, row.values, mapRowValues(row.values, columnMapping));
        const customerSourceId = normalizeText(row.values["Customer ID"]);
        if (!sourceId || !customerSourceId) {
          throw new Error(`Missing property lineage in ${file.relativePath} row ${row.rowNumber}`);
        }
        await upsertPropertyByLineage(
          companyId,
          importSessionId,
          sourceSystem,
          sourceId,
          customerSourceId,
          row.values
        );
      }
      return;
    }
    case "products": {
      const parsedRows = rows.map((row) => ({ rowNumber: row.rowNumber, values: row.values }));
      const result = await commitPriceBookRows({
        companyId,
        importSessionId,
        sourceSystem,
        rows: parsedRows,
        columnMapping,
        invalidRowNumbers: new Set()
      });
      if (result.importedRows !== rows.length) {
        throw new Error(
          `Price book commit imported ${result.importedRows}/${rows.length} for ${file.relativePath}`
        );
      }
      return;
    }
    case "jobs": {
      const resolver = await createDbHistoryChunkResolver(companyId, sourceSystem);
      const jobRows = rows.map((row) => {
        const mapped = mapRowValues(row.values, columnMapping);
        const sourceId = pickVendorSourceId(file, row.values, mapped);
        return ImportJobCommitRowSchema.parse({
          rowNumber: row.rowNumber,
          sourceId,
          jobNumber: sourceId,
          customerSourceId:
            normalizeText(row.values["Customer ID"]) ?? normalizeText(mapped.customerSourceId),
          title: normalizeText(mapped.title) ?? normalizeText(mapped.description) ?? sourceId,
          status: normalizeText(mapped.status) ?? "completed",
          actualEnd: normalizeText(row.values["Completed Date"]) ?? undefined
        });
      });
      const result = await commitImportedJobRows(ctx, jobRows, resolver);
      if (result.rowsCommitted !== rows.length) {
        throw new Error(`Job commit failed for ${file.relativePath}: ${JSON.stringify(result.errors)}`);
      }
      return;
    }
    case "invoices": {
      const resolver = await createDbHistoryChunkResolver(companyId, sourceSystem);
      const invoiceRows = rows.map((row) => {
        const mapped = mapRowValues(row.values, columnMapping);
        const sourceId =
          normalizeText(row.values["Invoice ID"]) ??
          pickVendorSourceId(file, row.values, mapped) ??
          mapped.invoiceNumber;
        return ImportInvoiceCommitRowSchema.parse({
          rowNumber: row.rowNumber,
          sourceId,
          invoiceNumber: sourceId,
          customerSourceId:
            normalizeText(row.values["Customer ID"]) ??
            normalizeText(row.values.Customer) ??
            normalizeText(mapped.customerName),
          total: mapped.total ?? row.values.Total ?? "0",
          balanceDue: normalizeText(mapped.balanceDue) ?? normalizeText(row.values.Balance) ?? "0",
          issuedAt: normalizeText(row.values["Invoice Date"]) ?? normalizeText(mapped.issuedAt)
        });
      });
      const result = await commitImportedInvoiceRows(ctx, invoiceRows, resolver);
      if (result.invoicesCommitted !== rows.length) {
        throw new Error(
          `Invoice commit failed for ${file.relativePath}: ${JSON.stringify(result.errors)}`
        );
      }
      return;
    }
    case "payments": {
      const historyResolver = await createDbHistoryChunkResolver(companyId, sourceSystem);
      const resolver = {
        ...historyResolver,
        async resolveInvoiceId({ invoiceSourceId }: { invoiceSourceId: string }) {
          const match = await db
            .select({ id: invoices.id })
            .from(invoices)
            .where(
              and(
                eq(invoices.companyId, companyId),
                eq(invoices.sourceSystem, sourceSystem),
                eq(invoices.sourceId, invoiceSourceId),
                isNull(invoices.deletedAt)
              )
            )
            .limit(1);
          return match[0]?.id ?? null;
        }
      };
      const paymentRows = rows.map((row) => {
        const mapped = mapRowValues(row.values, columnMapping);
        const invoiceSourceId =
          normalizeText(row.values["Invoice ID"]) ?? normalizeText(mapped.invoiceNumber) ?? "";
        const sourceId =
          normalizeText(row.values["Payment ID"]) ??
          pickVendorSourceId(file, row.values, mapped) ??
          `${invoiceSourceId}-payment`;
        return ImportPaymentCommitRowSchema.parse({
          rowNumber: row.rowNumber,
          sourceId,
          invoiceSourceId,
          amount: mapped.amount ?? row.values.Amount ?? "0",
          paidAt: normalizeText(row.values["Payment Date"]) ?? normalizeText(mapped.paidAt) ?? "2024-01-01",
          method: normalizeImportedPaymentMethod(mapped.paymentMethod)
        });
      });
      const result = await commitImportedPaymentRows(ctx, paymentRows, resolver);
      if (result.paymentsCommitted !== rows.length) {
        throw new Error(
          `Payment commit failed for ${file.relativePath}: ${JSON.stringify(result.errors)}`
        );
      }
      return;
    }
    case "equipment": {
      const resolver = await buildLineageEquipmentResolver(companyId, sourceSystem);
      const equipmentRows = rows.map((row) => {
        const mapped = mapRowValues(row.values, columnMapping);
        // Equipment rows also carry Customer ID; the asset's own id must win.
        const sourceId =
          normalizeText(row.values["Equipment ID"]) ?? pickVendorSourceId(file, row.values, mapped);
        return ImportEquipmentCommitRowSchema.parse({
          rowNumber: row.rowNumber,
          sourceId,
          name: normalizeText(mapped.name) ?? normalizeText(row.values["Equipment Type"]) ?? sourceId,
          assetType: normalizeText(row.values["Equipment Type"]) ?? "equipment",
          customerSourceId: normalizeText(row.values["Customer ID"]),
          propertySourceId: normalizeText(row.values["Location ID"]) ?? undefined,
          installDate: normalizeText(row.values["Install Date"]) ?? undefined
        });
      });
      const result = await commitImportedEquipmentRows(ctx, equipmentRows, resolver);
      if (result.assetsCommitted !== rows.length) {
        throw new Error(
          `Equipment commit failed for ${file.relativePath}: ${JSON.stringify(result.errors)}`
        );
      }
      return;
    }
    default:
      throw new Error(`Golden e2e does not commit entity type ${file.entityType}`);
  }
}

export interface GoldenImportE2eRunResult {
  companyId: string;
  importSessionId: string;
  importBundleId: string;
  sourceSystem: GoldenImportE2eSourceSystem;
}

/**
 * Seeds the FK parent for a golden e2e tenant. Every tenant table references companies.id with
 * ON DELETE CASCADE except the three below, which deleteGoldenE2eCompanies clears first.
 */
export async function seedGoldenE2eCompany(companyId: string): Promise<void> {
  await db.insert(companies).values({
    id: companyId,
    name: `Golden import e2e ${companyId.slice(0, 8)}`,
    slug: `golden-e2e-${companyId}`
  });
}

export async function deleteGoldenE2eCompanies(companyIds: readonly string[]): Promise<void> {
  if (companyIds.length === 0) {
    return;
  }
  const ids = [...companyIds];
  // FKs to companies without ON DELETE CASCADE (NO ACTION) must be cleared explicitly.
  await db.delete(importInvoiceLineSeeds).where(inArray(importInvoiceLineSeeds.companyId, ids));
  await db.delete(qboEntityMappings).where(inArray(qboEntityMappings.companyId, ids));
  await db.delete(dataExportSessions).where(inArray(dataExportSessions.companyId, ids));
  await db.delete(companies).where(inArray(companies.id, ids));
}

export async function runGoldenImportBundleE2e(
  companyId: string,
  sourceSystem: GoldenImportE2eSourceSystem
): Promise<GoldenImportE2eRunResult> {
  const manifest = getGoldenImportBundleManifest(sourceSystem);
  const importSessionId = randomUUID();
  await db.insert(importSessions).values({
    id: importSessionId,
    companyId,
    importBundleId: null,
    entityType: "customers",
    status: "importing",
    fileName: `golden-e2e-${sourceSystem}.bundle`,
    fileUrl: `https://golden-e2e.invalid/${sourceSystem}`
  });

  const orderedFiles = [...manifest.files].sort(
    (left, right) =>
      (ENTITY_COMMIT_RANK[left.entityType] ?? 99) - (ENTITY_COMMIT_RANK[right.entityType] ?? 99)
  );

  for (const file of orderedFiles) {
    await commitGoldenFile(companyId, importSessionId, manifest, file);
  }

  return { companyId, importSessionId, importBundleId: importSessionId, sourceSystem };
}

export async function countLineageRows(
  companyId: string,
  sourceSystem: string,
  table: "customers" | "properties" | "jobs" | "invoices" | "payments" | "product_catalog" | "assets"
): Promise<number> {
  const tableMap = {
    customers,
    properties,
    jobs,
    invoices,
    payments,
    product_catalog: productCatalog,
    assets
  } as const;

  const target = tableMap[table];
  const rows = await db
    .select({ id: target.id })
    .from(target)
    .where(
      and(
        eq(target.companyId, companyId),
        eq(target.sourceSystem, sourceSystem),
        isNull(target.deletedAt)
      )
    );

  return rows.length;
}

export async function findLineageRowId(
  companyId: string,
  sourceSystem: string,
  table: "customers" | "properties" | "jobs" | "invoices" | "payments" | "product_catalog" | "assets",
  sourceId: string
): Promise<string | null> {
  const tableMap = {
    customers,
    properties,
    jobs,
    invoices,
    payments,
    product_catalog: productCatalog,
    assets
  } as const;

  const target = tableMap[table];
  const rows = await db
    .select({ id: target.id })
    .from(target)
    .where(
      and(
        eq(target.companyId, companyId),
        eq(target.sourceSystem, sourceSystem),
        eq(target.sourceId, sourceId),
        isNull(target.deletedAt)
      )
    )
    .limit(1);

  return rows[0]?.id ?? null;
}
