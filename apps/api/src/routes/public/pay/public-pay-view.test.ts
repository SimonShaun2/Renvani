import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../../test-support/env-setup.js";

setupTestEnv();

const { clientSecretMock } = vi.hoisted(() => ({ clientSecretMock: vi.fn() }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() }
}));

vi.mock("../../../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: vi.fn(),
  expireInvoiceCheckoutSession: vi.fn(),
  retrieveInvoiceCheckoutClientSecret: clientSecretMock
}));

type AppInstance = Awaited<ReturnType<typeof import("../../../app.js")["buildApp"]>>;
let buildApp: typeof import("../../../app.js")["buildApp"];
let fakeDb: typeof import("../../../test-support/fake-db.js");
let dbModule: { db: { select: (...args: unknown[]) => unknown } };
let app: AppInstance;

beforeAll(async () => {
  ({ buildApp } = await import("../../../app.js"));
  fakeDb = await import("../../../test-support/fake-db.js");
  dbModule = (await import("@fsm/db")) as unknown as typeof dbModule;
});

beforeEach(async () => {
  fakeDb.resetTestState();
  clientSecretMock.mockReset();
  clientSecretMock.mockResolvedValue(null);
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

const TOKEN = "a".repeat(40);

function seedGraph(opts: { plan: "flex" | "flat"; onlineBooking: boolean; paid: boolean }) {
  const company = fakeDb.seedCompany({
    name: "Summit Heating & Air",
    slug: "summit",
    timezone: "America/Chicago",
    stripeAccountId: "acct_secret_123",
    website: "https://summit.example",
    logoUrl: "https://cdn.example/logo.png",
    settings: { stripePlatformBilling: { planTier: opts.plan } }
  } as Parameters<typeof fakeDb.seedCompany>[0]);
  const other = fakeDb.seedCompany({ name: "Other Co", slug: "other", timezone: "America/Chicago" });
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: "Dana",
    lastName: "Ruiz",
    email: "dana@example.com",
    internalNotes: "SECRET-NOTE"
  });
  fakeDb.seedCustomer({ companyId: other.id, firstName: "Not", lastName: "Me", email: "other@example.com" });
  const property = fakeDb.seedProperty({
    companyId: company.id,
    customerId: customer.id,
    addressLine1: "12 Oak St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    accessNotes: "SECRET-GATE"
  } as Parameters<typeof fakeDb.seedProperty>[0]);
  const job = fakeDb.seedJob({
    companyId: company.id,
    customerId: customer.id,
    propertyId: property.id,
    title: "Tune-up",
    status: "completed",
    techNotes: "SECRET-TECH",
    scheduledStart: new Date("2026-10-20T15:00:00Z"),
    tags: []
  } as Parameters<typeof fakeDb.seedJob>[0]);
  if (opts.onlineBooking) {
    fakeDb.seedBookingRequest({
      companyId: company.id,
      jobId: job.id,
      firstName: "Dana",
      lastName: "Ruiz",
      phone: "555-0101",
      addressLine1: "12 Oak St",
      city: "Austin",
      state: "TX",
      zip: "78701"
    });
  }
  const invoice = fakeDb.seedInvoice({
    companyId: company.id,
    customerId: customer.id,
    jobId: job.id,
    invoiceNumber: "INV-1042",
    status: opts.paid ? "paid" : "sent",
    total: "100.00",
    balanceDue: opts.paid ? "0.00" : "100.00",
    dueAt: new Date("2026-10-30T05:00:00Z"),
    internalNotes: "SECRET-INVOICE",
    paymentToken: TOKEN,
    stripePaymentLinkId: "cs_test_x",
    stripePaymentLinkUrl: `https://app.test/pay/${TOKEN}`
  } as Parameters<typeof fakeDb.seedInvoice>[0]);
  fakeDb.seedInvoiceItem({
    companyId: company.id,
    invoiceId: invoice.id,
    name: "Furnace tune-up",
    quantity: "1.000",
    unitPrice: "100.00",
    total: "100.00"
  } as Parameters<typeof fakeDb.seedInvoiceItem>[0]);
  if (opts.paid) {
    const serviceFee = opts.plan === "flex" ? "2.00" : "0.00";
    fakeDb.seedPayment({
      companyId: company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "100.00",
      serviceFeeAmount: serviceFee,
      bookingFeeAmount: opts.onlineBooking ? "1.99" : "0.00",
      method: "card",
      status: "succeeded",
      stripePaymentIntentId: "pi_secret_1",
      stripeChargeId: "ch_secret_1",
      notes: "SECRET-PAYMENT",
      paidAt: new Date("2026-10-26T18:00:00Z")
    } as Parameters<typeof fakeDb.seedPayment>[0]);
  }
  return { ids: [company.id, other.id, customer.id, property.id, job.id, invoice.id] };
}

const FORBIDDEN_VALUE = /acct_|pi_secret|ch_secret|SECRET-|other@example|sk_/;

