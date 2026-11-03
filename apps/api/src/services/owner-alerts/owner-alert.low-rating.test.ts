import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob } = vi.hoisted(() => ({ addQueueJob: vi.fn(async () => undefined) }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});
vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});
vi.mock("@fsm/jobs", () => ({
  notificationsQueue: { add: addQueueJob },
  redisConnection: { get: vi.fn(), set: vi.fn(), del: vi.fn() }
}));

type FakeDbModule = typeof import("../../test-support/fake-db.js");
type ServiceModule = typeof import("../review-request.service.js");
type AlertModule = typeof import("./owner-alert.service.js");

let fakeDb: FakeDbModule;
let service: ServiceModule;
let alerts: AlertModule;

beforeAll(async () => {
  fakeDb = await import("../../test-support/fake-db.js");
  service = await import("../review-request.service.js");
  alerts = await import("./owner-alert.service.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  alerts.resetOwnerAlertStateForTests();
  addQueueJob.mockClear();
});

async function seedRequest(config: Record<string, unknown> = {}) {
  const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac", timezone: "America/Chicago", email: "owner@acme.test" });
  fakeDb.seedBookingSettings({ companyId: company.id, bookingSlug: company.slug, isEnabled: true, googleReviewUrl: "https://g.page/r/acme/review" });
  fakeDb.seedAutomationRule({ companyId: company.id, ruleType: "review_request", isEnabled: true, delayHours: 4, config } as never);
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Chris", lastName: "Pine", email: "chris@example.com", phone: "555-0100" });
  const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id });
  const invoice = fakeDb.seedInvoice({ companyId: company.id, customerId: customer.id, jobId: job.id, status: "paid", total: "250.00" });
  await service.requestReviewForPaidInvoice(company.id, invoice.id);
  const [request] = fakeDb.getTestState().reviewRequests;
  addQueueJob.mockClear();
  return { company, request: request! };
}

function ownerAlertCalls() {
  return addQueueJob.mock.calls.filter((call) => (call as unknown[])[0] === "send-owner-alert") as unknown as Array<
    [string, Record<string, unknown>, { jobId: string }]
  >;
}

describe("low rating (<=3) private feedback -> owner alert", () => {
  it("alerts once per review request, without the feedback text", async () => {
    const { request } = await seedRequest();
    const done = await service.completePublicReviewRequest(request.referenceId, { rating: 2, reviewText: "Tech was rude, gate left open" });
    expect(done.routing.kind).toBe("private_feedback");
    let calls = ownerAlertCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toMatchObject({ kind: "low_rating", toEmail: "owner@acme.test", headline: "2-star private feedback", toPhones: [] });
    expect(calls[0]![1].summary).toBe("Chris P. rated you 2/5. Open Review requests to read it and follow up.");
    expect(JSON.stringify(calls[0]![1])).not.toContain("rude");
    expect(String(calls[0]![1].actionUrl)).toMatch(/\/review-requests$/u);
    expect(calls[0]![2].jobId).toBe(`owner-alert-low_rating-${request.id}`);

    await service.completePublicReviewRequest(request.referenceId, { rating: 1 });
    calls = ownerAlertCalls();
    expect(calls).toHaveLength(1);
  });

  it("does not alert for 4-5 star ratings", async () => {
    const { request } = await seedRequest();
    await service.completePublicReviewRequest(request.referenceId, { rating: 4 });
    expect(ownerAlertCalls()).toHaveLength(0);
  });

  it("alerts at exactly 3 stars", async () => {
    const { request } = await seedRequest();
    await service.completePublicReviewRequest(request.referenceId, { rating: 3 });
    expect(ownerAlertCalls()).toHaveLength(1);
  });

  it("is off-able via review_request rule config notifyOwnerOnLowRating=false", async () => {
    const { request } = await seedRequest({ notifyOwnerOnLowRating: false });
    await service.completePublicReviewRequest(request.referenceId, { rating: 1 });
    expect(ownerAlertCalls()).toHaveLength(0);
  });
});
