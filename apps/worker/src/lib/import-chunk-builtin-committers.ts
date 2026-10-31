import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  buildLineageEquipmentResolver,
  commitImportedEquipmentRows,
  commitImportedEstimateRows,
  commitImportedInvoiceRows,
  commitImportedJobRows,
  createDbHistoryChunkResolver,
  customers,
  invoices,
  jobs,
  properties,
  runTransactionWithTenantSession,
} from "@fsm/db";
import {
  ImportEstimateCommitRowSchema,
  ImportJobCommitRowSchema,
  sanitizeSpreadsheetCell,
  type ColumnMapping,
} from "@fsm/types";

import { mapEquipmentRow } from "../processors/import-equipment-chunk.processor.js";
import { mapInvoiceCommitRow } from "../processors/import-invoice-balance-chunk.processor.js";
import {
  hasImportChunkCommitter,
  registerImportChunkCommitter,
  type ImportChunkCommitInput,
  type ImportChunkCommitResult,
  type ImportChunkCommitter,
} from "./import-chunk-committer.registry.js";
import {
  buildCustomerLookupMaps,
  buildCustomerUpdateValues,
  findDuplicateCustomer,
  mapCustomerRow,
  normalizeDuplicateActions,
  normalizeValidationErrorRowNumbers,
} from "./import-customer-rows.js";

type TenantTx = Parameters<Parameters<typeof runTransactionWithTenantSession>[1]>[0];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function normalizeImportTextValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = sanitizeSpreadsheetCell(value.trim());
  return trimmed.length > 0 ? trimmed : null;
}

export function mapImportRowValues(
  values: Record<string, string>,
  columnMapping: ColumnMapping,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
      continue;
    }
    mapped[fieldName] = values[csvColumn] ?? "";
  }
  return mapped;
}

/** Lineage tables a resolver may hand back ids for; every id is re-checked against the company. */
const SCOPED_LOOKUP_TABLES = {
  resolveCustomerId: customers,
  resolveJobId: jobs,
  resolvePropertyId: properties,
  resolveInvoiceId: invoices,
} as const;

async function idBelongsToCompany(
  tx: TenantTx,
  table: (typeof SCOPED_LOOKUP_TABLES)[keyof typeof SCOPED_LOOKUP_TABLES],
  companyId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(id)) {
    return false;
  }
  const scopedTable = table as typeof customers;
  const rows = await tx
    .select({ id: scopedTable.id })
    .from(scopedTable)
    .where(and(eq(scopedTable.companyId, companyId), eq(scopedTable.id, id), isNull(scopedTable.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Wraps a lineage resolver so any id it returns (including a raw id taken from the file)
 * must belong to the importing company; foreign ids resolve to null and the row fails.
 */
export function scopeImportResolver<R extends object>(resolver: R, tx: TenantTx, companyId: string): R {
  const scoped: Record<string, unknown> = { ...(resolver as Record<string, unknown>) };
  for (const [method, table] of Object.entries(SCOPED_LOOKUP_TABLES)) {
    const original = (resolver as Record<string, unknown>)[method];
    if (typeof original !== "function") {
      continue;
    }
    scoped[method] = async (params: unknown) => {
      const id = (await (original as (p: unknown) => Promise<string | null>).call(resolver, params)) ?? null;
      if (!id) {
        return null;
      }
      return (await idBelongsToCompany(tx, table, companyId, id)) ? id : null;
    };
  }
  return scoped as R;
}

function commitContext(input: ImportChunkCommitInput) {
  return {
    companyId: input.payload.companyId,
    importSessionId: input.payload.importSessionId,
    sourceSystem: input.payload.sourceSystem,
  };
}

// --- customers ---------------------------------------------------------------------------

type CustomerRecord = typeof customers.$inferSelect;

function readDuplicateActions(importSession: ImportChunkCommitInput["importSession"]) {
  const aiInferences = importSession.aiInferences;
  return normalizeDuplicateActions(
    aiInferences && typeof aiInferences === "object" && !Array.isArray(aiInferences)
      ? (aiInferences as Record<string, unknown>).duplicateActions
      : undefined,
  );
}

/** Primary property from the customer row's address columns; idempotent per customer source id. */
async function upsertCustomerPrimaryProperty(
  tx: TenantTx,
  ctx: { companyId: string; importSessionId: string; sourceSystem: string },
  customerId: string,
  customerSourceId: string,
  row: ReturnType<typeof mapCustomerRow>,
): Promise<void> {
  if (!row.addressLine1 || !row.city || !row.state || !row.zip) {
    return;
  }
  const sourceId = `customer:${customerSourceId}`.slice(0, 256);
  const values = {
    customerId,
    addressLine1: row.addressLine1.slice(0, 255),
    city: row.city.slice(0, 100),
    state: row.state.slice(0, 50),
    zip: row.zip.slice(0, 20),
    sourceSystem: ctx.sourceSystem,
    sourceId,
    importSessionId: ctx.importSessionId,
    updatedAt: new Date(),
  };
  const existing =
    (
      await tx
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.companyId, ctx.companyId),
            eq(properties.sourceSystem, ctx.sourceSystem),
            eq(properties.sourceId, sourceId),
            isNull(properties.deletedAt),
          ),
        )
        .limit(1)
    )[0] ?? null;
  if (existing) {
    await tx
      .update(properties)
      .set(values)
      .where(and(eq(properties.companyId, ctx.companyId), eq(properties.id, existing.id), isNull(properties.deletedAt)))
      .returning();
    return;
  }
  const hasPrimary =
    (
      await tx
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.companyId, ctx.companyId),
            eq(properties.customerId, customerId),
            eq(properties.isPrimary, true),
            isNull(properties.deletedAt),
          ),
        )
        .limit(1)
    ).length > 0;
  await tx
    .insert(properties)
    .values({ id: randomUUID(), companyId: ctx.companyId, type: "residential", isPrimary: !hasPrimary, ...values })
    .returning();
}

