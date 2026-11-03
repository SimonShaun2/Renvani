import type { ImportSourcePreset } from "./types.js";

export const JOBBER_PRESETS: ImportSourcePreset[] = [
  {
    id: "jobber",
    entity: "customers",
    label: "Jobber",
    headerAliases: {
      "client id": "sourceId",
      "first name": "firstName",
      "last name": "lastName",
      email: "email",
      phone: "phone",
      "mobile phone": "phone",
      street: "addressLine1",
      city: "city",
      state: "state",
      zip: "zip",
      "postal code": "zip"
    }
  },
  {
    id: "jobber_properties",
    entity: "customers",
    label: "Jobber (properties)",
    headerAliases: {
      "property id": "sourceId",
      "client id": "customerSourceId",
      "property name": "addressLine1",
      street: "addressLine1",
      city: "city",
      state: "state",
      zip: "zip",
      "postal code": "zip"
    }
  },
  {
    id: "jobber_jobs",
    entity: "customers",
    label: "Jobber (jobs)",
    headerAliases: {
      "job id": "sourceId",
      "client id": "customerSourceId",
      "completed on": "completedAt",
      title: "title",
      status: "status",
      "job status": "status"
    }
  },
  {
    id: "jobber_invoices",
    entity: "invoices",
    label: "Jobber (invoices)",
    headerAliases: {
      "invoice number": "invoiceNumber",
      "invoice no": "invoiceNumber",
      "client id": "customerSourceId",
      "invoice date": "issuedAt",
      total: "total",
      balance: "balanceDue",
      "balance due": "balanceDue"
    }
  },
  {
    id: "jobber_payments",
    entity: "invoices",
    label: "Jobber (payments)",
    headerAliases: {
      "payment id": "sourceId",
      "client id": "customerSourceId",
      "payment date": "paidAt",
      amount: "amount",
      "invoice number": "invoiceNumber",
      method: "paymentMethod",
      "payment method": "paymentMethod"
    }
  },
  {
    id: "jobber_price_book",
    entity: "products",
    label: "Jobber (products & services)",
    headerAliases: {
      name: "name",
      "product / service name": "name",
      "product id": "sku",
      description: "description",
      type: "type",
      "unit price": "unitPrice",
      price: "unitPrice",
      category: "type"
    }
  }
];
