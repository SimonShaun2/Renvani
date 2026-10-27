import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const {
  addAiQueueJob,
  addInvoiceQueueJob,
  addNotificationQueueJob,
  createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSessionMock
} = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  addInvoiceQueueJob: vi.fn(),
  addNotificationQueueJob: vi.fn(),
  createInvoiceCheckoutSessionMock: vi.fn(),
  expireInvoiceCheckoutSessionMock: vi.fn()
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: addAiQueueJob
  },
  invoicesQueue: {
    add: addInvoiceQueueJob
  },
  notificationsQueue: {
    add: addNotificationQueueJob
  }
}));

vi.mock("../../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSession: expireInvoiceCheckoutSessionMock
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  addInvoiceQueueJob.mockReset();
  addNotificationQueueJob.mockReset();
  createInvoiceCheckoutSessionMock.mockReset();
  expireInvoiceCheckoutSessionMock.mockReset();
  createInvoiceCheckoutSessionMock.mockResolvedValue({
    id: "cs_test_123",
    url: null,
    clientSecret: "cs_test_client_secret"
  });
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createAuthContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago",
    stripeAccountId: "acct_123"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return {
    company,
    user,
    authorization: `Bearer ${accessToken}`
  };
}

function seedInvoiceGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    email: "chris@example.com",
    phone: "555-0100",
    lifetimeValue: "50.00"
  });
  const job = fakeDb.seedJob({
    companyId,
    customerId: customer.id,
    title: "Spring Tune-Up",
    status: "completed"
  });
  const estimate = fakeDb.seedEstimate({
    companyId,
    customerId: customer.id,
    jobId: job.id,
    title: "Approved Estimate",
    status: "approved"
  });
  fakeDb.seedEstimateItem({
    companyId,
    estimateId: estimate.id,
    name: "Labor",
    quantity: "2.000",
    unitPrice: "100.00",
    total: "200.00"
  });

  return { customer, job, estimate };
}