/**
 * Lineage-keyed customer upsert. Order per row: skip rows that failed validation; reuse the
 * row already imported from this source (companyId + sourceSystem + sourceId, so re-runs are
 * idempotent); otherwise apply the same email/phone/name duplicate check and per-row
 * duplicate choice ("skip" default, "update_existing", "import_new") as execute-import.
 */
export const commitCustomerChunk: ImportChunkCommitter = async (input) => {
  const ctx = commitContext(input);
  const { companyId, importSessionId, sourceSystem } = ctx;
  const invalidRows = normalizeValidationErrorRowNumbers(input.importSession.validationErrors);
  const duplicateActions = readDuplicateActions(input.importSession);

  return runTransactionWithTenantSession(companyId, async (tx) => {
    const companyCustomers: CustomerRecord[] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)));
    const lookups = buildCustomerLookupMaps(companyCustomers);
    let rowsOk = 0;
    let rowsFailed = 0;
    let rowsSkipped = 0;

    for (const row of input.rows) {
      if (invalidRows.has(row.rowNumber)) {
        // Already counted in the session's errorRows by validation; not written.
        rowsSkipped += 1;
        continue;
      }
      const mappedRow = mapCustomerRow(row.values, input.columnMapping);
      const sourceId = normalizeImportTextValue(mapImportRowValues(row.values, input.columnMapping).sourceId);
      if (!sourceId || (mappedRow.firstName.length === 0 && mappedRow.lastName.length === 0 && !mappedRow.displayName)) {
        rowsFailed += 1;
        continue;
      }
      const lineageValues = { sourceSystem, sourceId: sourceId.slice(0, 256), importSessionId };
      const now = new Date();

      const lineageMatch = companyCustomers.find(
        (customer) => customer.sourceSystem === sourceSystem && customer.sourceId === lineageValues.sourceId,
      );
      let customerId: string;

      if (lineageMatch) {
        await tx
          .update(customers)
          .set({
            firstName: mappedRow.firstName,
            lastName: mappedRow.lastName,
            displayName: mappedRow.displayName,
            email: mappedRow.email,
            phone: mappedRow.phone,
            altPhone: mappedRow.altPhone,
            internalNotes: mappedRow.notes,
            tags: mappedRow.tags,
            ...lineageValues,
            updatedAt: now,
          })
          .where(and(eq(customers.companyId, companyId), eq(customers.id, lineageMatch.id), isNull(customers.deletedAt)))
          .returning();
        customerId = lineageMatch.id;
      } else {
        const duplicate = findDuplicateCustomer(mappedRow, lookups);
        const action = duplicate ? (duplicateActions[String(row.rowNumber)] ?? "skip") : "import_new";

        if (duplicate && action === "skip") {
          rowsSkipped += 1;
          continue;
        }

        if (duplicate && action === "update_existing") {
          const existing = duplicate.customer;
          await tx
            .update(customers)
            .set({
              ...buildCustomerUpdateValues(existing, mappedRow, importSessionId, now),
              // Adopt this source id only if the matched customer has no lineage yet.
              ...(existing.sourceId ? {} : lineageValues),
            })
            .where(and(eq(customers.companyId, companyId), eq(customers.id, existing.id), isNull(customers.deletedAt)))
            .returning();
          if (!existing.sourceId) {
            existing.sourceSystem = sourceSystem;
            existing.sourceId = lineageValues.sourceId;
          }
          customerId = existing.id;
        } else {
          customerId = randomUUID();
          const inserted = (
            await tx
              .insert(customers)
              .values({
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
                ...lineageValues,
                updatedAt: now,
              })
              .returning()
          )[0] as CustomerRecord | undefined;
          if (inserted) {
            companyCustomers.push(inserted);
          }
        }
      }

      await upsertCustomerPrimaryProperty(tx, ctx, customerId, lineageValues.sourceId, mappedRow);
      rowsOk += 1;
    }

    return { rowsOk, rowsFailed, rowsSkipped };
  });
};

