/**
 * Pure policy for the invoice.paid -> review request automation (no I/O, unit-tested).
 * Consent, idempotency and rate limits are decided here; the service only loads facts and persists.
 */

export const REVIEW_REQUEST_CUSTOMER_COOLDOWN_DAYS = 30;
export const REVIEW_REQUEST_COMPANY_DAILY_LIMIT = 50;
/** 4-5 stars go public (Google); 3 or fewer go to the private feedback path. */
export const REVIEW_PUBLIC_MIN_RATING = 4;

export type ReviewAutomationChannel = "email" | "sms";

export interface InvoicePaidReviewFacts {
  invoiceStatus: string;
  /** Invoice total (decimal string or number). Zero/negative (fully refunded/void-like) never asks for a review. */
  invoiceTotal?: string | number | null;
  rule: { isEnabled: boolean; delayHours: number | null; config: Record<string, unknown> | null } | null;
  customer: {
    email: string | null;
    phone: string | null;
    prefersEmail: boolean | null;
    prefersSms: boolean | null;
    doNotContact: boolean | null;
  };
  /** A review request was already created for this invoice (replay / duplicate event). */
  alreadyRequestedForInvoice: boolean;
  /** An open (not completed/declined) review request already exists for the invoice's job. */
  openRequestForJob: boolean;
  /** Review requests created for this customer within the cooldown window. */
  customerRecentRequestCount: number;
  /** Review requests created by this company in the last 24h. */
  companyRequestsLast24h: number;
  /** Outbound SMS provider is live (false while the disabled stub is selected). */
  smsLive: boolean;
}

export type InvoicePaidReviewDecision =
  | { action: "create"; channel: ReviewAutomationChannel; delayMs: number }
  | {
      action: "skip";
      reason:
        | "invoice_not_paid"
        | "rule_disabled"
        | "already_requested_for_invoice"
        | "open_request_for_job"
        | "do_not_contact"
        | "no_consented_channel"
        | "customer_rate_limited"
        | "company_rate_limited";
    };

function readPositiveInt(config: Record<string, unknown> | null, key: string, fallback: number): number {
  const value = config?.[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function customerCooldownDays(config: Record<string, unknown> | null): number {
  return readPositiveInt(config, "customerCooldownDays", REVIEW_REQUEST_CUSTOMER_COOLDOWN_DAYS);
}

export function companyDailyLimit(config: Record<string, unknown> | null): number {
  return readPositiveInt(config, "companyDailyLimit", REVIEW_REQUEST_COMPANY_DAILY_LIMIT);
}

/**
 * Channel choice: email first (Resend is the live MVP channel), SMS only when the customer consents
 * AND a live provider is selected. With the disabled SMS stub, SMS-only customers are skipped rather
 * than "sent" into the stub, so no request is burned before Twilio is configured.
 */
export function pickReviewChannel(
  customer: InvoicePaidReviewFacts["customer"],
  smsLive: boolean
): ReviewAutomationChannel | null {
  // NULL preference is not consent: only an explicit true opts the customer in.
  if (customer.prefersEmail === true && customer.email) {
    return "email";
  }
  if (smsLive && customer.prefersSms === true && customer.phone) {
    return "sms";
  }
  return null;
}

export function decideInvoicePaidReviewRequest(facts: InvoicePaidReviewFacts): InvoicePaidReviewDecision {
  if (facts.invoiceStatus !== "paid") {
    return { action: "skip", reason: "invoice_not_paid" };
  }
  if (facts.invoiceTotal !== undefined && !(Number(facts.invoiceTotal ?? 0) > 0)) {
    return { action: "skip", reason: "invoice_not_paid" };
  }
  if (!facts.rule?.isEnabled) {
    return { action: "skip", reason: "rule_disabled" };
  }
  if (facts.alreadyRequestedForInvoice) {
    return { action: "skip", reason: "already_requested_for_invoice" };
  }
  if (facts.openRequestForJob) {
    return { action: "skip", reason: "open_request_for_job" };
  }
  if (facts.customer.doNotContact) {
    return { action: "skip", reason: "do_not_contact" };
  }
  const channel = pickReviewChannel(facts.customer, facts.smsLive);
  if (!channel) {
    return { action: "skip", reason: "no_consented_channel" };
  }
  if (facts.customerRecentRequestCount > 0) {
    return { action: "skip", reason: "customer_rate_limited" };
  }
  if (facts.companyRequestsLast24h >= companyDailyLimit(facts.rule.config)) {
    return { action: "skip", reason: "company_rate_limited" };
  }
  const delayHours = facts.rule.delayHours ?? 0;
  return { action: "create", channel, delayMs: Math.max(0, delayHours) * 60 * 60 * 1000 };
}

export type ReviewRatingRoute =
  | { kind: "public_review"; platform: "google"; url: string }
  | { kind: "private_feedback" };

/** 4-5 stars with a Google link -> Google; otherwise (3 or fewer, or no link) -> private feedback. */
export function routeReviewRating(rating: number, googleReviewUrl: string | null | undefined): ReviewRatingRoute {
  if (rating >= REVIEW_PUBLIC_MIN_RATING && googleReviewUrl) {
    return { kind: "public_review", platform: "google", url: googleReviewUrl };
  }
  return { kind: "private_feedback" };
}

/** BullMQ jobId: a replayed event re-adding the same job is a no-op while the job is retained. */
export function invoiceReviewRequestQueueJobId(invoiceId: string): string {
  return `review-request-invoice-${invoiceId}`;
}
