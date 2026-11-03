import type { ImportSourcePreset } from "./types.js";

/**
 * ServiceTitan quirks (M1):
 * - Customer export vs **location** export are separate files; locations join on customer id.
 * - Job exports carry tags, business unit, and completion timestamps — not customer address.
 */
export const SERVICE_TITAN_PRESETS: ImportSourcePreset[] = [
  {
    id: "service_titan",
    entity: "customers",
    label: "ServiceTitan (customers)",
    headerAliases: {
      name: "firstName",
      "customer name": "firstName",
      "first name": "firstName",
      "last name": "lastName",
      email: "email",
      phone: "phone",
      "phone number": "phone",
      address: "addressLine1",
      "street address": "addressLine1",
      city: "city",
      state: "state",
      zip: "zip",
      "zip code": "zip"
    }
  },
  {
    id: "service_titan_locations",
    entity: "customers",
    label: "ServiceTitan (locations / service addresses)",
    headerAliases: {
      "location id": "sourceId",
      "customer id": "customerSourceId",
      "location name": "addressLine1",
      name: "addressLine1",
      address: "addressLine1",
      "street address": "addressLine1",
      city: "city",
      state: "state",
      zip: "zip",
      "zip code": "zip"
    }
  },
  {
    id: "service_titan_jobs",
    entity: "customers",
    label: "ServiceTitan (jobs)",
    headerAliases: {
      "job id": "sourceId",
      "job number": "jobNumber",
      "customer id": "customerSourceId",
      "location id": "propertySourceId",
      "job type": "jobType",
      "job status": "status",
      status: "status",
      "completed on": "completedAt",
      "scheduled date": "scheduledAt",
      "business unit": "businessUnit",
      tag: "tags",
      tags: "tags"
    }
  },
  {
    id: "service_titan_invoices",
    entity: "invoices",
    label: "ServiceTitan (invoices)",
    headerAliases: {
      "invoice number": "invoiceNumber",
      "customer id": "customerSourceId",
      "invoice date": "invoiceDate",
      total: "total",
      balance: "balanceDue",
      "balance due": "balanceDue",
      subtotal: "subtotal",
      tax: "tax"
    }
  }
];