// --- properties (no db commit service existed; lean lineage upsert) ------------------------

/** Values accepted by the legacy properties.type column; anything else falls back to residential. */
const PROPERTY_TYPE_VALUES = new Set(["residential", "commercial", "industrial", "multi_family"]);

function normalizePropertyType(value: string | null): string {
  const normalized = value?.toLowerCase().replace(/[\s-]+/gu, "_") ?? "";
  return PROPERTY_TYPE_VALUES.has(normalized) ? normalized : "residential";
}

function parseOptionalInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value.replace(/[,\s]/gu, ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseImportBoolean(value: string | null, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function mapPropertyRow(values: Record<string, string>, columnMapping: ColumnMapping) {
  const mapped = mapImportRowValues(values, columnMapping);
  const text = (key: string) => normalizeImportTextValue(mapped[key]);

  return {
    sourceId: text("sourceId") ?? text("propertySourceId") ?? text("locationSourceId"),
    customerId: text("customerId"),
    customerSourceId: text("customerSourceId"),
    addressLine1: text("addressLine1") ?? text("address") ?? text("street"),
    addressLine2: text("addressLine2"),
    city: text("city"),
    state: text("state"),
    zip: text("zip") ?? text("postalCode"),
    country: text("country"),
    type: normalizePropertyType(text("type") ?? text("propertyType")),
    sqft: parseOptionalInt(text("sqft")),
    yearBuilt: parseOptionalInt(text("yearBuilt")),
    accessNotes: text("accessNotes"),
    notes: text("notes"),
    isPrimary: parseImportBoolean(text("isPrimary"), false),
    isActive: parseImportBoolean(text("isActive"), true),
  };
}

export const commitPropertyChunk: ImportChunkCommitter = async (input) => {
  const { companyId, importSessionId, sourceSystem } = commitContext(input);

  return runTransactionWithTenantSession(companyId, async (tx) => {
    const resolver = scopeImportResolver(
      await createDbHistoryChunkResolver(companyId, sourceSystem, tx),
      tx,
      companyId,
    );
    let rowsOk = 0;
    let rowsFailed = 0;

    for (const row of input.rows) {
      const mapped = mapPropertyRow(row.values, input.columnMapping);
      if (!mapped.sourceId || !mapped.addressLine1 || !mapped.city || !mapped.state || !mapped.zip) {
        rowsFailed += 1;
        continue;
      }

      const customerId = await resolver.resolveCustomerId({
        ...(mapped.customerId ? { customerId: mapped.customerId } : {}),
        ...(mapped.customerSourceId ? { customerSourceId: mapped.customerSourceId } : {}),
      });
      if (!customerId) {
        rowsFailed += 1;
        continue;
      }

      const now = new Date();
      const values = {
        customerId,
        addressLine1: mapped.addressLine1.slice(0, 255),
        addressLine2: mapped.addressLine2?.slice(0, 255) ?? null,
        city: mapped.city.slice(0, 100),
        state: mapped.state.slice(0, 50),
        zip: mapped.zip.slice(0, 20),
        country: mapped.country?.slice(0, 50) ?? "US",
        type: mapped.type as (typeof properties.$inferInsert)["type"],
        sqft: mapped.sqft,
        yearBuilt: mapped.yearBuilt,
        accessNotes: mapped.accessNotes,
        notes: mapped.notes,
        isPrimary: mapped.isPrimary,
        isActive: mapped.isActive,
        sourceSystem,
        sourceId: mapped.sourceId.slice(0, 256),
        importSessionId,
        updatedAt: now,
      };

      const existing =
        (
          await tx
            .select({ id: properties.id })
            .from(properties)
            .where(
              and(
                eq(properties.companyId, companyId),
                eq(properties.sourceSystem, sourceSystem),
                eq(properties.sourceId, values.sourceId),
                isNull(properties.deletedAt),
              ),
            )
            .limit(1)
        )[0] ?? null;

      if (existing) {
        await tx
          .update(properties)
          .set(values)
          .where(and(eq(properties.companyId, companyId), eq(properties.id, existing.id), isNull(properties.deletedAt)))
          .returning();
      } else {
        await tx.insert(properties).values({ id: randomUUID(), companyId, ...values }).returning();
      }
      rowsOk += 1;
    }

    return { rowsOk, rowsFailed };
  });
};

// --- jobs / estimates (wrap import-history-chunk-commit.service) ---------------------------

export const commitJobChunk: ImportChunkCommitter = async (input) => {
  const ctx = commitContext(input);
  const parsedJobRows = input.rows.map((row) => {
    const mapped = mapImportRowValues(row.values, input.columnMapping);
    const text = (key: string) => normalizeImportTextValue(mapped[key]) ?? undefined;
    return ImportJobCommitRowSchema.safeParse({
      rowNumber: row.rowNumber,
      sourceId: normalizeImportTextValue(mapped.sourceId) ?? mapped.jobNumber,
      jobNumber: mapped.jobNumber,
      customerId: text("customerId"),
      customerSourceId: text("customerSourceId"),
      propertySourceId: text("propertySourceId"),
      title: normalizeImportTextValue(mapped.title) ?? mapped.jobNumber,
      status: text("status"),
      type: text("type"),
      priority: text("priority"),
      leadSource: text("leadSource"),
      description: text("description"),
      scheduledStart: text("scheduledStart"),
      scheduledEnd: text("scheduledEnd"),
      actualStart: text("actualStart"),
      actualEnd: text("actualEnd"),
      estimateTotal: text("estimateTotal"),
      invoiceTotal: text("invoiceTotal"),
      amountPaid: text("amountPaid"),
    });
  });

  // Row-level schema failures are counted, not thrown (one bad row must not fail the chunk).
  const jobRows = parsedJobRows.flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const invalidRowCount = parsedJobRows.length - jobRows.length;

  return runTransactionWithTenantSession(ctx.companyId, async (tx) => {
    const resolver = scopeImportResolver(
      await createDbHistoryChunkResolver(ctx.companyId, ctx.sourceSystem, tx),
      tx,
      ctx.companyId,
    );
    const result = await commitImportedJobRows(ctx, jobRows, resolver, tx);
    return { rowsOk: result.rowsCommitted, rowsFailed: result.rowsFailed + invalidRowCount };
  });
};

export const commitEstimateChunk: ImportChunkCommitter = async (input) => {
  const ctx = commitContext(input);
  const parsedEstimateRows = input.rows.map((row) => {
    const mapped = mapImportRowValues(row.values, input.columnMapping);
    const text = (key: string) => normalizeImportTextValue(mapped[key]) ?? undefined;
    return ImportEstimateCommitRowSchema.safeParse({
      rowNumber: row.rowNumber,
      sourceId: normalizeImportTextValue(mapped.sourceId) ?? mapped.estimateNumber,
      estimateNumber: mapped.estimateNumber,
      customerId: text("customerId"),
      customerSourceId: text("customerSourceId"),
      jobSourceId: text("jobSourceId"),
      status: text("status"),
      title: text("title"),
      subtotal: text("subtotal"),
      total: mapped.total,
      sentAt: text("sentAt"),
      approvedAt: text("approvedAt"),
      declinedAt: text("declinedAt"),
      expiresAt: text("expiresAt"),
      approvedByName: text("approvedByName"),
    });
  });

  // Row-level schema failures are counted, not thrown (one bad row must not fail the chunk).
  const estimateRows = parsedEstimateRows.flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const invalidRowCount = parsedEstimateRows.length - estimateRows.length;

  return runTransactionWithTenantSession(ctx.companyId, async (tx) => {
    const resolver = scopeImportResolver(
      await createDbHistoryChunkResolver(ctx.companyId, ctx.sourceSystem, tx),
      tx,
      ctx.companyId,
    );
    const result = await commitImportedEstimateRows(ctx, estimateRows, resolver, tx);
    return { rowsOk: result.rowsCommitted, rowsFailed: result.rowsFailed + invalidRowCount };
  });
};

// --- assets (wrap import-equipment-commit.service) ---------------------------------------

export const commitAssetChunk: ImportChunkCommitter = async (input) => {
  const ctx = commitContext(input);
  const equipmentRows = input.rows.map((row) => mapEquipmentRow(row, input.columnMapping));

  return runTransactionWithTenantSession(ctx.companyId, async (tx) => {
    const resolver = scopeImportResolver(
      await buildLineageEquipmentResolver(ctx.companyId, ctx.sourceSystem, {}, tx),
      tx,
      ctx.companyId,
    );
    const result = await commitImportedEquipmentRows(ctx, equipmentRows, resolver, tx);
    return { rowsOk: result.assetsCommitted, rowsFailed: result.rowsFailed };
  });
};

// --- invoices (wrap import-invoice-balance-commit.service) -------------------------------

export const commitInvoiceChunk: ImportChunkCommitter = async (input) => {
  const ctx = commitContext(input);
  const invoiceRows = input.rows.map((row) => mapInvoiceCommitRow(row, input.columnMapping));

  return runTransactionWithTenantSession(ctx.companyId, async (tx) => {
    const resolver = scopeImportResolver(
      await createDbHistoryChunkResolver(ctx.companyId, ctx.sourceSystem, tx),
      tx,
      ctx.companyId,
    );
    const result = await commitImportedInvoiceRows(ctx, invoiceRows, resolver, tx);
    return { rowsOk: result.invoicesCommitted, rowsFailed: result.rowsFailed };
  });
};

export const BUILTIN_IMPORT_CHUNK_COMMITTERS: Readonly<Record<string, ImportChunkCommitter>> = {
  customers: commitCustomerChunk,
  properties: commitPropertyChunk,
  jobs: commitJobChunk,
  estimates: commitEstimateChunk,
  assets: commitAssetChunk,
  invoices: commitInvoiceChunk,
};

/** Registers built-ins without clobbering a committer an add-on registered first. */
export function registerBuiltinImportChunkCommitters(options: { override?: boolean } = {}): void {
  for (const [entityType, committer] of Object.entries(BUILTIN_IMPORT_CHUNK_COMMITTERS)) {
    if (!options.override && hasImportChunkCommitter(entityType)) {
      continue;
    }
    registerImportChunkCommitter(entityType, committer);
  }
}

export type { ImportChunkCommitResult };
