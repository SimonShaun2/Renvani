/**
 * FS-170 — inventory: stock locations (warehouse / van), per-location stock levels,
 * append-only stock movements (adjustment, transfer, job usage) and low-stock list.
 *
 * Every query is scoped by companyId. Levels are read FOR UPDATE inside the write
 * transaction so concurrent adjustments serialize on the row. Stock never goes
 * below zero unless an owner/admin sends allowNegative (recorded on the movement).
 */
import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db, jobs, productCatalog, stockLevels, stockLocations, stockMovements, technicians } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  buildRecordVersionV1,
  type CreateStockLocationBody,
  type JobStockUsageBody,
  type ListStockLevelsQuery,
  type ListStockLocationsQuery,
  type ListStockMovementsQuery,
  type StockAdjustmentBody,
  type StockLevel,
  type StockLocation,
  type StockMovement,
  type StockMovementKind,
  type StockMutationResponse,
  type StockTransferBody,
  type UpdateStockLevelBody,
  type UpdateStockLocationBody,
  type UserRole
} from "@fsm/types";

type LocationRow = typeof stockLocations.$inferSelect;
type LevelRow = typeof stockLevels.$inferSelect;
type MovementRow = typeof stockMovements.$inferSelect;
type Tx = Pick<typeof db, "select" | "insert" | "update">;

export interface InventoryActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

const NEGATIVE_OVERRIDE_ROLES: readonly UserRole[] = ["owner", "admin"];

export class InventoryConflictError extends Error {
  constructor(
    public readonly reason: "stale_record_version" | "insufficient_stock",
    message: string,
    public readonly current: StockLocation | StockLevel | null
  ) {
    super(message);
  }
}

export function toStockLocation(row: LocationRow): StockLocation {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    technicianId: row.technicianId ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: buildRecordVersionV1("stock_location", row.id, row.updatedAt)
  };
}

export function isLowStock(quantity: number, threshold: number | null | undefined): boolean {
  return threshold !== null && threshold !== undefined && quantity <= threshold;
}

export function toStockLevel(row: LevelRow): StockLevel {
  return {
    id: row.id,
    locationId: row.locationId,
    productId: row.productId,
    quantity: row.quantity,
    lowStockThreshold: row.lowStockThreshold ?? null,
    isLowStock: isLowStock(row.quantity, row.lowStockThreshold),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: buildRecordVersionV1("stock_level", row.id, row.updatedAt)
  };
}

export function toStockMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    locationId: row.locationId,
    productId: row.productId,
    kind: row.kind,
    quantityDelta: row.quantityDelta,
    quantityAfter: row.quantityAfter,
    reason: row.reason ?? null,
    jobId: row.jobId ?? null,
    transferGroupId: row.transferGroupId ?? null,
    allowNegative: row.allowNegative,
    actorUserId: row.actorUserId ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

// ── Locations ──────────────────────────────────────────────

async function findLocation(executor: Tx, companyId: string, id: string): Promise<LocationRow> {
  const [row] = await executor
    .select()
    .from(stockLocations)
    .where(and(eq(stockLocations.companyId, companyId), eq(stockLocations.id, id), isNull(stockLocations.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Stock location not found");
  return row;
}

async function assertTechnicianInCompany(executor: Tx, companyId: string, technicianId: string) {
  const [row] = await executor
    .select({ id: technicians.id })
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(ErrorCode.VALIDATION_ERROR, "technicianId not found");
}

export async function listStockLocations(actor: InventoryActor, query: ListStockLocationsQuery): Promise<StockLocation[]> {
  const rows = await db
    .select()
    .from(stockLocations)
    .where(and(
      eq(stockLocations.companyId, actor.companyId),
      isNull(stockLocations.deletedAt),
      query.kind ? eq(stockLocations.kind, query.kind) : undefined
    ));
  return rows
    .filter((r) => (query.includeInactive === "true" ? true : r.isActive))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(toStockLocation);
}

export async function createStockLocation(actor: InventoryActor, input: CreateStockLocationBody): Promise<StockLocation> {
  if (input.technicianId && input.kind !== "van") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "technicianId is only allowed for kind \"van\"");
  }
  if (input.technicianId) await assertTechnicianInCompany(db, actor.companyId, input.technicianId);
  const [row] = await db
    .insert(stockLocations)
    .values({
      companyId: actor.companyId,
      name: input.name,
      kind: input.kind,
      technicianId: input.technicianId ?? null
    })
    .returning();
  return toStockLocation(row!);
}

export async function updateStockLocation(
  actor: InventoryActor,
  id: string,
  input: UpdateStockLocationBody
): Promise<StockLocation> {
  return db.transaction(async (tx) => {
    const row = await findLocation(tx, actor.companyId, id);
    if (input.recordVersion !== undefined && input.recordVersion !== buildRecordVersionV1("stock_location", row.id, row.updatedAt)) {
      throw new InventoryConflictError("stale_record_version", "recordVersion is stale; refetch and retry", toStockLocation(row));
    }
    if (input.technicianId) {
      if (row.kind !== "van") throw new AppError(ErrorCode.VALIDATION_ERROR, "technicianId is only allowed for kind \"van\"");
      await assertTechnicianInCompany(tx, actor.companyId, input.technicianId);
    }
    const patch: Partial<LocationRow> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.technicianId !== undefined) patch.technicianId = input.technicianId;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    const [updated] = await tx
      .update(stockLocations)
      .set(patch)
      .where(and(eq(stockLocations.companyId, actor.companyId), eq(stockLocations.id, id)))
      .returning();
    return toStockLocation(updated!);
  });
}

