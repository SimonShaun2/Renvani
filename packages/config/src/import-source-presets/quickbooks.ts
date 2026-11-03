import type { ImportSourcePreset } from "./types.js";

/**
 * QuickBooks Online + Desktop quirks (M1):
 * - QBO uses "Billing *" / "Primary *" columns; Desktop uses "Bill To *" and "E-mail".
 * - Desktop item list uses "Item" / "Sales Price" naming; QBO uses "Product/Service name".
 * - Payments export is separate from invoices for open-balance reconciliation (M3+).
 */
export const QUICKBOOKS_PRESETS: ImportSourcePreset[] = [
  {
    id: "quickbooks_customers",
    entity: "customers",
    label: "QuickBooks Online (customers)",
    headerAliases: {
      "customer display name": "firstName",
      "display name": "firstName",
      "company name": "firstName",
      "first name": "firstName",
      "last name": "lastName",
      "primary email": "email",
      email: "email",
      "primary phone": "phone",
      phone: "phone",
      "billing address line 1": "addressLine1",
      "shipping address line 1": "addressLine1",
      "billing city": "city",
      "billing state": "state",
      "billing zip": "zip"
    }
  },
  {
    // Desktop customer exports use "Customer" / "Bill To *" columns (not QBO "Billing *").
    // "E-mail" and "Main Phone" are common; IIF exports may differ — extend aliases when golden fixtures land.
    id: "quickbooks_desktop_customers",
    entity: "customers",
    label: "QuickBooks Desktop (customers)",
    headerAliases: {
      customer: "firstName",
      "customer name": "firstName",
      name: "firstName",
      contact: "firstName",
      "e-mail": "email",
      email: "email",
      phone: "phone",
      "main phone": "phone",
      phone1: "phone",
      baddr1: "addressLine1",
      "bill to 1": "addressLine1",
      "bill to line 1": "addressLine1",
      "bill to city": "city",
      "bill to state": "state",
      "bill to zip": "zip"
    }
  },
  {
    id: "quickbooks_items",
    entity: "products",
    label: "QuickBooks Online (products & services)",
    headerAliases: {
      name: "name",
      "product/service name": "name",
      sku: "sku",
      type: "type",
      "sales description": "description",
      description: "description",
      "sales price/rate": "unitPrice",
      price: "unitPrice"
    }
  },
  {
    id: "quickbooks_desktop_items",
    entity: "products",
    label: "QuickBooks Desktop (items)",
    headerAliases: {
      item: "name",
      "item name": "name",
      description: "description",
      type: "type",
      "sales price": "unitPrice",
      price: "unitPrice",
      cost: "cost",
      account: "incomeAccount"
    }
  },
  {
    id: "quickbooks_invoices",
    entity: "invoices",
    label: "QuickBooks Online (invoices)",
    headerAliases: {
      "invoice id": "sourceId",
      "invoice no": "invoiceNumber",
      "invoice number": "invoiceNumber",
      "customer name": "customerName",
      "invoice date": "issuedAt",
      "due date": "dueAt",
      total: "total",
      balance: "balanceDue",
      amount: "total",
      "payment date": "paidAt",
      "payment method": "paymentMethod"
    }
  },
  {
    id: "quickbooks_desktop_invoices",
    entity: "invoices",
    label: "QuickBooks Desktop (invoices)",
    headerAliases: {
      "invoice #": "invoiceNumber",
      "invoice no": "invoiceNumber",
      "invoice id": "invoiceNumber",
      num: "invoiceNumber",
      customer: "customerName",
      name: "customerName",
      date: "issuedAt",
      "invoice date": "issuedAt",
      "due date": "dueAt",
      amount: "total",
      total: "total",
      "open balance": "balanceDue",
      balance: "balanceDue"
    }
  },
  {
    id: "quickbooks_desktop_payments",
    entity: "invoices",
    label: "QuickBooks Desktop (payments)",
    headerAliases: {
      "payment id": "reference",
      customer: "customerName",
      "customer name": "customerName",
      date: "paidAt",
      "payment date": "paidAt",
      amount: "amount",
      "invoice id": "invoiceNumber",
      "invoice no": "invoiceNumber",
      "invoice #": "invoiceNumber",
      "payment method": "paymentMethod",
      method: "paymentMethod"
    }
  },
  {
    id: "quickbooks_payments",
    entity: "invoices",
    label: "QuickBooks Online (payments)",
    headerAliases: {
      date: "paidAt",
      "payment date": "paidAt",
      customer: "customerName",
      "customer name": "customerName",
      amount: "amount",
      "payment method": "paymentMethod",
      "invoice number": "invoiceNumber",
      "invoice no": "invoiceNumber",
      ref: "reference"
    }
  }
];