function walk(value: unknown, path: string, found: string[], ids: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`, found, ids));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/(^id$|Id$|_id$)/.test(key)) {
        found.push(`${path}.${key}`);
      }
      walk(child, `${path}.${key}`, found, ids);
    }
    return;
  }
  if (typeof value === "string" && (FORBIDDEN_VALUE.test(value) || ids.some((id) => value.includes(id)))) {
    found.push(`${path}=${value}`);
  }
}

function assertPayerSafe(body: unknown, ids: string[]) {
  const found: string[] = [];
  walk(body, "$", found, ids);
  expect(found).toEqual([]);
}

describe("public pay view fields", () => {
  it("GET /:token adds payer-safe fields, keeps legacy keys, no ids or secrets", async () => {
    const { ids } = seedGraph({ plan: "flex", onlineBooking: false, paid: false });
    const response = await request(app.server).get(`/api/v1/public/pay/${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      invoiceNumber: "INV-1042",
      invoiceAmount: "100.00",
      serviceFeeAmount: "2.00",
      bookingFeeAmount: "0.00",
      totalDue: "102.00",
      platformFeeAmount: "2.00"
    });
    expect(response.body).toMatchObject({
      shopName: "Summit Heating & Air",
      shopLogoUrl: "https://cdn.example/logo.png",
      shopUrl: "https://summit.example",
      statementDescriptor: expect.any(String),
      customerName: "Dana Ruiz",
      serviceAddress: "12 Oak St",
      serviceDate: "2026-10-20T15:00:00.000Z",
      dueAt: "2026-10-30T05:00:00.000Z",
      lineItems: [{ description: "Furnace tune-up", quantity: "1.000", unit: "100.00", total: "100.00" }],
      invoiceStatus: "sent",
      paymentStatus: null,
      paidAmount: null,
      paidAt: null,
      receiptEmail: "d•••@example.com",
      plan: "flex",
      serviceFeeCents: 200,
      bookingFeeCents: 0
    });
    expect(response.body.fields).toBeUndefined();
    expect(response.body.cardBrand).toBeUndefined();
    expect(response.body.cardLast4).toBeUndefined();
    assertPayerSafe(response.body, ids);
  });

  it("receipt: Flex paid online-booked shows Service Fee + $1.99 booking fee split; no card fields", async () => {
    const { ids } = seedGraph({ plan: "flex", onlineBooking: true, paid: true });
    const response = await request(app.server).get(`/api/v1/public/pay/${TOKEN}/receipt`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      invoiceStatus: "paid",
      paymentStatus: "succeeded",
      paidAmount: "103.99",
      paidAt: "2026-10-26T18:00:00.000Z",
      serviceFeeLabel: "Service Fee (2%)",
      serviceFeeAmount: "2.00",
      serviceFeeCents: 200,
      bookingFeeAmount: "1.99",
      bookingFeeCents: 199,
      feeRefundable: false
    });
    assertPayerSafe(response.body, ids);
    // Legacy receipt keys unchanged.
    expect(Object.keys(response.body)).toEqual(expect.arrayContaining([
      "invoiceNumber", "totalDue", "invoiceAmount", "platformFeeAmount", "receiptPortalUrl", "pdfDownloadUrl", "brandName"
    ]));
  });

  it("receipt: Flat has no Service Fee; no booking fee when not online-booked; no card fields", async () => {
    seedGraph({ plan: "flat", onlineBooking: false, paid: true });
    const response = await request(app.server).get(`/api/v1/public/pay/${TOKEN}/receipt`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      plan: "flat",
      paidAmount: "100.00",
      serviceFeeLabel: null,
      serviceFeeAmount: "0.00",
      serviceFeeCents: 0,
      bookingFeeAmount: "0.00",
      bookingFeeCents: 0,
      feeRefundable: false
    });
  });

  it("loads the view with a bounded number of queries (no N+1)", async () => {
    seedGraph({ plan: "flex", onlineBooking: true, paid: true });
    const spy = vi.spyOn(dbModule.db, "select");
    const response = await request(app.server).get(`/api/v1/public/pay/${TOKEN}`);
    expect(response.status).toBe(200);
    // invoice + (company, customer, job, items, latest payment) + property + booking-origin lookup
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(8);
    spy.mockRestore();
  });

  it("invalid, unknown and cross-tenant tokens return the same error bodies as before", async () => {
    seedGraph({ plan: "flex", onlineBooking: false, paid: false });
    const short = await request(app.server).get("/api/v1/public/pay/short");
    expect(short.status).toBe(400);
    expect(Object.keys(short.body).sort()).toEqual(["error", "message", "requestId"]);
    expect(short.body.error).toBe("VALIDATION_ERROR");

    for (const path of [`/api/v1/public/pay/${"b".repeat(40)}`, `/api/v1/public/pay/${"b".repeat(40)}/receipt`]) {
      const unknown = await request(app.server).get(path);
      expect(unknown.status).toBe(404);
      expect(unknown.body).toEqual({ error: "NOT_FOUND", message: "Invoice not found", requestId: expect.any(String) });
    }

    // Cross-tenant: an invoice whose customer row belongs to another company must not leak that customer.
    const tenantA = fakeDb.seedCompany({ name: "Tenant A", slug: "tenant-a", timezone: "America/Chicago" });
    const tenantB = fakeDb.seedCompany({ name: "Tenant B", slug: "tenant-b", timezone: "America/Chicago" });
    const foreignCustomer = fakeDb.seedCustomer({ companyId: tenantB.id, firstName: "Foreign", lastName: "Person", email: "foreign@example.com" });
    const crossToken = "c".repeat(40);
    fakeDb.seedInvoice({
      companyId: tenantA.id,
      customerId: foreignCustomer.id,
      status: "sent",
      total: "10.00",
      balanceDue: "10.00",
      paymentToken: crossToken,
      stripePaymentLinkId: "cs_test_cross",
      stripePaymentLinkUrl: `https://app.test/pay/${crossToken}`
    } as Parameters<typeof fakeDb.seedInvoice>[0]);
    const cross = await request(app.server).get(`/api/v1/public/pay/${crossToken}`);
    expect(cross.status).toBe(200);
    expect(cross.body).toMatchObject({ shopName: "Tenant A", customerName: null, receiptEmail: null });
    expect(JSON.stringify(cross.body)).not.toMatch(/Foreign|foreign@|Tenant B/);
    assertPayerSafe(cross.body, [tenantA.id, tenantB.id, foreignCustomer.id]);
  });
});
