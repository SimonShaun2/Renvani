import type { ImportSourcePreset } from "./types.js";

export const SERVICE_FUSION_PRESETS: ImportSourcePreset[] = [
  {
    // Quirks: customer list export uses "Customer Name" or split first/last; service site is
    // "Service Address" (not billing). Multi-file bundles also ship jobs/invoices separately —
    // this preset only seeds the customers.csv column map (M1).
    id: "service_fusion",
    entity: "customers",
    label: "Service Fusion",
    headerAliases: {
      "customer name": "firstName",
      "contact name": "firstName",
      "first name": "firstName",
      "last name": "lastName",
      email: "email",
      "email address": "email",
      phone: "phone",
      "mobile phone": "phone",
      "service address": "addressLine1",
      "address 1": "addressLine1",
      city: "city",
      state: "state",
      zip: "zip",
      "postal code": "zip"
    }
  },
  {
    id: "service_fusion_price_book",
    entity: "products",
    label: "Service Fusion (price book)",
    headerAliases: {
      "item name": "name",
      "service name": "name",
      name: "name",
      description: "description",
      "unit price": "unitPrice",
      price: "unitPrice",
      rate: "unitPrice",
      category: "type",
      sku: "sku"
    }
  }
];
