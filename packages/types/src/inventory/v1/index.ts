/**
 * FS-170 — inventory API contract (v1): stock locations (warehouse / van),
 * stock levels per product per location, append-only stock movements
 * (adjustments, transfers, job usage) and a low-stock list.
 *
 * Quantities are whole units (integers). Money is not stored here; product
 * pricing stays on the product catalog.
 *
 * Versioning: locations and levels carry `recordVersion` (opaque token from
 * {@link buildRecordVersionV1} over `updatedAt`). Writes accept an optional
 * `recordVersion`; stale -> 409 `{ error: "CONFLICT", reason:
 * "stale_record_version", message, current }`. Omit to keep last-write-wins.
 *
 * Stock never goes below zero unless `allowNegative: true` is sent by an
 * owner/admin; otherwise 409 `{ error: "CONFLICT", reason: "insufficient_stock",
 * message, current }` where `current` is the live level.
 */
import { z } from "zod";

export const INVENTORY_CONTRACT_VERSION = "1.0.0" as const;

export const StockLocationKindSchema = z.enum(["warehouse", "van"]);
export type StockLocationKind = z.infer<typeof StockLocationKindSchema>;

export const StockMovementKindSchema = z.enum(["adjustment", "transfer_out", "transfer_in", "job_usage"]);
export type StockMovementKind = z.infer<typeof StockMovementKindSchema>;

const RecordVersionInputSchema = z.string().min(1).max(512);
const Qty = z.number().int();
const PositiveQty = Qty.positive().max(1_000_000);

export const InventoryIdParamsSchema = z.object({ id: z.string().uuid() });

export const CreateStockLocationBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  kind: StockLocationKindSchema,
  /** Van owner; only valid for kind "van". */
  technicianId: z.string().uuid().nullable().optional()
}).strict();
export type CreateStockLocationBody = z.infer<typeof CreateStockLocationBodySchema>;

export const UpdateStockLocationBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  technicianId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  recordVersion: RecordVersionInputSchema.optional()
}).strict();
export type UpdateStockLocationBody = z.infer<typeof UpdateStockLocationBodySchema>;

export const ListStockLocationsQuerySchema = z.object({
  kind: StockLocationKindSchema.optional(),
  includeInactive: z.enum(["true", "false"]).optional()
});
export type ListStockLocationsQuery = z.infer<typeof ListStockLocationsQuerySchema>;

export const ListStockLevelsQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  lowStock: z.enum(["true", "false"]).optional()
});
export type ListStockLevelsQuery = z.infer<typeof ListStockLevelsQuerySchema>;

export const UpdateStockLevelBodySchema = z.object({
  lowStockThreshold: Qty.min(0).max(1_000_000).nullable(),
  recordVersion: RecordVersionInputSchema.optional()
}).strict();
export type UpdateStockLevelBody = z.infer<typeof UpdateStockLevelBodySchema>;

export const StockAdjustmentBodySchema = z.object({
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  /** Signed, non-zero. */
  quantityDelta: Qty.min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "quantityDelta must be non-zero"),
  reason: z.string().trim().min(1).max(500),
  allowNegative: z.boolean().optional(),
  /** recordVersion of the (location, product) stock level, if it exists. */
  recordVersion: RecordVersionInputSchema.optional()
}).strict();
export type StockAdjustmentBody = z.infer<typeof StockAdjustmentBodySchema>;

export const StockTransferBodySchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: PositiveQty,
  reason: z.string().trim().max(500).optional(),
  /** recordVersion of the source stock level. */
  recordVersion: RecordVersionInputSchema.optional()
}).strict().refine((b) => b.fromLocationId !== b.toLocationId, {
  message: "fromLocationId and toLocationId must differ",
  path: ["toLocationId"]
});
export type StockTransferBody = z.infer<typeof StockTransferBodySchema>;

export const JobStockUsageBodySchema = z.object({
  jobId: z.string().uuid(),
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: PositiveQty,
  note: z.string().trim().max(500).optional(),
  recordVersion: RecordVersionInputSchema.optional()
}).strict();
export type JobStockUsageBody = z.infer<typeof JobStockUsageBodySchema>;

export const ListStockMovementsQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});
export type ListStockMovementsQuery = z.infer<typeof ListStockMovementsQuerySchema>;

export interface StockLocation {
  id: string;
  name: string;
  kind: StockLocationKind;
  technicianId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  recordVersion: string;
}

export interface StockLevel {
  id: string;
  locationId: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  updatedAt: string;
  recordVersion: string;
}

export interface StockMovement {
  id: string;
  locationId: string;
  productId: string;
  kind: StockMovementKind;
  quantityDelta: number;
  quantityAfter: number;
  reason: string | null;
  jobId: string | null;
  transferGroupId: string | null;
  allowNegative: boolean;
  actorUserId: string | null;
  createdAt: string;
}

export interface StockMutationResponse {
  levels: StockLevel[];
  movements: StockMovement[];
}
