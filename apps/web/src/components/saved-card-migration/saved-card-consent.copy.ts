/**
 * FS-172: single swappable source for saved-card consent UI copy.
 *
 * The consent text itself is rendered verbatim from the API (GET saved-card-migration → consent.text).
 * LEGAL_DRAFT_TEXT mirrors Legal's draft (same text as SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT in @fsm/types) and is used only to
 * detect that the API is serving the draft, so the DRAFT marker is shown. Swap this file when counsel
 * signs off (and the API version drops the "draft" suffix).
 */
export const SAVED_CARD_CONSENT_DRAFT_MARKER = "DRAFT · pending lawyer review";

export const SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT =
  "By applying these mappings, you confirm that you are authorized to act for your business and that your customers gave you permission to charge the cards they saved with your previous payment processor, for the kinds of payments and on the terms they agreed to with you. You authorize TrayLoop Technologies LLC, doing business as Renvani, to process those saved cards through Stripe for charges you create or approve in Renvani, including when the customer is not present. You are responsible for those charges and for honoring your customers' agreements, cancellations, and refund and dispute requests, and you will stop using any card if a customer withdraws permission. Do not apply mappings for any customer whose permission you cannot show.";

export const SAVED_CARD_CONSENT_CHECKBOX_LABEL = "I have read and agree to the acknowledgment above.";

export const SAVED_CARD_CONSENT_VERSION_MISMATCH =
  "The consent text changed since this page loaded. Reload the page, re-read the acknowledgment, and confirm again.";

export const SAVED_CARD_APPLY_FAILED = "Mappings could not be applied.";

export const SAVED_CARD_IMPORT_FAILED = "The import result could not be saved. Check the reference and rows, then try again.";

export function isDraftConsent(consent: { text: string; version: string }): boolean {
  return /draft/i.test(consent.version) || consent.text.trim() === SAVED_CARD_CONSENT_LEGAL_DRAFT_TEXT;
}
