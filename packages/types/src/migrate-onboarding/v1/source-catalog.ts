import type { MigrateOnboardingSourceCatalogEntry, MigrateSourceSystemId } from "./schemas.js";

export const MIGRATE_ONBOARDING_SOURCE_CATALOG: MigrateOnboardingSourceCatalogEntry[] = [
  {
    id: "manual_csv",
    label: "Generic export (any tool)",
    description: "Upload CSV or XLSX from any FSM or spreadsheet; AI maps columns to Renvani fields.",
    recommendedExports: ["customers", "properties", "jobs", "invoices", "equipment", "communications"],
    catalogTier: "primary",
    importPath: "generic_ai_guided"
  },
  {
    id: "qbo",
    label: "QuickBooks Online",
    description: "Export customers, items, invoices, and payments as CSV/XLSX (OAuth sign-in is gated).",
    recommendedExports: ["customers", "items", "invoices", "payments"],
    catalogTier: "primary",
    importPath: "quickbooks_file_export",
    oauth: {
      enabled: false,
      founderGate: true,
      message:
        "QuickBooks Online sign-in is not enabled yet. Export customers, items, and invoices as CSV/XLSX and upload them here."
    }
  },
  {
    id: "qbd",
    label: "QuickBooks Desktop",
    description:
      "QuickBooks Desktop file exports: IIF customer lists plus CSV/Excel reports for items, invoices, and payments (AI importer + desktop presets).",
    recommendedExports: ["customers", "items", "invoices"],
    catalogTier: "primary",
    importPath: "quickbooks_file_export"
  },
  {
    id: "service_fusion",
    label: "Service Fusion",
    description: "Export tips only — use Generic export and apply Service Fusion header-alias presets.",
    recommendedExports: ["customers", "locations", "jobs", "invoices", "equipment", "communications"],
    catalogTier: "export_tips",
    importPath: "generic_ai_guided",
    presetAliasFor: "manual_csv"
  },
  {
    id: "jobber",
    label: "Jobber",
    description: "Export tips only — use Generic export with Jobber column-alias presets.",
    recommendedExports: ["clients", "properties", "jobs", "invoices", "communications"],
    catalogTier: "export_tips",
    importPath: "generic_ai_guided",
    presetAliasFor: "manual_csv"
  },
  {
    id: "servicetitan",
    label: "ServiceTitan",
    description: "Export tips only — use Generic export with ServiceTitan header-alias presets.",
    recommendedExports: ["customers", "locations", "jobs", "invoices", "equipment", "communications"],
    catalogTier: "export_tips",
    importPath: "generic_ai_guided",
    presetAliasFor: "manual_csv"
  },
  {
    id: "housecall_pro",
    label: "Housecall Pro",
    description: "Export tips only — use Generic export with Housecall Pro header-alias presets.",
    recommendedExports: ["customers", "jobs", "invoices", "communications"],
    catalogTier: "export_tips",
    importPath: "generic_ai_guided",
    presetAliasFor: "manual_csv"
  }
];

export function isMigrateSourceSystemId(value: string): value is MigrateSourceSystemId {
  return MIGRATE_ONBOARDING_SOURCE_CATALOG.some((entry) => entry.id === value);
}

export function getMigrateOnboardingCatalogEntry(
  sourceSystem: MigrateSourceSystemId
): MigrateOnboardingSourceCatalogEntry | undefined {
  return MIGRATE_ONBOARDING_SOURCE_CATALOG.find((entry) => entry.id === sourceSystem);
}
