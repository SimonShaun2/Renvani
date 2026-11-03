import { z } from "zod";

export const QBD_DESKTOP_IMPORT_CONTRACT_ID = "fsm.fs-migrate.qbd-desktop-import.v1";

export const qbdDesktopSupportedExportExtensionSchema = z.enum(["csv", "xlsx", "xls", "iif"]);

export const QBD_DESKTOP_SUPPORTED_EXPORT_EXTENSIONS = qbdDesktopSupportedExportExtensionSchema.options;

export const qbdDesktopImportEntitySlotSchema = z.enum([
  "customers",
  "products",
  "invoices",
  "payments"
]);

export const QBD_DESKTOP_IMPORT_ENTITY_SLOTS = qbdDesktopImportEntitySlotSchema.options;

export const qbdDesktopImportContractSchema = z.object({
  contractId: z.literal(QBD_DESKTOP_IMPORT_CONTRACT_ID),
  sourceSystem: z.literal("qbd"),
  supportedExtensions: z.array(qbdDesktopSupportedExportExtensionSchema).min(1),
  entitySlots: z.array(qbdDesktopImportEntitySlotSchema).min(1),
  presetIds: z.object({
    customers: z.literal("quickbooks_desktop_customers"),
    products: z.literal("quickbooks_desktop_items"),
    invoices: z.literal("quickbooks_desktop_invoices"),
    payments: z.literal("quickbooks_desktop_payments")
  })
});

export type QbdDesktopImportContract = z.infer<typeof qbdDesktopImportContractSchema>;

export const QBD_DESKTOP_IMPORT_CONTRACT: QbdDesktopImportContract = {
  contractId: QBD_DESKTOP_IMPORT_CONTRACT_ID,
  sourceSystem: "qbd",
  supportedExtensions: [...QBD_DESKTOP_SUPPORTED_EXPORT_EXTENSIONS],
  entitySlots: [...QBD_DESKTOP_IMPORT_ENTITY_SLOTS],
  presetIds: {
    customers: "quickbooks_desktop_customers",
    products: "quickbooks_desktop_items",
    invoices: "quickbooks_desktop_invoices",
    payments: "quickbooks_desktop_payments"
  }
};
