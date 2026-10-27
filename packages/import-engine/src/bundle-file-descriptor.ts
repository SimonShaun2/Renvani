import type { ImportBundleFileDescriptor, ImportBundleFileRole } from "@fsm/types";

const ROLE_BY_NAME: Record<string, ImportBundleFileRole> = {
  customers: "customers",
  customer: "customers",
  properties: "properties",
  property: "properties",
  locations: "properties",
  jobs: "jobs",
  estimates: "jobs",
  estimate: "jobs",
  invoices: "invoices",
  price_book: "equipment",
  pricebook: "equipment",
  products: "equipment",
  equipment: "equipment",
  payments: "payments"
};

export function inferImportBundleFileRole(fileName: string): ImportBundleFileRole {
  const normalized = fileName.toLowerCase().replace(/\.(csv|xlsx|xls)$/u, "");
  for (const [needle, role] of Object.entries(ROLE_BY_NAME)) {
    if (normalized.includes(needle)) {
      return role;
    }
  }
  return "unknown";
}

export function buildImportBundleFileDescriptor(input: {
  fileName: string;
  mimeType: string;
  byteSize: number;
  importSessionId?: string | null;
}): ImportBundleFileDescriptor {
  return {
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    importSessionId: input.importSessionId ?? null,
    role: inferImportBundleFileRole(input.fileName)
  };
}