// ── Levels ─────────────────────────────────────────────────

export async function listStockLevels(actor: InventoryActor, query: ListStockLevelsQuery): Promise<StockLevel[]> {
  const rows = await db
    .select()
    .from(stockLevels)
    .where(and(
      eq(stockLevels.companyId, actor.companyId),
      isNull(stockLevels.deletedAt),
      query.locationId ? eq(stockLevels.locationId, query.locationId) : undefined,
      query.productId ? eq(stockLevels.productId, query.productId) : undefined
    ));
  return rows
    .filter((r) => (query.lowStock === "true" ? isLowStock(r.quantity, r.lowStockThreshold) : true))
    .map(toStockLevel);
}

export async function updateStockLevel(actor: InventoryActor, id: string, input: UpdateStockLevelBody): Promise<StockLevel> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(stockLevels)
      .where(and(eq(stockLevels.companyId, actor.companyId), eq(stockLevels.id, id), isNull(stockLevels.deletedAt)))
      .for("update")
      .limit(1);
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Stock level not found");
    assertLevelVersion(row, input.recordVersion);
    const [updated] = await tx
      .update(stockLevels)
      .set({ lowStockThreshold: input.lowStockThreshold, updatedAt: new Date() })
      .where(and(eq(stockLevels.companyId, actor.companyId), eq(stockLevels.id, id)))
      .returning();
    return toStockLevel(updated!);
  });
}

function assertLevelVersion(row: LevelRow | null, recordVersion: string | undefined) {
  if (recordVersion === undefined) return;
  if (!row || recordVersion !== buildRecordVersionV1("stock_level", row.id, row.updatedAt)) {
    throw new InventoryConflictError(
      "stale_record_version",
      "recordVersion is stale; refetch and retry",
      row ? toStockLevel(row) : null
    );
  }
}

