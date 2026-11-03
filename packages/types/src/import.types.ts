import type { PaginatedResult } from "./customer.types.js";

export type ImportSessionStatus =
  | "uploaded"
  | "mapping"
  | "preview"
  | "importing"
  | "completed"
  | "failed"
  | "rolled_back";

export type ImportEntityType =
  | "customers"
  | "properties"
  | "jobs"
  | "estimates"
  | "invoices"
  | "price_book"
  | "notes"
  | "communications"
  | "service_agreements";

export type ColumnMapping = Record<string, string | null>;

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface ImportSession {
  id: string;
  companyId: string;
  createdById: string | null;
  entityType: ImportEntityType;
  status: ImportSessionStatus;
  fileName: string;
  fileUrl: string;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  duplicateRows: number | null;
  columnMappings: ColumnMapping;
  validationErrors: ValidationError[];
  aiInferences: Record<string, unknown>;
  rolledBackAt: Date | null;
  rolledBackById: string | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ListImportsQuery {
  status?: ImportSessionStatus;
  entityType?: ImportEntityType;
  page?: number;
  limit?: number;
}

export type PaginatedImportSessions = PaginatedResult<ImportSession>;
