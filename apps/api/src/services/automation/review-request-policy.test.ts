import { describe, expect, it } from "vitest";

import {
  decideInvoicePaidReviewRequest,
  invoiceReviewRequestQueueJobId,
  pickReviewChannel,
  routeReviewRating,
  type InvoicePaidReviewFacts
} from "./review-request-policy.js";

function facts(overrides: Partial<InvoicePaidReviewFacts> = {}): InvoicePaidReviewFacts {
  return {
    invoiceStatus: "paid",
    rule: { isEnabled: true, delayHours: 4, config: null },
    customer: { email: "c@example.com", phone: "+15550100", prefersEmail: true, prefersSms: true, doNotContact: false },
    alreadyRequestedForInvoice: false,
    openRequestForJob: false,
    customerRecentRequestCount: 0,
    companyRequestsLast24h: 0,
    smsLive: false,
    ...overrides
  };
}

describe("invoice.paid review request policy", () => {
  it("creates an email request delayed by the rule's delayHours", () => {
    expect(decideInvoicePaidReviewRequest(facts())).toEqual({ action: "create", channel: "email", delayMs: 4 * 3600_000 });
  });

  it("only fires for paid invoices with the review_request rule enabled", () => {
    expect(decideInvoicePaidReviewRequest(facts({ invoiceStatus: "partially_paid" }))).toMatchObject({ reason: "invoice_not_paid" });
    expect(decideInvoicePaidReviewRequest(facts({ rule: null }))).toMatchObject({ reason: "rule_disabled" });
    expect(
      decideInvoicePaidReviewRequest(facts({ rule: { isEnabled: false, delayHours: 4, config: null } }))
    ).toMatchObject({ reason: "rule_disabled" });
  });

  it("is idempotent: a replayed invoice.paid or an open job request is skipped", () => {
    expect(decideInvoicePaidReviewRequest(facts({ alreadyRequestedForInvoice: true }))).toMatchObject({
      reason: "already_requested_for_invoice"
    });
    expect(decideInvoicePaidReviewRequest(facts({ openRequestForJob: true }))).toMatchObject({ reason: "open_request_for_job" });
    expect(invoiceReviewRequestQueueJobId("inv-1")).toBe("review-request-invoice-inv-1");
  });

  it("respects do-not-contact and per-channel opt-outs", () => {
    const optedOut = { email: "c@example.com", phone: "+15550100", prefersEmail: true, prefersSms: true, doNotContact: true };
    expect(decideInvoicePaidReviewRequest(facts({ customer: optedOut }))).toMatchObject({ reason: "do_not_contact" });
    const noEmail = { ...optedOut, doNotContact: false, prefersEmail: false };
    expect(decideInvoicePaidReviewRequest(facts({ customer: noEmail }))).toMatchObject({ reason: "no_consented_channel" });
    expect(decideInvoicePaidReviewRequest(facts({ customer: noEmail, smsLive: true }))).toMatchObject({ channel: "sms" });
    expect(
      decideInvoicePaidReviewRequest(facts({ customer: { ...noEmail, prefersSms: false }, smsLive: true }))
    ).toMatchObject({ reason: "no_consented_channel" });
  });

  it("does not burn SMS-only customers into the disabled stub", () => {
    const smsOnly = { email: null, phone: "+15550100", prefersEmail: true, prefersSms: true, doNotContact: false };
    expect(pickReviewChannel(smsOnly, false)).toBeNull();
    expect(pickReviewChannel(smsOnly, true)).toBe("sms");
  });

  it("rate limits per customer (cooldown) and per company (daily cap, configurable)", () => {
    expect(decideInvoicePaidReviewRequest(facts({ customerRecentRequestCount: 1 }))).toMatchObject({
      reason: "customer_rate_limited"
    });
    expect(decideInvoicePaidReviewRequest(facts({ companyRequestsLast24h: 50 }))).toMatchObject({ reason: "company_rate_limited" });
    expect(
      decideInvoicePaidReviewRequest(
        facts({ companyRequestsLast24h: 2, rule: { isEnabled: true, delayHours: 0, config: { companyDailyLimit: 2 } } })
      )
    ).toMatchObject({ reason: "company_rate_limited" });
  });
});

describe("review rating routing", () => {
  it("routes 4-5 stars to Google and 3 or fewer to private feedback", () => {
    expect(routeReviewRating(5, "https://g.page/r/x")).toEqual({ kind: "public_review", platform: "google", url: "https://g.page/r/x" });
    expect(routeReviewRating(4, "https://g.page/r/x")).toMatchObject({ kind: "public_review" });
    expect(routeReviewRating(3, "https://g.page/r/x")).toEqual({ kind: "private_feedback" });
    expect(routeReviewRating(1, "https://g.page/r/x")).toEqual({ kind: "private_feedback" });
  });

  it("falls back to private feedback when no Google link is configured", () => {
    expect(routeReviewRating(5, null)).toEqual({ kind: "private_feedback" });
  });
});

describe("review request consent + refund hardening (#264 review)", () => {
  it("treats NULL prefersEmail / prefersSms as no consent", () => {
    const customer = { email: "c@example.com", phone: "+15550100", prefersEmail: null, prefersSms: null, doNotContact: false };
    expect(pickReviewChannel(customer, true)).toBeNull();
    expect(decideInvoicePaidReviewRequest(facts({ customer, smsLive: true }))).toEqual({ action: "skip", reason: "no_consented_channel" });
  });

  it("skips paid invoices whose total is zero", () => {
    expect(decideInvoicePaidReviewRequest(facts({ invoiceTotal: "0.00" }))).toEqual({ action: "skip", reason: "invoice_not_paid" });
    expect(decideInvoicePaidReviewRequest(facts({ invoiceTotal: "125.00" })).action).toBe("create");
  });
});
