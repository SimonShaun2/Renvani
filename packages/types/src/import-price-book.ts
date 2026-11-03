import { z } from "zod";

import type { ProductCategory } from "./product.types.js";

/** Stable preset ids for FS-MIGRATE lineage (`source_system`). */
export const IMPORT_SOURCE_SYSTEM_IDS = [
  "jobber",
  "housecall_pro",
  "service_titan",
  "service_fusion",
  "qbo",
  "qbd",
  "manual_csv"
] as const;

export type ImportSourceSystemId = (typeof IMPORT_SOURCE_SYSTEM_IDS)[number];

export interface PriceBookImportRow {
  sourceId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  sku: string | null;
  unitPrice: string;
  cost: string | null;
  unit: string | null;
  isTaxable: boolean;
  isActive: boolean;
}

export const priceBookImportRowSchema = z.object({
  sourceId: z.string().trim().min(1).max(256),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable(),
  category: z.enum(["service", "labor", "material", "equipment", "fee", "bundle"]),
  sku: z.string().trim().max(100).nullable(),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(),
  unit: z.string().trim().max(50).nullable(),
  isTaxable: z.boolean(),
  isActive: z.boolean()
});

export interface ImportInvoiceLineSeed {
  id: string;
  companyId: string;
  importSessionId: string;
  sourceSystem: ImportSourceSystemId;
  sourceId: string;
  productCatalogId: string;
  sku: string | null;
  name: string;
}
