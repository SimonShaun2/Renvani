import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { importSourceSystemFromPreset, type ImportSourceSystemId } from "@fsm/config/import-price-book-map";
import type { ImportVendorPresetId } from "@fsm/config/import-vendor-presets";
import { priceBookImportRowSchema, type ImportInvoiceLineSeed } from "@fsm/types";

import { db } from "./client.js";
import { mapPriceBookRow, type ParsedImportRow } from "./import-price-book-rows.js";
import { importInvoiceLineSeeds, productCatalog } from "./schema.js";

export type { ParsedImportRow, PriceBookValidationResult } from "./import-price-book-rows.js";
export { mapPriceBookRow, validatePriceBookRows } from "./import-price-book-rows.js";

export interface PriceBookCommitResult {
  importedRows: number;
  skippedRows: number;
  lineSeeds: ImportInvoiceLineSeed[];
}

export async function commitPriceBookRows(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  rows: ParsedImportRow[];
  columnMapping: Record<string, string | null>;
  invalidRowNumbers: Set<number>;
}): Promise<PriceBookCommitResult> {
  const lineSeeds: ImportInvoiceLineSeed[] = [];
  let importedRows = 0;
  let skippedRows = 0;
  const now = new Date();

  for (const row of options.rows) {
    if (options.invalidRowNumbers.has(row.rowNumber)) {
      skippedRows += 1;
      continue;
    }

    const mapped = mapPriceBookRow(row.values, options.columnMapping, options.sourceSystem);
    if (!mapped) {
      skippedRows += 1;
      continue;
    }

    const parsed = priceBookImportRowSchema.safeParse(mapped);
    if (!parsed.success) {
      skippedRows += 1;
      continue;
    }

    const productId = randomUUID();
    let catalogId: string = productId;
    let seedId: string = randomUUID();

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: productCatalog.id })
        .from(productCatalog)
        .where(
          and(
            eq(productCatalog.companyId, options.companyId),
            eq(productCatalog.sourceSystem, options.sourceSystem),
            eq(productCatalog.sourceId, parsed.data.sourceId),
            isNull(productCatalog.deletedAt)
          )
        )
        .limit(1);

      catalogId = existing[0]?.id ?? productId;

      if (existing.length === 0) {
        await tx.insert(productCatalog).values({
          id: catalogId,
          companyId: options.companyId,
          name: parsed.data.name,
          description: parsed.data.description,
          category: parsed.data.category,
          sku: parsed.data.sku,
          unitPrice: parsed.data.unitPrice,
          cost: parsed.data.cost,
          unit: parsed.data.unit,
          isTaxable: parsed.data.isTaxable,
          isActive: parsed.data.isActive,
          sourceSystem: options.sourceSystem,
          sourceId: parsed.data.sourceId,
          importSessionId: options.importSessionId,
          createdAt: now,
          updatedAt: now
        });
      } else {
        await tx
          .update(productCatalog)
          .set({
            name: parsed.data.name,
            description: parsed.data.description,
            category: parsed.data.category,
            sku: parsed.data.sku,
            unitPrice: parsed.data.unitPrice,
            cost: parsed.data.cost,
            unit: parsed.data.unit,
            isTaxable: parsed.data.isTaxable,
            isActive: parsed.data.isActive,
            importSessionId: options.importSessionId,
            updatedAt: now
          })
          .where(
            and(eq(productCatalog.companyId, options.companyId), eq(productCatalog.id, catalogId), isNull(productCatalog.deletedAt))
          );
      }

      const existingSeed = await tx
        .select({ id: importInvoiceLineSeeds.id })
        .from(importInvoiceLineSeeds)
        .where(
          and(
            eq(importInvoiceLineSeeds.companyId, options.companyId),
            eq(importInvoiceLineSeeds.sourceSystem, options.sourceSystem),
            eq(importInvoiceLineSeeds.sourceId, parsed.data.sourceId),
            isNull(importInvoiceLineSeeds.deletedAt)
          )
        )
        .limit(1);

      seedId = existingSeed[0]?.id ?? seedId;

      if (existingSeed.length === 0) {
        await tx.insert(importInvoiceLineSeeds).values({
          id: seedId,
          companyId: options.companyId,
          importSessionId: options.importSessionId,
          sourceSystem: options.sourceSystem,
          sourceId: parsed.data.sourceId,
          productCatalogId: catalogId,
          sku: parsed.data.sku,
          name: parsed.data.name,
          createdAt: now,
          updatedAt: now
        });
      } else {
        await tx
          .update(importInvoiceLineSeeds)
          .set({
            productCatalogId: catalogId,
            sku: parsed.data.sku,
            name: parsed.data.name,
            importSessionId: options.importSessionId,
            updatedAt: now
          })
          .where(
            and(eq(importInvoiceLineSeeds.companyId, options.companyId), eq(importInvoiceLineSeeds.id, seedId), isNull(importInvoiceLineSeeds.deletedAt))
          );
      }
    });

    lineSeeds.push({
      id: seedId,
      companyId: options.companyId,
      importSessionId: options.importSessionId,
      sourceSystem: options.sourceSystem,
      sourceId: parsed.data.sourceId,
      productCatalogId: catalogId,
      sku: parsed.data.sku,
      name: parsed.data.name
    });

    importedRows += 1;
  }

  return { importedRows, skippedRows, lineSeeds };
}

export async function resolveInvoiceLineCatalogId(
  companyId: string,
  sourceSystem: ImportSourceSystemId,
  sourceId: string
): Promise<string | null> {
  const seeds = await db
    .select({ productCatalogId: importInvoiceLineSeeds.productCatalogId })
    .from(importInvoiceLineSeeds)
    .where(
      and(
        eq(importInvoiceLineSeeds.companyId, companyId),
        eq(importInvoiceLineSeeds.sourceSystem, sourceSystem),
        eq(importInvoiceLineSeeds.sourceId, sourceId),
        isNull(importInvoiceLineSeeds.deletedAt)
      )
    )
    .limit(1);

  return seeds[0]?.productCatalogId ?? null;
}

export async function softDeletePriceBookImport(companyId: string, importSessionId: string): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(importInvoiceLineSeeds)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(importInvoiceLineSeeds.companyId, companyId),
          eq(importInvoiceLineSeeds.importSessionId, importSessionId),
          isNull(importInvoiceLineSeeds.deletedAt)
        )
      );

    await tx
      .update(productCatalog)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(productCatalog.companyId, companyId),
          eq(productCatalog.importSessionId, importSessionId),
          isNull(productCatalog.deletedAt)
        )
      );
  });
}

export function resolveSourceSystemForPriceBookImport(
  vendorPresetId: ImportVendorPresetId | null
): ImportSourceSystemId {
  if (!vendorPresetId) {
    return "manual_csv";
  }

  return importSourceSystemFromPreset(vendorPresetId);
}
