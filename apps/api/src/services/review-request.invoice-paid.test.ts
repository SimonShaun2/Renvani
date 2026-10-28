import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob } = vi.hoisted(() => ({ addQueueJob: vi.fn() }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: { add: addQueueJob },
  redisConnection: { get: vi.fn(), set: vi.fn(), del: vi.fn() }
}));

type FakeDbModule = typeof import("../test-support/fake-db.js");
type ServiceModule = typeof import("./review-request.service.js");
type RegistryModule = typeof import("./automation/event-automation.registry.js");

let fakeDb: FakeDbModule;
let service: ServiceModule;
let registry: RegistryModule;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  service = await import("./review-request.service.js");
  registry = await import("./automation/event-automation.registry.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  addQueueJob.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T14:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function seed(options: { ruleEnabled?: boolean; customer?: Record<string, unknown> } = {}) {
  const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac", timezone: "America/Chicago" });
  fakeDb.seedBookingSettings({
    companyId: company.id,
    bookingSlug: company.slug,
    isEnabled: true,
    googleReviewUrl: "https://g.page/r/acme/review"
  });
  fakeDb.seedAutomationRule({
    companyId: company.id,
    ruleType: "review_request",
    isEnabled: options.ruleEnabled ?? true,
    delayHours: 4
  });
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: "Chris",
    lastName: "Pine",
    email: "chris@example.com",
    phone: "555-0100",
    ...options.customer
  });
  const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id });
  const invoice = fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id, jobId: job.id, status: "paid" });
  return { company, customer, job, invoice };
}

describe("invoice.paid -> review request automation", () => {
  it("registers invoice.paid in the event-to-automation registry", () => {
    expect(registry.listEventAutomations("invoice.paid").map((entry) => entry.id)).toContain(
      registry.INVOICE_PAID_REVIEW_REQUEST_AUTOMATION_ID
    );
  });

  it("creates one review request via the existing table/job and is idempotent on replays", async () => {
    const { company, invoice } = seed();

    const first = await service.requestReviewForPaidInvoice(company.id, invoice.id);
    expect(first).toMatchObject({ status: "queued", channel: "email" });
    expect(addQueueJob).toHaveBeenCalledWith(
      "send-review-request",
      expect.objectContaining({ channel: "email", customerEmail: "chris@example.com", invoiceId: invoice.id }),
      { jobId: `review-request-invoice-${invoice.id}`, delay: 4 * 3600_000 }
    );

    await registry.dispatchEventAutomation({ eventType: "invoice.paid", companyId: company.id, invoiceId: invoice.id });
    const replay = await service.requestReviewForPaidInvoice(company.id, invoice.id);
    expect(replay).toEqual({ status: "skipped", reason: "already_requested_for_invoice" });
    expect(fakeDb.getTestState().reviewRequests).toHaveLength(1);
    expect(addQueueJob).toHaveBeenCalledTimes(1);
    const sent = fakeDb.getTestState().activityEvents.filter((event) => event.eventType === "review_request.sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ invoiceId: invoice.id, actorType: "system" });
  });

  it("does nothing while the review_request rule is disabled (owner opt-in)", async () => {
    const { company, invoice } = seed({ ruleEnabled: false });
    await expect(service.requestReviewForPaidInvoice(company.id, invoice.id)).resolves.toEqual({
      status: "skipped",
      reason: "rule_disabled"
    });
    expect(addQueueJob).not.toHaveBeenCalled();
  });

  it("respects do-not-contact and email opt-out (SMS stays off while the stub is selected)", async () => {
    const dnc = seed({ customer: { doNotContact: true } });
    await expect(service.requestReviewForPaidInvoice(dnc.company.id, dnc.invoice.id)).resolves.toMatchObject({
      reason: "do_not_contact"
    });
    fakeDb.resetTestState();
    const noEmail = seed({ customer: { prefersEmail: false } });
    await expect(service.requestReviewForPaidInvoice(noEmail.company.id, noEmail.invoice.id)).resolves.toMatchObject({
      reason: "no_consented_channel"
    });
    expect(addQueueJob).not.toHaveBeenCalled();
  });

  it("rate limits the same customer across invoices", async () => {
    const { company, customer, invoice } = seed();
    await service.requestReviewForPaidInvoice(company.id, invoice.id);
    const second = fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id, status: "paid" });
    await expect(service.requestReviewForPaidInvoice(company.id, second.id)).resolves.toEqual({
      status: "skipped",
      reason: "customer_rate_limited"
    });
  });

  it("routes completion: 5 stars -> Google link, 2 stars -> private feedback", async () => {
    const { company, customer, invoice } = seed();
    await service.requestReviewForPaidInvoice(company.id, invoice.id);
    const [request] = fakeDb.getTestState().reviewRequests;
    const high = await service.completePublicReviewRequest(request!.referenceId, { rating: 5 });
    expect(high.routing).toEqual({ kind: "public_review", platform: "google", url: "https://g.page/r/acme/review" });
    const low = await service.completePublicReviewRequest(request!.referenceId, { rating: 2, reviewText: "Late" });
    expect(low.routing).toEqual({ kind: "private_feedback" });
    expect(low.reviewText).toBe("Late");
    expect(customer.id).toBe(request!.customerId);
  });

  it("dispatch never throws into the payment path", async () => {
    await expect(
      registry.dispatchEventAutomation({ eventType: "invoice.paid", companyId: "missing", invoiceId: "missing" })
    ).resolves.toBeUndefined();
  });
});
