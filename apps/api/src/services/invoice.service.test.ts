import { randomUUID } from "node:crypto";

import type Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

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
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
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

vi.mock("../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: createInvoiceCheckoutSessionMock,
  retrieveInvoiceCheckoutClientSecret: vi.fn(async () => null),
  expireInvoiceCheckoutSession: expireInvoiceCheckoutSessionMock
}));

type InvoiceServiceModule = typeof import("./invoice.service.js");
type InvoiceItemsServiceModule = typeof import("./invoice-items.service.js");
type PaymentServiceModule = typeof import("./payment.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let invoiceService: InvoiceServiceModule;
let invoiceItemsService: InvoiceItemsServiceModule;
let paymentService: PaymentServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  invoiceService = await import("./invoice.service.js");
  invoiceItemsService = await import("./invoice-items.service.js");
  paymentService = await import("./payment.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
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
});

function createAdminContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago",
    stripeAccountId: "acct_123"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });

  return { company, actor };
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
    total: "325.00",
    subtotal: "300.00",
    status: "approved"
  });
  fakeDb.seedEstimateItem({
    companyId,
    estimateId: estimate.id,
    name: "Labor",
    quantity: "2.000",
    unitPrice: "100.00",
    total: "200.00",
    sortOrder: 1
  });
  fakeDb.seedEstimateItem({
    companyId,
    estimateId: estimate.id,
    name: "Material",
    quantity: "1.000",
    unitPrice: "100.00",
    total: "100.00",
    isTaxable: false,
    sortOrder: 2
  });

  return { customer, job, estimate };
}

