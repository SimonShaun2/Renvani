import {
  GOLDEN_IMPORT_BUNDLE_FIXTURE_VERSION,
  type GoldenImportBundleManifest
} from "@fsm/types";

const versionSuffix = GOLDEN_IMPORT_BUNDLE_FIXTURE_VERSION;

export const GOLDEN_IMPORT_BUNDLE_MANIFESTS: GoldenImportBundleManifest[] = [
  {
    fixtureId: `service_fusion-${versionSuffix}`,
    sourceSystem: "service_fusion",
    label: "Service Fusion golden bundle",
    description: "Multi-export CSV bundle with price book, equipment, and ≥2y job/invoice history.",
    requiredHistorySpanYears: 2,
    mediaRelativePaths: [
      "media/job-photos/SF-JOB-003-before.jpg",
      "media/forms/SF-CUST-001-agreement.pdf"
    ],
    files: [
      {
        relativePath: "customers.csv",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "locations.csv",
        entityType: "properties",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        }
      },
      {
        relativePath: "jobs.csv",
        entityType: "jobs",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        },
        businessDateColumn: "Completed Date"
      },
      {
        relativePath: "invoices.csv",
        entityType: "invoices",
        presetEntityHint: "invoices",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        },
        businessDateColumn: "Invoice Date"
      },
      {
        relativePath: "equipment.csv",
        entityType: "equipment",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        }
      },
      {
        relativePath: "price_book.csv",
        entityType: "products",
        presetEntityHint: "products"
      }
    ]
  },
  {
    fixtureId: `jobber-${versionSuffix}`,
    sourceSystem: "jobber",
    label: "Jobber golden bundle",
    description: "Client/property/job exports with price book and ≥2y history for epic §6.",
    requiredHistorySpanYears: 2,
    mediaRelativePaths: [],
    files: [
      {
        relativePath: "clients.csv",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "properties.csv",
        entityType: "properties",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "clients.csv",
          localColumn: "Client ID",
          parentColumn: "Client ID"
        }
      },
      {
        relativePath: "jobs.csv",
        entityType: "jobs",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "clients.csv",
          localColumn: "Client ID",
          parentColumn: "Client ID"
        },
        businessDateColumn: "Completed On"
      },
      {
        relativePath: "invoices.csv",
        entityType: "invoices",
        presetEntityHint: "invoices",
        joinLink: {
          parentFile: "clients.csv",
          localColumn: "Client ID",
          parentColumn: "Client ID"
        },
        businessDateColumn: "Invoice Date"
      },
      {
        relativePath: "payments.csv",
        entityType: "payments",
        presetEntityHint: "invoices",
        joinLink: {
          parentFile: "clients.csv",
          localColumn: "Client ID",
          parentColumn: "Client ID"
        },
        businessDateColumn: "Payment Date"
      },
      {
        relativePath: "price_book.csv",
        entityType: "products",
        presetEntityHint: "products"
      }
    ]
  },
  {
    fixtureId: `servicetitan-${versionSuffix}`,
    sourceSystem: "servicetitan",
    label: "ServiceTitan golden bundle",
    description: "Location-aware customer bundle with jobs, invoices, and equipment.",
    requiredHistorySpanYears: 2,
    mediaRelativePaths: [],
    files: [
      {
        relativePath: "customers.csv",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "locations.csv",
        entityType: "properties",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        }
      },
      {
        relativePath: "jobs.csv",
        entityType: "jobs",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        },
        businessDateColumn: "Completed On"
      },
      {
        relativePath: "invoices.csv",
        entityType: "invoices",
        presetEntityHint: "invoices",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        },
        businessDateColumn: "Invoice Date"
      },
      {
        relativePath: "equipment.csv",
        entityType: "equipment",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        }
      }
    ]
  },
  {
    fixtureId: `housecall_pro-${versionSuffix}`,
    sourceSystem: "housecall_pro",
    label: "Housecall Pro golden bundle",
    description: "Customer-centric HCP CSV exports with jobs and invoices (≥2y history).",
    requiredHistorySpanYears: 2,
    mediaRelativePaths: [],
    files: [
      {
        relativePath: "customers.csv",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "jobs.csv",
        entityType: "jobs",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer UUID",
          parentColumn: "Customer ID"
        },
        businessDateColumn: "Completed Date"
      },
      {
        relativePath: "invoices.csv",
        entityType: "invoices",
        presetEntityHint: "invoices",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "Customer ID",
          parentColumn: "Customer ID"
        },
        businessDateColumn: "Invoice Date"
      }
    ]
  },
  {
    fixtureId: `qbo-${versionSuffix}`,
    sourceSystem: "qbo",
    label: "QuickBooks Online golden bundle",
    description: "Customers, items, invoices, and payments with open balance row.",
    requiredHistorySpanYears: 2,
    mediaRelativePaths: [],
    files: [
      {
        relativePath: "customers.csv",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "items.csv",
        entityType: "products",
        presetEntityHint: "products"
      },
      {
        relativePath: "invoices.csv",
        entityType: "invoices",
        presetEntityHint: "invoices",
        businessDateColumn: "Invoice Date"
      },
      {
        relativePath: "payments.csv",
        entityType: "payments",
        presetEntityHint: "invoices",
        businessDateColumn: "Payment Date"
      }
    ]
  },
  {
    fixtureId: `qbd-${versionSuffix}`,
    sourceSystem: "qbd",
    label: "QuickBooks Desktop golden bundle",
    description: "Desktop IIF customer list plus CSV report exports (items, invoices, payments).",
    requiredHistorySpanYears: 2,
    mediaRelativePaths: [],
    files: [
      {
        relativePath: "customers.iif",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "items.csv",
        entityType: "products",
        presetEntityHint: "products"
      },
      {
        relativePath: "invoices.csv",
        entityType: "invoices",
        presetEntityHint: "invoices",
        businessDateColumn: "Invoice Date"
      },
      {
        relativePath: "payments.csv",
        entityType: "payments",
        presetEntityHint: "invoices",
        businessDateColumn: "Payment Date"
      }
    ]
  },
  {
    fixtureId: `manual_csv-${versionSuffix}`,
    sourceSystem: "manual_csv",
    label: "Generic CSV golden bundle",
    description:
      "Multi-file generic bundle: VIP tabular joins plus ~100k-row chunked job history for worker ingest.",
    mediaRelativePaths: [],
    requiredHistorySpanYears: 2,
    chunkedJobHistory: {
      relativeDir: "jobs_history",
      partFileNameFormat: "part-%02d.csv",
      partCount: 20,
      rowsPerPart: 5000,
      totalDataRows: 100_000,
      workerRowChunkSize: 500,
      entityType: "jobs",
      presetEntityHint: "customers",
      joinLink: {
        parentFile: "customers.csv",
        localColumn: "customer_id",
        parentColumn: "customer_id"
      },
      businessDateColumn: "completed_at"
    },
    files: [
      {
        relativePath: "customers.csv",
        entityType: "customers",
        presetEntityHint: "customers"
      },
      {
        relativePath: "jobs.csv",
        entityType: "jobs",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "customer_id",
          parentColumn: "customer_id"
        },
        businessDateColumn: "completed_at"
      },
      {
        relativePath: "vip_tiers.csv",
        entityType: "vip_membership_tiers",
        presetEntityHint: "products"
      },
      {
        relativePath: "vip_memberships.csv",
        entityType: "vip_memberships",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "customer_id",
          parentColumn: "customer_id"
        }
      }
    ]
  }
];

export function getGoldenImportBundleManifest(
  sourceSystem: GoldenImportBundleManifest["sourceSystem"]
): GoldenImportBundleManifest {
  const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === sourceSystem);
  if (!manifest) {
    throw new Error(`No golden import bundle manifest for source: ${sourceSystem}`);
  }
  return manifest;
}
