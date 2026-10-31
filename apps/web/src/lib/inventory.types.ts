/**
 * FS-181/FS-211: web-side mirror of the inventory v1 shapes (packages/types/src/inventory/v1),
 * including productName/productSku from #345.
 */
export type StockLocationKind = "warehouse" | "van";

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
  /** #345: catalog name, null when the product is missing. */
  productName: string | null;
  /** #345: SKU when set. */
  productSku: string | null;
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
  /** #345: catalog name, null when the product is missing. */
  productName: string | null;
  /** #345: SKU when set. */
  productSku: string | null;
  kind: "adjustment" | "transfer_out" | "transfer_in" | "job_usage";
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

export interface CreateStockLocationBody {
  name: string;
  kind: StockLocationKind;
  technicianId?: string | null;
}

export interface StockAdjustmentBody {
  locationId: string;
  productId: string;
  quantityDelta: number;
  reason: string;
  allowNegative?: boolean;
  recordVersion?: string;
}

export interface StockTransferBody {
  fromLocationId: string;
  toLocationId: string;
  productId: string;
  quantity: number;
  reason?: string;
  recordVersion?: string;
}

/** 409 body from inventory writes. */
export interface InventoryConflictPayload {
  error: "CONFLICT";
  reason: "stale_record_version" | "insufficient_stock" | string;
  message: string;
  current?: unknown;
}
