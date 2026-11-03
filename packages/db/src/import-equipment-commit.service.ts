import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import type {
  ImportEquipmentCommitContext,
  ImportEquipmentCommitResult,
  ImportEquipmentCommitRow,
  ImportEquipmentCommitRowError,
} from "@fsm/types";

import { db } from "./client.js";
import { emitEventWithExecutor } from "./events.js";
import {
  normalizeImportedAssetType,
  normalizeImportedIsoDate,
  pickLastServiceDate,
} from "./import-equipment-commit.logic.js";
import { assets, customers, jobs, properties } from "./schema.js";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

export interface ImportEquipmentEntityResolver {
  resolveCustomerId(params: {
    customerId?: string;
    customerSourceId?: string;
  }): Promise<string | null>;
  resolvePropertyId(params: {
    customerId: string;
    propertyId?: string;
    propertySourceId?: string;
  }): Promise<string | null>;
  resolveJobCompletedAt?(params: { jobSourceId: string }): Promise<Date | null>;
}

function pushRowError(
  errors: ImportEquipmentCommitRowError[],
  rowNumber: number,
  field: string,
  message: string,
): void {
  errors.push({ rowNumber, field, message });
}

async function findAssetByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.companyId, companyId),
        eq(assets.sourceSystem, sourceSystem),
        eq(assets.sourceId, sourceId),
        isNull(assets.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function commitImportedEquipmentRows(
  ctx: ImportEquipmentCommitContext,
  rows: ImportEquipmentCommitRow[],
  resolver: ImportEquipmentEntityResolver,
  executor: DbExecutor = db,
): Promise<ImportEquipmentCommitResult> {
  const errors: ImportEquipmentCommitRowError[] = [];
  let assetsCommitted = 0;
  const now = new Date();

  for (const row of rows) {
    const assetType = normalizeImportedAssetType(row.assetType);
    if (!assetType) {
      pushRowError(errors, row.rowNumber, "assetType", "Asset type is required");
      continue;
    }

    const customerId = await resolver.resolveCustomerId({
      ...(row.customerId !== undefined ? { customerId: row.customerId } : {}),
      ...(row.customerSourceId !== undefined ? { customerSourceId: row.customerSourceId } : {}),
    });

    if (!customerId) {
      pushRowError(errors, row.rowNumber, "customerSourceId", "Customer could not be resolved");
      continue;
    }

    const propertyId = await resolver.resolvePropertyId({
      customerId,
      ...(row.propertyId !== undefined ? { propertyId: row.propertyId } : {}),
      ...(row.propertySourceId !== undefined ? { propertySourceId: row.propertySourceId } : {}),
    });

    if (!propertyId) {
      pushRowError(errors, row.rowNumber, "propertySourceId", "Property could not be resolved");
      continue;
    }

    let jobCompletedAt: Date | null = null;
    if (row.lastServiceJobSourceId) {
      if (!resolver.resolveJobCompletedAt) {
        pushRowError(
          errors,
          row.rowNumber,
          "lastServiceJobSourceId",
          "Job resolver is not configured",
        );
        continue;
      }

      jobCompletedAt = await resolver.resolveJobCompletedAt({
        jobSourceId: row.lastServiceJobSourceId,
      });

      if (!jobCompletedAt) {
        pushRowError(
          errors,
          row.rowNumber,
          "lastServiceJobSourceId",
          "Service history job could not be resolved",
        );
        continue;
      }
    }

    const installDate = normalizeImportedIsoDate(row.installDate ?? null);
    const warrantyExpiration = normalizeImportedIsoDate(row.warrantyExpiration ?? null);
    const lastServiceDate = pickLastServiceDate(
      normalizeImportedIsoDate(row.lastServiceDate ?? null),
      jobCompletedAt,
    );

    const existing = await findAssetByLineage(executor, ctx.companyId, ctx.sourceSystem, row.sourceId);

    const assetValues = {
      companyId: ctx.companyId,
      propertyId,
      customerId,
      name: row.name.trim(),
      assetType,
      brand: row.brand ?? null,
      model: row.model ?? null,
      serialNumber: row.serialNumber ?? null,
      installDate,
      warrantyExpiration,
      lastServiceDate,
      condition: row.condition ?? null,
      notes: row.notes ?? null,
      isActive: row.isActive ?? true,
      sourceSystem: ctx.sourceSystem,
      sourceId: row.sourceId,
      importSessionId: ctx.importSessionId,
      updatedAt: now,
    };

    if (existing) {
      await executor
        .update(assets)
        .set(assetValues)
        .where(and(eq(assets.companyId, ctx.companyId), eq(assets.id, existing.id)));

      if (lastServiceDate) {
        await emitEventWithExecutor(executor, {
          companyId: ctx.companyId,
          actorId: ctx.actorId,
          actorType: ctx.actorId ? "user" : "system",
          eventType: "asset.serviced",
          entityType: "asset",
          entityId: existing.id,
          customerId,
          summary: `Imported service history for ${row.name}`,
          occurredAt: new Date(`${lastServiceDate}T12:00:00.000Z`),
          payload: {
            importSessionId: ctx.importSessionId,
            sourceSystem: ctx.sourceSystem,
            sourceId: row.sourceId,
            lastServiceDate,
            lastServiceJobSourceId: row.lastServiceJobSourceId ?? null,
          },
        });
      }

      assetsCommitted += 1;
      continue;
    }

    const assetId = randomUUID();
    await executor.insert(assets).values({
      id: assetId,
      ...assetValues,
      createdAt: now,
    });

    await emitEventWithExecutor(executor, {
      companyId: ctx.companyId,
      actorId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "system",
      eventType: "asset.created",
      entityType: "asset",
      entityId: assetId,
      customerId,
      summary: `Imported equipment ${row.name}`,
      payload: {
        importSessionId: ctx.importSessionId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        assetType,
        installDate,
        lastServiceDate,
      },
    });

    if (lastServiceDate) {
      await emitEventWithExecutor(executor, {
        companyId: ctx.companyId,
        actorId: ctx.actorId,
        actorType: ctx.actorId ? "user" : "system",
        eventType: "asset.serviced",
        entityType: "asset",
        entityId: assetId,
        customerId,
        summary: `Imported service history for ${row.name}`,
        occurredAt: new Date(`${lastServiceDate}T12:00:00.000Z`),
        payload: {
          importSessionId: ctx.importSessionId,
          sourceSystem: ctx.sourceSystem,
          sourceId: row.sourceId,
          lastServiceDate,
          lastServiceJobSourceId: row.lastServiceJobSourceId ?? null,
        },
      });
    }

    assetsCommitted += 1;
  }

  return {
    assetsCommitted,
    rowsFailed: errors.length,
    errors,
  };
}

type EquipmentLineageMaps = {
  customers?: Record<string, string> | undefined;
  properties?: Record<string, string> | undefined;
  jobs?: Record<string, { id: string; completedAt?: string | null | undefined }> | undefined;
};

export async function buildLineageEquipmentResolver(
  companyId: string,
  sourceSystem: string,
  lineageMaps: EquipmentLineageMaps = {},
  executor: DbExecutor = db,
): Promise<ImportEquipmentEntityResolver> {
  const customerMap = lineageMaps.customers ?? {};
  const propertyMap = lineageMaps.properties ?? {};
  const jobMap = lineageMaps.jobs ?? {};

  return {
    async resolveCustomerId({ customerId, customerSourceId }) {
      if (customerId) {
        return customerId;
      }

      if (customerSourceId && customerMap[customerSourceId]) {
        return customerMap[customerSourceId];
      }

      if (!customerSourceId) {
        return null;
      }

      const rows = await executor
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
    },

    async resolvePropertyId({ customerId, propertyId, propertySourceId }) {
      if (propertyId) {
        return propertyId;
      }

      if (propertySourceId && propertyMap[propertySourceId]) {
        return propertyMap[propertySourceId];
      }

      if (propertySourceId) {
        const rows = await executor
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              eq(properties.companyId, companyId),
              eq(properties.customerId, customerId),
              eq(properties.sourceSystem, sourceSystem),
              eq(properties.sourceId, propertySourceId),
              isNull(properties.deletedAt),
            ),
          )
          .limit(1);

        if (rows[0]) {
          return rows[0].id;
        }
      }

      const fallback = await executor
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.companyId, companyId),
            eq(properties.customerId, customerId),
            isNull(properties.deletedAt),
          ),
        )
        .limit(2);

      const onlyProperty = fallback[0];
      if (fallback.length === 1 && onlyProperty) {
        return onlyProperty.id;
      }

      return null;
    },

    async resolveJobCompletedAt({ jobSourceId }) {
      const mapped = jobMap[jobSourceId];
      if (mapped?.completedAt) {
        const parsed = new Date(mapped.completedAt);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      const rows = await executor
        .select({ actualEnd: jobs.actualEnd })
        .from(jobs)
        .where(
          and(
            eq(jobs.companyId, companyId),
            eq(jobs.sourceSystem, sourceSystem),
            eq(jobs.sourceId, jobSourceId),
            isNull(jobs.deletedAt),
          ),
        )
        .limit(1);

      return rows[0]?.actualEnd ?? null;
    },
  };
}
