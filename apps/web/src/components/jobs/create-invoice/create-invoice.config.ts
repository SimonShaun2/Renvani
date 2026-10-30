import type { JobStatus } from "@fsm/types";

/** Figma 291:3574: Create invoice button states on Job detail (header actions 144:287). */
export type CreateInvoiceButtonState = "primary" | "secondary" | "hidden" | "view" | "disabled";

export const CREATE_INVOICE_HIDDEN_STATUSES: readonly JobStatus[] = ["cancelled"];
export const CREATE_INVOICE_PRIMARY_STATUSES: readonly JobStatus[] = ["completed", "invoiced", "paid", "closed"];

/** Payments setup frame 51:3. */
export const PAYMENTS_SETUP_HREF = "/settings/payments";

export const CREATE_INVOICE_COPY = {
  eyebrow: "NEW INVOICE",
  title: "Create invoice",
  button: "Create invoice",
  viewInvoice: (invoiceNumber: string) => `View invoice ${invoiceNumber}`,
  disabledTooltip: "Finish payments setup to send invoices",
  incompleteConfirm: "This job isn't complete yet. Invoice anyway?",
  addFromPriceBook: "+ Add from price book…",
  customLine: "+ Custom line",
  subtotal: "Subtotal",
  tax: (pct: string) => `Tax (${pct}%, company setting)`,
  discount: "Discount (optional)",
  customerTotal: "Customer total",
  dueDate: "Due date",
  dueOnReceipt: "Due on receipt",
  messageToCustomer: "Message to customer (shown on invoice)",
  internalNotes: "Internal notes",
  sendNow: "Send to customer now (email with pay link)",
  cancel: "Cancel",
  close: "Close",
  submitError: "We couldn't create the invoice. Check the items and try again.",
  lineError: "Quantity and price must be more than 0",
  noItems: "Add at least one item",
  pastDue: "Due date can't be in the past",
  paymentsTitle: "Finish payments setup to send invoices",
  paymentsBody: "Connect payouts before creating invoices, so customers can pay online.",
  paymentsCta: "Finish payments setup →"
} as const;
