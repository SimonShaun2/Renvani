/** FS-152 — deterministic golden bundle e2e expectations (QuickBooks Desktop + Service Fusion only). */
export const GOLDEN_IMPORT_E2E_SOURCE_SYSTEMS = ["qbd", "service_fusion"] as const;

export type GoldenImportE2eSourceSystem = (typeof GOLDEN_IMPORT_E2E_SOURCE_SYSTEMS)[number];

export type GoldenImportE2eLineageTable =
  | "customers"
  | "properties"
  | "jobs"
  | "invoices"
  | "payments"
  | "product_catalog"
  | "assets";

export interface GoldenImportE2eEntityExpectation {
  table: GoldenImportE2eLineageTable;
  count: number;
  sampleSourceIds: readonly string[];
}

export const GOLDEN_IMPORT_E2E_EXPECTATIONS: Record<
  GoldenImportE2eSourceSystem,
  readonly GoldenImportE2eEntityExpectation[]
> = {
  qbd: [
    {
      table: "customers",
      count: 2,
      sampleSourceIds: ["Legacy Air Co", "Delta Ductwork"]
    },
    {
      table: "product_catalog",
      count: 2,
      sampleSourceIds: ["LAB-95", "REF-LB"]
    },
    {
      table: "invoices",
      count: 2,
      sampleSourceIds: ["QBD-INV-001", "QBD-INV-002"]
    },
    {
      table: "payments",
      count: 2,
      sampleSourceIds: ["QBD-PAY-001", "QBD-PAY-002"]
    }
  ],
  service_fusion: [
    {
      table: "customers",
      count: 2,
      sampleSourceIds: ["SF-CUST-001", "SF-CUST-002"]
    },
    {
      table: "properties",
      count: 2,
      sampleSourceIds: ["SF-LOC-001", "SF-LOC-002"]
    },
    {
      table: "jobs",
      count: 3,
      sampleSourceIds: ["SF-JOB-001", "SF-JOB-003"]
    },
    {
      table: "invoices",
      count: 3,
      sampleSourceIds: ["SF-INV-001", "SF-INV-003"]
    },
    {
      table: "assets",
      count: 2,
      sampleSourceIds: ["SF-EQ-001", "SF-EQ-002"]
    },
    {
      table: "product_catalog",
      count: 2,
      sampleSourceIds: ["SF-ITEM-001", "SF-ITEM-002"]
    }
  ]
};

/** Expected invoice money after invoices + itemized payments import (payments replace the aggregate placeholder). */
export interface GoldenImportE2eInvoiceBalanceExpectation {
  sourceId: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
}

export const GOLDEN_IMPORT_E2E_INVOICE_BALANCES: Partial<
  Record<GoldenImportE2eSourceSystem, readonly GoldenImportE2eInvoiceBalanceExpectation[]>
> = {
  qbd: [
    { sourceId: "QBD-INV-001", total: "220.00", amountPaid: "220.00", balanceDue: "0.00" },
    { sourceId: "QBD-INV-002", total: "410.00", amountPaid: "360.00", balanceDue: "50.00" }
  ]
};