async function assertProductInCompany(executor: Tx, companyId: string, productId: string) {
  const [row] = await executor
    .select({ id: productCatalog.id })
    .from(productCatalog)
    .where(and(eq(productCatalog.companyId, companyId), eq(productCatalog.id, productId), isNull(productCatalog.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
}

async function lockLevel(tx: Tx, companyId: string, locationId: string, productId: string): Promise<LevelRow | null> {
  const [row] = await tx
    .select()
    .from(stockLevels)
    .where(and(
      eq(stockLevels.companyId, companyId),
      eq(stockLevels.locationId, locationId),
      eq(stockLevels.productId, productId),
      isNull(stockLevels.deletedAt)
    ))
    .for("update")
    .limit(1);
  return row ?? null;
}

interface ApplyDelta {
  actor: InventoryActor;
  locationId: string;
  productId: string;
  delta: number;
  kind: StockMovementKind;
  reason: string | null;
  jobId?: string | null | undefined;
  transferGroupId?: string | null | undefined;
  allowNegative?: boolean | undefined;
  recordVersion?: string | undefined;
}

/** Applies one signed delta to a (location, product) level and appends its movement. */
async function applyDelta(tx: Tx, input: ApplyDelta): Promise<{ level: LevelRow; movement: MovementRow }> {
  const { actor } = input;
  let level = await lockLevel(tx, actor.companyId, input.locationId, input.productId);
  assertLevelVersion(level, input.recordVersion);
  const before = level?.quantity ?? 0;
  const after = before + input.delta;
  const allowNegative = input.allowNegative === true;
  if (allowNegative && !NEGATIVE_OVERRIDE_ROLES.includes(actor.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Only owner or admin may allow negative stock");
  }
  if (after < 0 && !allowNegative) {
    throw new InventoryConflictError(
      "insufficient_stock",
      `Insufficient stock: ${before} on hand, ${-input.delta} requested`,
      level ? toStockLevel(level) : null
    );
  }
  const now = new Date();
  if (level) {
    const [updated] = await tx
      .update(stockLevels)
      .set({ quantity: after, updatedAt: now })
      .where(and(eq(stockLevels.companyId, actor.companyId), eq(stockLevels.id, level.id)))
      .returning();
    level = updated!;
  } else {
    const [created] = await tx
      .insert(stockLevels)
      .values({ companyId: actor.companyId, locationId: input.locationId, productId: input.productId, quantity: after })
      .returning();
    level = created!;
  }
  const [movement] = await tx
    .insert(stockMovements)
    .values({
      companyId: actor.companyId,
      locationId: input.locationId,
      productId: input.productId,
      kind: input.kind,
      quantityDelta: input.delta,
      quantityAfter: after,
      reason: input.reason,
      jobId: input.jobId ?? null,
      transferGroupId: input.transferGroupId ?? null,
      allowNegative: allowNegative && after < 0,
      actorUserId: actor.userId
    })
    .returning();
  return { level, movement: movement! };
}

async function assertActiveLocation(tx: Tx, companyId: string, id: string): Promise<LocationRow> {
  const loc = await findLocation(tx, companyId, id);
  if (!loc.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, "Stock location is inactive");
  return loc;
}

export async function adjustStock(actor: InventoryActor, input: StockAdjustmentBody): Promise<StockMutationResponse> {
  return db.transaction(async (tx) => {
    await assertActiveLocation(tx, actor.companyId, input.locationId);
    await assertProductInCompany(tx, actor.companyId, input.productId);
    const { level, movement } = await applyDelta(tx, {
      actor,
      locationId: input.locationId,
      productId: input.productId,
      delta: input.quantityDelta,
      kind: "adjustment",
      reason: input.reason,
      allowNegative: input.allowNegative,
      recordVersion: input.recordVersion
    });
    return { levels: [toStockLevel(level)], movements: [toStockMovement(movement)] };
  });
}

export async function transferStock(actor: InventoryActor, input: StockTransferBody): Promise<StockMutationResponse> {
  return db.transaction(async (tx) => {
    await assertActiveLocation(tx, actor.companyId, input.fromLocationId);
    await assertActiveLocation(tx, actor.companyId, input.toLocationId);
    await assertProductInCompany(tx, actor.companyId, input.productId);
    const transferGroupId = randomUUID();
    const reason = input.reason ?? null;
    // Lock in a stable order (by location id) to avoid deadlocks between opposite transfers.
    const ordered = [input.fromLocationId, input.toLocationId].sort();
    for (const locationId of ordered) await lockLevel(tx, actor.companyId, locationId, input.productId);
    const out = await applyDelta(tx, {
      actor,
      locationId: input.fromLocationId,
      productId: input.productId,
      delta: -input.quantity,
      kind: "transfer_out",
      reason,
      transferGroupId,
      recordVersion: input.recordVersion
    });
    const into = await applyDelta(tx, {
      actor,
      locationId: input.toLocationId,
      productId: input.productId,
      delta: input.quantity,
      kind: "transfer_in",
      reason,
      transferGroupId
    });
    return {
      levels: [toStockLevel(out.level), toStockLevel(into.level)],
      movements: [toStockMovement(out.movement), toStockMovement(into.movement)]
    };
  });
}

export async function recordJobUsage(actor: InventoryActor, input: JobStockUsageBody): Promise<StockMutationResponse> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobs.id, technicianId: jobs.technicianId })
      .from(jobs)
      .where(and(eq(jobs.companyId, actor.companyId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt)))
      .limit(1);
    if (!job) throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    if (actor.role === "technician") {
      const [tech] = await tx
        .select({ id: technicians.id })
        .from(technicians)
        .where(and(eq(technicians.companyId, actor.companyId), eq(technicians.userId, actor.userId), isNull(technicians.deletedAt)))
        .limit(1);
      // Same convention as FS-169: technicians only act on jobs assigned to them; hide others as 404.
      if (!tech || job.technicianId !== tech.id) throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }
    await assertActiveLocation(tx, actor.companyId, input.locationId);
    await assertProductInCompany(tx, actor.companyId, input.productId);
    const { level, movement } = await applyDelta(tx, {
      actor,
      locationId: input.locationId,
      productId: input.productId,
      delta: -input.quantity,
      kind: "job_usage",
      reason: input.note ?? null,
      jobId: job.id,
      recordVersion: input.recordVersion
    });
    return { levels: [toStockLevel(level)], movements: [toStockMovement(movement)] };
  });
}

export async function listStockMovements(actor: InventoryActor, query: ListStockMovementsQuery): Promise<StockMovement[]> {
  const rows = await db
    .select()
    .from(stockMovements)
    .where(and(
      eq(stockMovements.companyId, actor.companyId),
      query.locationId ? eq(stockMovements.locationId, query.locationId) : undefined,
      query.productId ? eq(stockMovements.productId, query.productId) : undefined,
      query.jobId ? eq(stockMovements.jobId, query.jobId) : undefined
    ))
    .orderBy(desc(stockMovements.createdAt))
    .limit(query.limit ?? 100);
  return rows.map(toStockMovement);
}
