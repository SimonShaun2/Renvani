export type InvoiceConfirmAction = "send" | "remind";

function formatAmount(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(amount) ? amount : 0);
}

export function invoiceConfirmDescription(
  action: InvoiceConfirmAction,
  customer: { firstName?: string | null; lastName?: string | null },
  amount: string | number
): string {
  const name = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "The customer";
  const money = formatAmount(amount);
  return action === "remind"
    ? `${name} gets a reminder to pay ${money} with their payment link.`
    : `${name} gets this invoice and a secure payment link for ${money}.`;
}
