/** Shared opt-out rule for payment receipts (Resend receipt + Stripe receipt_email + public pay view). */
export interface ReceiptRecipient {
  email: string | null | undefined;
  doNotContact?: boolean | null;
  prefersEmail?: boolean | null;
}

/** True when a receipt email may be sent: an address exists and the customer has not opted out of email/contact. */
export function isReceiptEmailAllowed(recipient: ReceiptRecipient | null | undefined): recipient is ReceiptRecipient & { email: string } {
  if (!recipient) return false;
  const email = typeof recipient.email === "string" ? recipient.email.trim() : "";
  if (!email) return false;
  if (recipient.doNotContact === true) return false;
  if (recipient.prefersEmail === false) return false;
  return true;
}
