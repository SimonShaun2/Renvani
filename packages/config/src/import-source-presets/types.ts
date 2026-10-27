/**
 * FS-MIGRATE M1 — shared types for import source presets (CSV/XLSX export maps).
 */

export type ImportSourcePresetId =
  | "jobber"
  | "jobber_properties"
  | "jobber_jobs"
  | "jobber_invoices"
  | "jobber_payments"
  | "jobber_price_book"
  | "housecall_pro"
  | "housecall_pro_jobs"
  | "housecall_pro_invoices"
  | "service_titan"
  | "service_titan_locations"
  | "service_titan_jobs"
  | "service_titan_invoices"
  | "service_fusion"
  | "service_fusion_price_book"
  | "quickbooks_customers"
  | "quickbooks_desktop_customers"
  | "quickbooks_desktop_items"
  | "quickbooks_desktop_invoices"
  | "quickbooks_desktop_payments"
  | "quickbooks_items"
  | "quickbooks_invoices"
  | "quickbooks_payments"
  | "generic";

export type ImportPresetEntityHint =
  | "customers"
  | "products"
  | "invoices"
  | "notes"
  | "service_agreements";

export interface ImportSourcePreset {
  id: ImportSourcePresetId;
  entity: ImportPresetEntityHint;
  label: string;
  headerAliases: Record<string, string>;
}