describe("invoice routes", () => {
  it("GET /invoices returns paginated results", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      total: "100.00",
      amountPaid: "0.00",
      balanceDue: "100.00"
    });

    const response = await request(app.server)
      .get("/api/v1/invoices")
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].invoiceNumber).toBe("INV-0001");
  });

  it("POST /invoices supports success, validation failure, unknown customer, and missing auth", async () => {
    const auth = createAuthContext();
    const { customer, estimate } = seedInvoiceGraph(auth.company.id);

    const successResponse = await request(app.server)
      .post("/api/v1/invoices")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        fromEstimateId: estimate.id,
        taxRate: 0.1,
        discountAmount: 5
      });
    const validationResponse = await request(app.server)
      .post("/api/v1/invoices")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        taxRate: 2
      });
    const unknownCustomerResponse = await request(app.server)
      .post("/api/v1/invoices")
      .set("Authorization", auth.authorization)
      .send({
        customerId: randomUUID(),
        title: "Unknown Customer"
      });
    const unauthorizedResponse = await request(app.server)
      .post("/api/v1/invoices")
      .send({
        customerId: customer.id,
        title: "No Auth"
      });

    expect(successResponse.status).toBe(201);
    expect(successResponse.body.invoice.invoiceNumber).toBe("INV-0001");
    expect(successResponse.body.invoice.items).toHaveLength(1);
    expect(validationResponse.status).toBe(400);
    expect(unknownCustomerResponse.status).toBe(404);
    expect(unauthorizedResponse.status).toBe(401);
  });

  it("GET /invoices/:id returns detail with items and payments", async () => {
    const auth = createAuthContext();
    const { customer, job } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      jobId: job.id,
      invoiceNumber: "INV-0001",
      total: "325.00",
      subtotal: "300.00",
      amountPaid: "25.00",
      balanceDue: "300.00"
    });
    fakeDb.seedInvoiceItem({
      companyId: auth.company.id,
      invoiceId: invoice.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "300.00",
      total: "300.00"
    });
    fakeDb.seedPayment({
      companyId: auth.company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "25.00",
      method: "cash",
      status: "succeeded"
    });

    const response = await request(app.server)
      .get(`/api/v1/invoices/${invoice.id}`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.invoice.items).toHaveLength(1);
    expect(response.body.invoice.payments).toHaveLength(1);
  });

  it("PATCH /invoices/:id succeeds on drafts and returns 409 on sent invoices", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const draftInvoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "draft",
      total: "200.00",
      subtotal: "200.00",
      balanceDue: "200.00"
    });
    fakeDb.seedInvoiceItem({
      companyId: auth.company.id,
      invoiceId: draftInvoice.id,
      name: "Service",
      quantity: "2.000",
      unitPrice: "100.00",
      total: "200.00"
    });
    const sentInvoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent"
    });

    const successResponse = await request(app.server)
      .patch(`/api/v1/invoices/${draftInvoice.id}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Updated Invoice",
        discountAmount: 10
      });
    const conflictResponse = await request(app.server)
      .patch(`/api/v1/invoices/${sentInvoice.id}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Nope"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.invoice.title).toBe("Updated Invoice");
    expect(conflictResponse.status).toBe(409);
  });

  it("invoice item routes add, update, and delete line items", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "draft"
    });

    const addResponse = await request(app.server)
      .post(`/api/v1/invoices/${invoice.id}/items`)
      .set("Authorization", auth.authorization)
      .send({
        name: "Labor",
        quantity: 2,
        unitPrice: 50
      });
    const itemId = addResponse.body.item.id as string;
    const updateResponse = await request(app.server)
      .patch(`/api/v1/invoices/${invoice.id}/items/${itemId}`)
      .set("Authorization", auth.authorization)
      .send({
        quantity: 3
      });
    const deleteResponse = await request(app.server)
      .delete(`/api/v1/invoices/${invoice.id}/items/${itemId}`)
      .set("Authorization", auth.authorization);

    expect(addResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.item.total).toBe("150.00");
    expect(deleteResponse.status).toBe(204);
  });

  it("POST /invoices/:id/send stores a hosted payment link and enqueues work", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "draft",
      total: "175.00",
      subtotal: "175.00",
      balanceDue: "175.00"
    });
    fakeDb.seedInvoiceItem({
      companyId: auth.company.id,
      invoiceId: invoice.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "175.00",
      total: "175.00"
    });

    const response = await request(app.server)
      .post(`/api/v1/invoices/${invoice.id}/send`)
      .set("Authorization", auth.authorization)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.invoice.stripePaymentLinkUrl).toContain("/pay/");
    expect(createInvoiceCheckoutSessionMock).toHaveBeenCalledTimes(1);
    expect(addNotificationQueueJob).toHaveBeenCalledTimes(1);
    expect(addInvoiceQueueJob).toHaveBeenCalledTimes(1);
  });

  it("POST /invoices/:id/record-payment updates invoice balance", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      total: "200.00",
      amountPaid: "0.00",
      balanceDue: "200.00"
    });

    const response = await request(app.server)
      .post(`/api/v1/invoices/${invoice.id}/record-payment`)
      .set("Authorization", auth.authorization)
      .send({
        amount: 75,
        method: "cash"
      });

    expect(response.status).toBe(200);
    expect(response.body.payment.amount).toBe("75.00");
    expect(response.body.invoice.balanceDue).toBe("125.00");
  });

  it("POST /invoices/:id/void succeeds and rejects paid invoices", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const sentInvoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent",
      stripePaymentLinkId: "cs_test_123"
    });
    const paidInvoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "paid"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/invoices/${sentInvoice.id}/void`)
      .set("Authorization", auth.authorization)
      .send({
        reason: "Customer cancelled"
      });
    const conflictResponse = await request(app.server)
      .post(`/api/v1/invoices/${paidInvoice.id}/void`)
      .set("Authorization", auth.authorization)
      .send({
        reason: "Too late"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.invoice.status).toBe("void");
    expect(conflictResponse.status).toBe(409);
  });

  it("GET /invoices/:id/payments returns invoice payments", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id
    });
    fakeDb.seedPayment({
      companyId: auth.company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "25.00",
      method: "cash",
      status: "succeeded"
    });

    const response = await request(app.server)
      .get(`/api/v1/invoices/${invoice.id}/payments`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.payments).toHaveLength(1);
  });

  it("GET /payments returns a paginated company payment list", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id
    });
    fakeDb.seedPayment({
      companyId: auth.company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "100.00",
      method: "cash",
      status: "succeeded"
    });

    const response = await request(app.server)
      .get("/api/v1/payments")
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].amount).toBe("100.00");
  });

  it("GET /payments exposes fee fields; refunds leave the non-refundable fees", async () => {
    const auth = createAuthContext();
    const { customer } = seedInvoiceGraph(auth.company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: auth.company.id,
      customerId: customer.id
    });
    fakeDb.seedPayment({
      companyId: auth.company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "100.00",
      serviceFeeAmount: "2.00",
      bookingFeeAmount: "1.99",
      amountRefunded: "100.00",
      method: "card",
      status: "refunded"
    });

    const response = await request(app.server)
      .get("/api/v1/payments")
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      amount: "100.00",
      serviceFeeAmount: "2.00",
      bookingFeeAmount: "1.99",
      feeRefundable: false,
      amountRefunded: "100.00",
      refundableAmount: "0.00"
    });
  });
});
