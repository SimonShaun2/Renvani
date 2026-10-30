import { z } from "zod";

import type { ImportSourceSystemId } from "./import-price-book.js";
import type { MaintenancePlanFrequency, MaintenancePlanStatus } from "./service-agreement.types.js";

export interface ServiceAgreementImportRow {
  sourceId: string;
  name: string;
  customerSourceId: string;
  nextServiceDate: string;
  startDate: string;
  frequency: MaintenancePlanFrequency;
  status: MaintenancePlanStatus;
  price: string | null;
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const serviceAgreementImportRowSchema = z.object({
  sourceId: z.string().trim().min(1).max(256),
  name: z.string().trim().min(1).max(255),
  customerSourceId: z.string().trim().min(1).max(256),
  nextServiceDate: isoDateSchema,
  startDate: isoDateSchema,
  frequency: z.enum(["monthly", "bi_monthly", "quarterly", "bi_annual", "annual"]),
  status: z.enum(["active", "paused", "expired", "cancelled"]),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(),
});

export interface ServiceAgreementsImportCommitResult {
  importedRows: number;
  skippedRows: number;
  maintenancePlans: number;
}

export type { ImportSourceSystemId };