describe("invoice.service", () => {
  it("listInvoices paginates and filters by status, customer, and invoice number search", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const otherCustomer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Jamie",
      lastName: "Miles"
    });

    fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      total: "450.00",
      amountPaid: "50.00",
      balanceDue: "400.00",
      createdAt: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedInvoice({
      companyId: company.id,
      customerId: otherCustomer.id,
      invoiceNumber: "INV-0002",
      status: "draft",
      total: "250.00",
      amountPaid: "0.00",
      balanceDue: "250.00",
      createdAt: new Date("2026-04-28T10:00:00.000Z")
    });

    const filtered = await invoiceService.listInvoices(company.id, {
      status: "sent",
      customerId: customer.id,
      search: "0001"
    });
    const paginated = await invoiceService.listInvoices(company.id, {
      page: 2,
      limit: 1
    });

    expect(filtered.total).toBe(1);
    expect(filtered.data[0]?.invoiceNumber).toBe("INV-0001");
    expect(paginated.total).toBe(2);
    expect(paginated.page).toBe(2);
    expect(paginated.data).toHaveLength(1);
    expect(paginated.data[0]?.invoiceNumber).toBe("INV-0001");
  });

  it("getInvoice returns detail with items and payments and rejects unknown or cross-tenant ids", async () => {
    const { company } = createAdminContext();
    const { customer, job } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      jobId: job.id,
      invoiceNumber: "INV-0001",
      total: "325.00",
      subtotal: "300.00",
      amountPaid: "25.00",
      balanceDue: "300.00"
    });
    fakeDb.seedInvoiceItem({
      companyId: company.id,
      invoiceId: invoice.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "300.00",
      total: "300.00"
    });
    fakeDb.seedPayment({
      companyId: company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "25.00",
      method: "cash",
      status: "succeeded"
    });

    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });
    const otherCustomer = fakeDb.seedCustomer({
      companyId: otherCompany.id,
      firstName: "Other",
      lastName: "Customer"
    });
    const otherInvoice = fakeDb.seedInvoice({
      companyId: otherCompany.id,
      customerId: otherCustomer.id
    });

    const detail = await invoiceService.getInvoice(company.id, invoice.id);

    expect(detail.customer.email).toBe("chris@example.com");
    expect(detail.job?.jobNumber).toBe(job.jobNumber);
    expect(detail.items).toHaveLength(1);
    expect(detail.payments).toHaveLength(1);

    await expect(invoiceService.getInvoice(company.id, randomUUID())).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
    await expect(invoiceService.getInvoice(company.id, otherInvoice.id)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("createInvoice calculates totals and copies estimate items when created from an estimate", async () => {
    const { company, actor } = createAdminContext();
    const { customer, estimate } = seedInvoiceGraph(company.id);

    const created = await invoiceService.createInvoice(company.id, actor.id, {
      customerId: customer.id,
      fromEstimateId: estimate.id,
      taxRate: 0.1,
      discountAmount: 5
    });

    expect(created.invoiceNumber).toBe("INV-0001");
    expect(created.status).toBe("draft");
    expect(created.subtotal).toBe("300.00");
    expect(created.taxAmount).toBe("20.00");
    expect(created.total).toBe("315.00");
    expect(created.balanceDue).toBe("315.00");
    expect(fakeDb.getTestState().invoiceItems.filter((row) => row.invoiceId === created.id)).toHaveLength(2);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("invoice.created");
  });

  it("updateInvoice succeeds for drafts and rejects sent invoices", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const draftInvoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      taxRate: "0.0500",
      subtotal: "200.00",
      taxAmount: "10.00",
      discountAmount: "0.00",
      total: "210.00",
      balanceDue: "210.00",
      status: "draft"
    });
    fakeDb.seedInvoiceItem({
      companyId: company.id,
      invoiceId: draftInvoice.id,
      name: "Service",
      quantity: "2.000",
      unitPrice: "100.00",
      total: "200.00"
    });

    const updated = await invoiceService.updateInvoice(company.id, actor.id, draftInvoice.id, {
      title: "Updated Draft Invoice",
      discountAmount: 10
    });

    expect(updated.title).toBe("Updated Draft Invoice");
    expect(updated.discountAmount).toBe("10.00");
    expect(updated.total).toBe("200.00");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("invoice.updated");

    const sentInvoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      status: "sent"
    });

    await expect(
      invoiceService.updateInvoice(company.id, actor.id, sentInvoice.id, {
        title: "Nope"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("invoice item services add, update, remove, and recalculate totals while preserving amountPaid in balanceDue", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      status: "draft",
      taxRate: "0.0825",
      discountAmount: "10.00",
      amountPaid: "50.00",
      balanceDue: "0.00"
    });

    const added = await invoiceItemsService.addItem(company.id, invoice.id, {
      name: "Labor",
      quantity: 2,
      unitPrice: 100,
      sortOrder: 1
    });
    const second = await invoiceItemsService.addItem(company.id, invoice.id, {
      name: "Material",
      quantity: 1,
      unitPrice: 50,
      isTaxable: false,
      sortOrder: 2
    });
    const updated = await invoiceItemsService.updateItem(company.id, invoice.id, added.id, {
      quantity: 3,
      unitPrice: 80
    });

    expect(updated.total).toBe("240.00");

    await invoiceItemsService.recalculateTotals(
      invoice.id,
      fakeDb.db as unknown as Parameters<InvoiceItemsServiceModule["recalculateTotals"]>[1]
    );
    const recalculatedInvoice = fakeDb.getTestState().invoices.find((row) => row.id === invoice.id);
    expect(recalculatedInvoice?.subtotal).toBe("290.00");
    expect(recalculatedInvoice?.taxAmount).toBe("19.80");
    expect(recalculatedInvoice?.total).toBe("299.80");
    expect(recalculatedInvoice?.balanceDue).toBe("249.80");

    await invoiceItemsService.removeItem(company.id, invoice.id, second.id);
    const removedItem = fakeDb.getTestState().invoiceItems.find((row) => row.id === second.id);
    expect(removedItem?.deletedAt).toBeInstanceOf(Date);
  });

  it("sendInvoice creates a hosted checkout session, stores the link, and enqueues notification plus overdue check", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "draft",
      total: "175.00",
      subtotal: "175.00",
      balanceDue: "175.00",
      messageToCustomer: "Please pay online."
    });
    fakeDb.seedInvoiceItem({
      companyId: company.id,
      invoiceId: invoice.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "175.00",
      total: "175.00"
    });

    const sent = await invoiceService.sendInvoice(company.id, actor.id, invoice.id);

    expect(sent.status).toBe("sent");
    expect(sent.stripePaymentLinkId).toBe("cs_test_123");
    expect(sent.stripePaymentLinkUrl).toContain("/pay/");
    expect(createInvoiceCheckoutSessionMock).toHaveBeenCalledTimes(1);
    expect(addNotificationQueueJob).toHaveBeenCalledWith(
      "send-invoice-email",
      {
        companyId: company.id,
        invoiceId: invoice.id,
        customerId: customer.id
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
    expect(addInvoiceQueueJob).toHaveBeenCalledTimes(1);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("invoice.sent");
  });

  it("recordPayment fully pays an invoice and updates customer lifetime value", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      total: "200.00",
      amountPaid: "0.00",
      balanceDue: "200.00"
    });

    const payment = await invoiceService.recordPayment(company.id, actor.id, invoice.id, {
      amount: 200,
      method: "cash"
    });

    const updatedInvoice = fakeDb.getTestState().invoices.find((row) => row.id === invoice.id);
    const updatedCustomer = fakeDb.getTestState().customers.find((row) => row.id === customer.id);

    expect(payment.status).toBe("succeeded");
    expect(updatedInvoice?.status).toBe("paid");
    expect(updatedInvoice?.amountPaid).toBe("200.00");
    expect(updatedInvoice?.balanceDue).toBe("0.00");
    expect(updatedCustomer?.lifetimeValue).toBe("250.00");
    expect(fakeDb.getTestState().activityEvents.at(-2)?.eventType).toBe("payment.received");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("invoice.paid");
  });

  it("recordPayment partially pays an invoice and transitions it to partially_paid", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      status: "sent",
      total: "200.00",
      amountPaid: "0.00",
      balanceDue: "200.00"
    });

    await invoiceService.recordPayment(company.id, actor.id, invoice.id, {
      amount: 75,
      method: "check",
      checkNumber: "1234"
    });

    const updatedInvoice = fakeDb.getTestState().invoices.find((row) => row.id === invoice.id);
    expect(updatedInvoice?.status).toBe("partially_paid");
    expect(updatedInvoice?.amountPaid).toBe("75.00");
    expect(updatedInvoice?.balanceDue).toBe("125.00");
  });

  it("voidInvoice succeeds for sent invoices and rejects paid invoices", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const sentInvoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      stripePaymentLinkId: "cs_test_123"
    });

    const voided = await invoiceService.voidInvoice(company.id, actor.id, sentInvoice.id, "Customer cancelled");

    expect(voided.status).toBe("void");
    expect(expireInvoiceCheckoutSessionMock).toHaveBeenCalledWith("cs_test_123");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("invoice.void");

    const paidInvoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      status: "paid"
    });

    await expect(invoiceService.voidInvoice(company.id, actor.id, paidInvoice.id, "Nope")).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("markOverdue transitions sent invoices, checks automation rules, and silently ignores already paid invoices", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const sentInvoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      dueAt: new Date("2026-04-01T00:00:00.000Z")
    });
    fakeDb.seedAutomationRule({
      companyId: company.id,
      ruleType: "invoice_overdue",
      isEnabled: true
    });

    const overdue = await invoiceService.markOverdue(company.id, sentInvoice.id);

    expect(overdue.status).toBe("overdue");
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "invoice-recovery-check",
      {
        companyId: company.id,
        invoiceId: sentInvoice.id,
        customerId: customer.id
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );

    const paidInvoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      status: "paid",
      dueAt: new Date("2026-04-01T00:00:00.000Z")
    });

    const unchanged = await invoiceService.markOverdue(company.id, paidInvoice.id);
    expect(unchanged.status).toBe("paid");
  });

  it("handleStripePaymentSuccess is idempotent and updates invoice balances once", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent",
      total: "150.00",
      amountPaid: "0.00",
      balanceDue: "150.00"
    });

    const event = {
      data: {
        object: {
          id: "pi_123",
          amount: 15000,
          amount_received: 15000,
          latest_charge: "ch_123",
          metadata: {
            invoiceId: invoice.id
          },
          payment_method_types: ["card"]
        }
      }
    } as unknown as Stripe.PaymentIntentSucceededEvent;

    await invoiceService.handleStripePaymentSuccess(event);
    await invoiceService.handleStripePaymentSuccess(event);

    const storedPayments = fakeDb.getTestState().payments.filter((row) => row.invoiceId === invoice.id);
    const updatedInvoice = fakeDb.getTestState().invoices.find((row) => row.id === invoice.id);

    expect(storedPayments).toHaveLength(1);
    expect(updatedInvoice?.status).toBe("paid");
    expect(updatedInvoice?.amountPaid).toBe("150.00");
    expect(updatedInvoice?.balanceDue).toBe("0.00");
  });

  it("handleStripePaymentSuccess records Service Fee and booking fee as separate non-refundable lines", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0002",
      status: "sent",
      total: "150.00",
      amountPaid: "0.00",
      balanceDue: "150.00"
    });

    const event = {
      data: {
        object: {
          id: "pi_fees",
          amount: 15_499,
          amount_received: 15_499,
          latest_charge: "ch_fees",
          metadata: {
            invoiceId: invoice.id,
            invoiceAmountCents: "15000",
            serviceFeeCents: "300",
            bookingFeeCents: "199"
          },
          payment_method_types: ["card"]
        }
      }
    } as unknown as Stripe.PaymentIntentSucceededEvent;

    await invoiceService.handleStripePaymentSuccess(event);

    const payment = fakeDb.getTestState().payments.find((row) => row.invoiceId === invoice.id);
    const updatedInvoice = fakeDb.getTestState().invoices.find((row) => row.id === invoice.id);

    expect(payment?.amount).toBe("150.00");
    expect(payment?.serviceFeeAmount).toBe("3.00");
    expect(payment?.bookingFeeAmount).toBe("1.99");
    expect(payment?.feeRefundable).toBe(false);
    // Fees never touch invoice total/balance.
    expect(updatedInvoice?.status).toBe("paid");
    expect(updatedInvoice?.total).toBe("150.00");
    expect(updatedInvoice?.amountPaid).toBe("150.00");
    expect(updatedInvoice?.balanceDue).toBe("0.00");
    expect(updatedInvoice?.serviceFeeAmount).toBe("3.00");
    expect(updatedInvoice?.bookingFeeAmount).toBe("1.99");
  });

  it("readCheckoutFeesFromIntent treats legacy intents without fee metadata as fee-free", () => {
    expect(
      invoiceService.readCheckoutFeesFromIntent({ amount: 15_000, amount_received: 15_000, metadata: { invoiceId: "x" } })
    ).toEqual({ invoiceAmountCents: 15_000, serviceFeeCents: 0, bookingFeeCents: 0 });
  });

  it("recordPayment (manual, non-checkout) charges no fees", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      status: "sent",
      total: "200.00",
      amountPaid: "0.00",
      balanceDue: "200.00"
    });

    const payment = await invoiceService.recordPayment(company.id, actor.id, invoice.id, {
      amount: 200,
      method: "cash"
    });

    expect(payment.serviceFeeAmount).toBe("0.00");
    expect(payment.bookingFeeAmount).toBe("0.00");
    expect(payment.feeRefundable).toBe(false);
    expect(payment.refundableAmount).toBe("200.00");
  });

  it("sendInvoice flags online-booked invoices for the booking fee (every plan, incl. Flat)", async () => {
    const { company, actor } = createAdminContext();
    company.stripeAccountId = "acct_123";
    company.settings = { stripePlatformBilling: { planTier: "flat" } } as typeof company.settings;
    const { customer } = seedInvoiceGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Online booked",
      status: "completed",
      tags: ["online_booking"]
    });
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      jobId: job.id,
      status: "draft",
      total: "100.00",
      subtotal: "100.00",
      balanceDue: "100.00"
    });

    await invoiceService.sendInvoice(company.id, actor.id, invoice.id);

    expect(createInvoiceCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ isOnlineBooking: true, total: "100.00", renvaniPlan: "flat" })
    );
  });

  it("getPublicInvoicePaymentLink: Flex pays 2% Service Fee + $1.99 booking fee; Flat pays only the booking fee (fields stay, 0)", async () => {
    const expected = {
      flex: { serviceFeeAmount: "2.47", platformFeeAmount: "4.46", totalDue: "127.71", serviceFeeCents: 247, totalDueCents: 12_771, platformFeePercent: 2 },
      flat: { serviceFeeAmount: "0.00", platformFeeAmount: "1.99", totalDue: "125.24", serviceFeeCents: 0, totalDueCents: 12_524, platformFeePercent: null }
    } as const;
    for (const planTier of ["flat", "flex"] as const) {
      const { company } = createAdminContext();
      company.settings = { stripePlatformBilling: { planTier } } as typeof company.settings;
      const { customer } = seedInvoiceGraph(company.id);
      const job = fakeDb.seedJob({
        companyId: company.id,
        customerId: customer.id,
        title: "Online booked",
        status: "completed",
        tags: ["online_booking"]
      });
      const token = `tok_${planTier}`;
      fakeDb.seedInvoice({
        companyId: company.id,
        customerId: customer.id,
        jobId: job.id,
        status: "sent",
        total: "123.25",
        balanceDue: "123.25",
        paymentToken: token,
        stripePaymentLinkId: "cs_test_fee",
        stripePaymentLinkUrl: `https://app.test/pay/${token}`
      });

      const link = await invoiceService.getPublicInvoicePaymentLink(token);

      expect(link).toMatchObject({
        invoiceAmount: "123.25",
        bookingFeeAmount: "1.99",
        invoiceAmountCents: 12_325,
        bookingFeeCents: 199,
        feeRefundable: false,
        platformFeePaidByCustomer: true,
        ...expected[planTier]
      });
    }
  });

  it("handleStripePaymentFailed emits a payment.failed event without changing invoice status", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id,
      invoiceNumber: "INV-0001",
      status: "sent"
    });

    const event = {
      data: {
        object: {
          id: "pi_failed",
          metadata: {
            invoiceId: invoice.id
          },
          last_payment_error: {
            message: "Card declined"
          }
        }
      }
    } as unknown as Stripe.PaymentIntentPaymentFailedEvent;

    await invoiceService.handleStripePaymentFailed(event);

    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("payment.failed");
    expect(fakeDb.getTestState().invoices.find((row) => row.id === invoice.id)?.status).toBe("sent");
  });

  it("payment.service listPayments filters by invoice, status, and amount sort", async () => {
    const { company } = createAdminContext();
    const { customer } = seedInvoiceGraph(company.id);
    const invoice = fakeDb.seedInvoice({
      companyId: company.id,
      customerId: customer.id
    });
    fakeDb.seedPayment({
      companyId: company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "100.00",
      method: "cash",
      status: "succeeded",
      createdAt: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedPayment({
      companyId: company.id,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: "50.00",
      method: "check",
      status: "failed",
      createdAt: new Date("2026-04-28T10:00:00.000Z")
    });

    const filtered = await paymentService.listPayments(company.id, {
      invoiceId: invoice.id,
      status: "succeeded",
      sortBy: "amount",
      sortOrder: "desc"
    });

    expect(filtered.total).toBe(1);
    expect(filtered.data[0]?.amount).toBe("100.00");
  });
});
