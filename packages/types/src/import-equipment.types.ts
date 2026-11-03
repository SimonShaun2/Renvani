import { z } from "zod";

export const ImportEquipmentCommitRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  sourceId: z.string().min(1).max(256),
  name: z.string().min(1).max(255),
  assetType: z.string().min(1).max(100),
  customerId: z.string().uuid().optional(),
  customerSourceId: z.string().min(1).max(256).optional(),
  propertyId: z.string().uuid().optional(),
  propertySourceId: z.string().min(1).max(256).optional(),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  installDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  warrantyExpiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lastServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lastServiceJobSourceId: z.string().min(1).max(256).optional().nullable(),
  condition: z.enum(["excellent", "good", "fair", "poor", "failed"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type ImportEquipmentCommitRow = z.infer<typeof ImportEquipmentCommitRowSchema>;

export interface ImportEquipmentCommitContext {
  companyId: string;
  importSessionId: string;
  sourceSystem: string;
  actorId?: string;
}

export interface ImportEquipmentCommitRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportEquipmentCommitResult {
  assetsCommitted: number;
  rowsFailed: number;
  errors: ImportEquipmentCommitRowError[];
}
