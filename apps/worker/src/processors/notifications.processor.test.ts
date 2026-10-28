import type { Job } from "bullmq";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  debugLogMock,
  errorLogMock,
  infoLogMock,
  warnLogMock,
  recordTransactionalEmailMessageLogMock
} = vi.hoisted(() => ({
  debugLogMock: vi.fn(),
  errorLogMock: vi.fn(),
  infoLogMock: vi.fn(),
  warnLogMock: vi.fn(),
  recordTransactionalEmailMessageLogMock: vi.fn(async () => undefined)
}));

const sampleTransactionalDelivery = {
  templateId: "booking.confirmation",
  subject: "Your appointment is confirmed",
  providerMessageId: "resend-msg-1"
};

vi.mock("./transactional-email-message-log.js", () => ({
  recordTransactionalEmailMessageLog: recordTransactionalEmailMessageLogMock
}));

vi.mock("@fsm/config", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    SENDGRID_FROM_EMAIL: "noreply@example.com",
    TWILIO_FROM_NUMBER: "+15555555555"
  }
}));

vi.mock("pino", () => ({
  default: () => ({
    debug: debugLogMock,
    error: errorLogMock,
    info: infoLogMock,
    warn: warnLogMock
  })
}));

type NotificationsProcessorModule = typeof import("./notifications.processor.js");

let notificationsProcessor: NotificationsProcessorModule;

beforeAll(async () => {
  notificationsProcessor = await import("./notifications.processor.js");
});

function createJob(name: string, data: Record<string, unknown>): Job<Record<string, unknown>> {
  return {
    id: `job-${name}`,
    name,
    data
  } as unknown as Job<Record<string, unknown>>;
}

function createDependencies(): notificationsProcessor.NotificationsDependencies {
  return {
    email: {
      sendPasswordResetEmail: vi.fn(async () => undefined),
      sendEstimateEmail: vi.fn(async () => undefined),
      sendCampaignEmail: vi.fn(async () => undefined),
      sendInvoiceEmail: vi.fn(async () => undefined),
      sendInvoiceReminderEmail: vi.fn(async () => undefined),
      sendInvoiceReminderOwnerAlertEmail: vi.fn(async () => undefined),
      sendServiceAgreementRenewalReminderEmail: vi.fn(async () => undefined),
      sendServiceAgreementPaymentFailedEmail: vi.fn(async () => undefined),
      sendBookingConfirmationEmail: vi.fn(async () => sampleTransactionalDelivery),
      sendBookingDeclineEmail: vi.fn(async () => ({
        ...sampleTransactionalDelivery,
        templateId: "booking.decline"
      })),
      sendVipMembershipWelcomeEmail: vi.fn(async () => ({
        ...sampleTransactionalDelivery,
        templateId: "vip_membership.welcome"
      })),
      sendVipMembershipRenewalEmail: vi.fn(async () => ({
        ...sampleTransactionalDelivery,
        templateId: "vip_membership.renewal_receipt"
      })),
      sendVipMembershipPaymentFailedEmail: vi.fn(async () => ({
        ...sampleTransactionalDelivery,
        templateId: "vip_membership.payment_failed_dunning"
      }))
    },
    sms: {
      sendSms: vi.fn(async () => "SM123")
    },
    loadEstimateEmailContext: vi.fn(async () => null),
    loadCampaignDeliveryContext: vi.fn(async () => null),
    loadInvoiceEmailContext: vi.fn(async () => null),
    loadServiceAgreementEmailContext: vi.fn(async () => null),
    loadCompanyOwner: vi.fn(async () => null),
    findAutomationRule: vi.fn(async () => null),
    markInvoiceReminderSent: vi.fn(async () => undefined),
    markCampaignRecipientDelivered: vi.fn(async () => undefined),
    recordCampaignDeliveryFailure: vi.fn(async () => undefined)
  };
}

describe("notifications.processor", () => {
  let dependencies: notificationsProcessor.NotificationsDependencies;

  beforeEach(() => {
    dependencies = createDependencies();
    debugLogMock.mockReset();
    errorLogMock.mockReset();
    infoLogMock.mockReset();
    warnLogMock.mockReset();
    recordTransactionalEmailMessageLogMock.mockClear();
  });

  it("send-estimate-email sends the estimate email when the customer can receive it", async () => {
    vi.mocked(dependencies.loadEstimateEmailContext).mockResolvedValue({
      companyId: "company-1",
      estimateId: "estimate-1",
      customerId: "customer-1",
      status: "sent",
      estimateNumber: "EST-1001",
      title: "Spring Tune-Up",
      total: "325.00",
      approvalToken: "approval-token",
      expiresAt: new Date("2026-05-28T00:00:00.000Z"),
      customer: {
        firstName: "Chris",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      },
      items: [{ id: "item-1" }]
    });

    await notificationsProcessor.handleSendEstimateEmail(
      createJob("send-estimate-email", {
        companyId: "company-1",
        estimateId: "estimate-1",
        customerId: "customer-1"
      }),
      dependencies
    );

    expect(dependencies.email.sendEstimateEmail).toHaveBeenCalledWith("customer@example.com", {
      firstName: "Chris",
      estimateNumber: "EST-1001",
      title: "Spring Tune-Up",
      total: "325.00",
      expiresAt: "2026-05-28T00:00:00.000Z",
      approvalUrl: "http://localhost:3000/approve/approval-token",
      companyName: "Acme HVAC"
    });
  });

  it("send-estimate-email skips cleanly when the customer has no email", async () => {
    vi.mocked(dependencies.loadEstimateEmailContext).mockResolvedValue({
      companyId: "company-1",
      estimateId: "estimate-1",
      customerId: "customer-1",
      status: "sent",
      estimateNumber: "EST-1001",
      title: "Spring Tune-Up",
      total: "325.00",
      approvalToken: "approval-token",
      expiresAt: new Date("2026-05-28T00:00:00.000Z"),
      customer: {
        firstName: "Chris",
        email: null
      },
      company: {
        name: "Acme HVAC"
      },
      items: []
    });

    await notificationsProcessor.handleSendEstimateEmail(
      createJob("send-estimate-email", {
        companyId: "company-1",
        estimateId: "estimate-1",
        customerId: "customer-1"
      }),
      dependencies
    );

    expect(dependencies.email.sendEstimateEmail).not.toHaveBeenCalled();
  });

  it("send-invoice-email sends the invoice email when the customer can receive it", async () => {
    vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue({
      companyId: "company-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      status: "sent",
      invoiceNumber: "INV-1001",
      total: "400.00",
      balanceDue: "275.00",
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
      stripePaymentLinkUrl: "https://example.com/pay",
      reminder1SentAt: null,
      reminder2SentAt: null,
      reminder3SentAt: null,
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendInvoiceEmail(
      createJob("send-invoice-email", {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1"
      }),
      dependencies
    );

    expect(dependencies.email.sendInvoiceEmail).toHaveBeenCalledWith("customer@example.com", {
      firstName: "Chris",
      invoiceNumber: "INV-1001",
      total: "400.00",
      dueAt: "2026-04-01T00:00:00.000Z",
      paymentLinkUrl: "https://example.com/pay",
      companyName: "Acme HVAC"
    });
  });

  it("send-invoice-email skips cleanly when the customer has no email", async () => {
    vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue({
      companyId: "company-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      status: "sent",
      invoiceNumber: "INV-1001",
      total: "400.00",
      balanceDue: "275.00",
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
      stripePaymentLinkUrl: "https://example.com/pay",
      reminder1SentAt: null,
      reminder2SentAt: null,
      reminder3SentAt: null,
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: null
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendInvoiceEmail(
      createJob("send-invoice-email", {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1"
      }),
      dependencies
    );

    expect(dependencies.email.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("send-invoice-email skips cleanly when the payment link is missing", async () => {
    vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue({
      companyId: "company-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      status: "sent",
      invoiceNumber: "INV-1001",
      total: "400.00",
      balanceDue: "275.00",
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
      stripePaymentLinkUrl: null,
      reminder1SentAt: null,
      reminder2SentAt: null,
      reminder3SentAt: null,
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendInvoiceEmail(
      createJob("send-invoice-email", {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1"
      }),
      dependencies
    );

    expect(dependencies.email.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("send-campaign-message sends SMS messages, marks the recipient delivered, and avoids logging PII", async () => {
    vi.mocked(dependencies.loadCampaignDeliveryContext).mockResolvedValue({
      companyId: "company-1",
      campaignId: "campaign-1",
      recipientId: "recipient-1",
      customerId: "customer-1",
      recipient: {
        sentAt: null
      },
      customer: {
        firstName: "Chris",
        email: "customer@example.com",
        phone: "555-0100"
      },
      company: {
        name: "Acme HVAC"
      }
    });
    vi.mocked(dependencies.sms.sendSms).mockResolvedValue("SM123");

    await notificationsProcessor.handleSendCampaignMessage(
      createJob("send-campaign-message", {
        companyId: "company-1",
        campaignId: "campaign-1",
        recipientId: "recipient-1",
        customerId: "customer-1",
        channel: "sms",
        body: "Hi Chris, Acme HVAC can help with your next service visit. Reply if you'd like to get scheduled.",
        toAddress: "555-0100"
      }),
      dependencies
    );

    expect(dependencies.sms.sendSms).toHaveBeenCalledWith(
      "555-0100",
      "Hi Chris, Acme HVAC can help with your next service visit. Reply if you'd like to get scheduled."
    );
    expect(dependencies.markCampaignRecipientDelivered).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-1",
        recipientId: "recipient-1",
        channel: "sms",
        providerMessageId: "SM123"
      })
    );
    expect(JSON.stringify(infoLogMock.mock.calls)).not.toContain("555-0100");
    expect(JSON.stringify(errorLogMock.mock.calls)).not.toContain("555-0100");
  });

  it("send-campaign-message sends email messages through the email adapter", async () => {
    vi.mocked(dependencies.loadCampaignDeliveryContext).mockResolvedValue({
      companyId: "company-1",
      campaignId: "campaign-1",
      recipientId: "recipient-1",
      customerId: "customer-1",
      recipient: {
        sentAt: null
      },
      customer: {
        firstName: "Chris",
        email: "customer@example.com",
        phone: "555-0100"
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendCampaignMessage(
      createJob("send-campaign-message", {
        companyId: "company-1",
        campaignId: "campaign-1",
        recipientId: "recipient-1",
        customerId: "customer-1",
        channel: "email",
        subject: "A quick note from Acme HVAC",
        body: "Hi Chris, we’d love to help with your next service visit. Reply if you'd like to get scheduled.",
        toAddress: "customer@example.com"
      }),
      dependencies
    );

    expect(dependencies.email.sendCampaignEmail).toHaveBeenCalledWith("customer@example.com", {
      firstName: "Chris",
      subject: "A quick note from Acme HVAC",
      body: "Hi Chris, we’d love to help with your next service visit. Reply if you'd like to get scheduled.",
      companyName: "Acme HVAC"
    });
    expect(dependencies.markCampaignRecipientDelivered).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-1",
        recipientId: "recipient-1",
        channel: "email"
      })
    );
  });

  it("send-campaign-message skips idempotently when the recipient was already sent", async () => {
    vi.mocked(dependencies.loadCampaignDeliveryContext).mockResolvedValue({
      companyId: "company-1",
      campaignId: "campaign-1",
      recipientId: "recipient-1",
      customerId: "customer-1",
      recipient: {
        sentAt: new Date("2026-04-28T12:00:00.000Z")
      },
      customer: {
        firstName: "Chris",
        email: "customer@example.com",
        phone: "555-0100"
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendCampaignMessage(
      createJob("send-campaign-message", {
        companyId: "company-1",
        campaignId: "campaign-1",
        recipientId: "recipient-1",
        customerId: "customer-1",
        channel: "sms",
        body: "Hello",
        toAddress: "555-0100"
      }),
      dependencies
    );

    expect(dependencies.sms.sendSms).not.toHaveBeenCalled();
    expect(dependencies.email.sendCampaignEmail).not.toHaveBeenCalled();
    expect(dependencies.markCampaignRecipientDelivered).not.toHaveBeenCalled();
  });

  it("send-invoice-reminder sends the requested reminder level and updates the reminder timestamp", async () => {
    vi.mocked(dependencies.findAutomationRule).mockResolvedValue({
      companyId: "company-1",
      ruleType: "invoice_reminder"
    });
    vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue({
      companyId: "company-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      status: "overdue",
      invoiceNumber: "INV-1001",
      total: "400.00",
      balanceDue: "275.00",
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
      stripePaymentLinkUrl: "https://example.com/pay",
      reminder1SentAt: null,
      reminder2SentAt: null,
      reminder3SentAt: null,
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendInvoiceReminder(
      createJob("send-invoice-reminder", {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1",
        reminderLevel: 2
      }),
      dependencies
    );

    expect(dependencies.email.sendInvoiceReminderEmail).toHaveBeenCalledWith("customer@example.com", {
      firstName: "Chris",
      invoiceNumber: "INV-1001",
      total: "400.00",
      balanceDue: "275.00",
      dueAt: "2026-04-01T00:00:00.000Z",
      paymentLinkUrl: "https://example.com/pay",
      companyName: "Acme HVAC",
      reminderLevel: 2
    });
    expect(dependencies.markInvoiceReminderSent).toHaveBeenCalledWith("company-1", "invoice-1", 2);
  });

  it("send-invoice-reminder skips when the invoice has already been paid", async () => {
    vi.mocked(dependencies.findAutomationRule).mockResolvedValue({
      companyId: "company-1",
      ruleType: "invoice_reminder"
    });
    vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue({
      companyId: "company-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      status: "paid",
      invoiceNumber: "INV-1001",
      total: "400.00",
      balanceDue: "0.00",
      dueAt: new Date("2026-04-01T00:00:00.000Z"),
      stripePaymentLinkUrl: "https://example.com/pay",
      reminder1SentAt: null,
      reminder2SentAt: null,
      reminder3SentAt: null,
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      }
    });

    await notificationsProcessor.handleSendInvoiceReminder(
      createJob("send-invoice-reminder", {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1",
        reminderLevel: 1
      }),
      dependencies
    );

    expect(dependencies.email.sendInvoiceReminderEmail).not.toHaveBeenCalled();
    expect(dependencies.markInvoiceReminderSent).not.toHaveBeenCalled();
  });

  it("send-service-agreement-email sends payment failure notices to the company owner", async () => {
    vi.mocked(dependencies.loadServiceAgreementEmailContext).mockResolvedValue({
      companyId: "company-1",
      maintenancePlanId: "plan-1",
      customerId: "customer-1",
      name: "Gold Plan",
      price: "49.00",
      nextServiceDate: "2026-05-01",
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      },
      template: {
        name: "Gold Plan"
      }
    });
    vi.mocked(dependencies.loadCompanyOwner).mockResolvedValue({
      id: "owner-1",
      firstName: "Ava",
      email: "owner@example.com"
    });

    await notificationsProcessor.handleSendServiceAgreementEmail(
      createJob("send-service-agreement-email", {
        companyId: "company-1",
        maintenancePlanId: "plan-1",
        emailType: "payment_failed",
        manageUrl: "https://example.com/manage"
      }),
      dependencies
    );

    expect(dependencies.email.sendServiceAgreementPaymentFailedEmail).toHaveBeenCalledWith("owner@example.com", {
      ownerFirstName: "Ava",
      customerName: "Chris Pine",
      planName: "Gold Plan",
      amount: "49.00",
      manageUrl: "https://example.com/manage",
      companyName: "Acme HVAC"
    });
  });

  it("send-service-agreement-email sends renewal reminders to the customer", async () => {
    vi.mocked(dependencies.loadServiceAgreementEmailContext).mockResolvedValue({
      companyId: "company-1",
      maintenancePlanId: "plan-1",
      customerId: "customer-1",
      name: "Gold Plan",
      price: "49.00",
      nextServiceDate: "2026-05-01",
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      },
      template: {
        name: "Gold Plan"
      }
    });
    vi.mocked(dependencies.findAutomationRule).mockResolvedValue({
      companyId: "company-1",
      ruleType: "service_agreement_renewal"
    });

    await notificationsProcessor.handleSendServiceAgreementEmail(
      createJob("send-service-agreement-email", {
        companyId: "company-1",
        maintenancePlanId: "plan-1",
        emailType: "renewal_reminder"
      }),
      dependencies
    );

    expect(dependencies.email.sendServiceAgreementRenewalReminderEmail).toHaveBeenCalledWith(
      "customer@example.com",
      {
        firstName: "Chris",
        planName: "Gold Plan",
        nextServiceDate: "2026-05-01",
        companyName: "Acme HVAC"
      }
    );
  });

  it("send-otw-notification sends the queued OTW SMS", async () => {
    await notificationsProcessor.handleSendOnTheWayNotification(
      createJob("send-otw-notification", {
        companyId: "company-1",
        jobId: "job-1",
        notificationId: "otw-1",
        customerPhone: "555-0100",
        message: "Taylor is on the way and should arrive in about 20 minutes."
      }),
      dependencies
    );

    expect(dependencies.sms.sendSms).toHaveBeenCalledWith(
      "555-0100",
      "Taylor is on the way and should arrive in about 20 minutes."
    );
  });

  it("send-review-request builds and sends the public review SMS", async () => {
    await notificationsProcessor.handleSendReviewRequest(
      createJob("send-review-request", {
        companyId: "company-1",
        reviewRequestId: "review-1",
        customerPhone: "555-0100",
        referenceId: "c22927f5-988e-4bb6-bf33-f64e71e72a58",
        companyName: "Acme HVAC",
        technicianName: "Taylor Stone"
      }),
      dependencies
    );

    expect(dependencies.sms.sendSms).toHaveBeenCalledWith(
      "555-0100",
      "Acme HVAC: thanks for your recent visit from Taylor Stone. Please leave a quick review: http://localhost:3000/review/c22927f5-988e-4bb6-bf33-f64e71e72a58"
    );
  });

  it("send-booking-confirmation sends email when customer email is present", async () => {
    await notificationsProcessor.handleSendBookingNotification(
      createJob("send-booking-confirmation", {
        companyId: "company-1",
        bookingRequestId: "booking-1",
        toEmail: "customer@example.com",
        firstName: "Chris",
        companyName: "Acme HVAC",
        referenceNumber: "BK-20260428-0001",
        scheduledLabel: "Apr 30 at 8:00 AM"
      }),
      dependencies
    );

    expect(dependencies.email.sendBookingConfirmationEmail).toHaveBeenCalledWith("customer@example.com", {
      firstName: "Chris",
      companyName: "Acme HVAC",
      referenceNumber: "BK-20260428-0001",
      scheduledLabel: "Apr 30 at 8:00 AM"
    });
    expect(recordTransactionalEmailMessageLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        sourceSystem: "booking_notification",
        sourceId: "booking-1:send-booking-confirmation",
        delivery: sampleTransactionalDelivery
      })
    );
    expect(dependencies.sms.sendSms).not.toHaveBeenCalled();
  });

  it("send-password-reset-email sends via email module", async () => {
    await notificationsProcessor.handleSendPasswordResetEmail(
      createJob("send-password-reset-email", {
        companyId: "company-1",
        toEmail: "owner@example.com",
        firstName: "Pat",
        resetUrl: "http://localhost:3000/reset-password?token=abc"
      }),
      dependencies
    );

    expect(dependencies.email.sendPasswordResetEmail).toHaveBeenCalledWith(
      "owner@example.com",
      "http://localhost:3000/reset-password?token=abc",
      "Pat"
    );
  });
});

describe("send-review-request send-time re-check (#264 review)", () => {
  const activeContext = (): notificationsProcessor.ReviewRequestSendContext => ({
    requestStatus: "sent",
    requestDeleted: false,
    invoice: { status: "paid", total: "250.00", deleted: false },
    customer: { prefersEmail: true, prefersSms: true, doNotContact: false },
    ruleEnabled: true
  });

  function emailJob() {
    return createJob("send-review-request", {
      companyId: "company-1",
      reviewRequestId: "review-1",
      invoiceId: "invoice-1",
      channel: "email",
      customerEmail: "chris@example.com",
      customerFirstName: "Chris",
      referenceId: "c22927f5-988e-4bb6-bf33-f64e71e72a58",
      companyName: "Acme HVAC"
    });
  }

  async function run(context: notificationsProcessor.ReviewRequestSendContext | null, job = emailJob()) {
    const deps = createDependencies();
    const sendReviewRequestEmail = vi.fn(async () => undefined);
    (deps.email as unknown as Record<string, unknown>).sendReviewRequestEmail = sendReviewRequestEmail;
    deps.loadReviewRequestSendContext = vi.fn(async () => context);
    await notificationsProcessor.handleSendReviewRequest(job, deps);
    return { sendReviewRequestEmail, sendSms: deps.sms.sendSms };
  }

  it("sends when everything is still valid (happy path)", async () => {
    const { sendReviewRequestEmail } = await run(activeContext());
    expect(sendReviewRequestEmail).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["refunded / no longer paid", { invoice: { status: "refunded", total: "250.00", deleted: false } }, "invoice_not_paid"],
    ["void", { invoice: { status: "void", total: "250.00", deleted: false } }, "invoice_not_paid"],
    ["zero total", { invoice: { status: "paid", total: "0.00", deleted: false } }, "invoice_not_paid"],
    ["do not contact", { customer: { prefersEmail: true, prefersSms: true, doNotContact: true } }, "customer_do_not_contact"],
    ["email opt-out", { customer: { prefersEmail: false, prefersSms: true, doNotContact: false } }, "customer_opted_out"],
    ["NULL prefersEmail is not consent", { customer: { prefersEmail: null, prefersSms: true, doNotContact: false } }, "customer_opted_out"],
    ["rule disabled", { ruleEnabled: false }, "rule_disabled"],
    ["request completed", { requestStatus: "completed" }, "request_not_active"],
    ["request declined", { requestStatus: "declined" }, "request_not_active"],
    ["request deleted", { requestDeleted: true }, "request_not_found"]
  ] as const)("skips without sending: %s", async (_label, override, reason) => {
    infoLogMock.mockClear();
    const { sendReviewRequestEmail } = await run({ ...activeContext(), ...override } as notificationsProcessor.ReviewRequestSendContext);
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
    expect(infoLogMock).toHaveBeenCalledWith(expect.objectContaining({ reason }), "Review request skipped at send time");
  });

  it("skips when the request no longer exists", async () => {
    const { sendReviewRequestEmail } = await run(null);
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
  });

  it("SMS path: NULL prefersSms is not consent", async () => {
    const job = createJob("send-review-request", {
      companyId: "company-1",
      reviewRequestId: "review-1",
      invoiceId: "invoice-1",
      channel: "sms",
      customerPhone: "555-0100",
      referenceId: "c22927f5-988e-4bb6-bf33-f64e71e72a58"
    });
    const { sendSms } = await run({ ...activeContext(), customer: { prefersEmail: true, prefersSms: null, doNotContact: false } }, job);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("manual (non-invoice) requests skip the invoice/rule checks but keep consent checks", async () => {
    const job = createJob("send-review-request", {
      companyId: "company-1",
      reviewRequestId: "review-1",
      channel: "email",
      customerEmail: "chris@example.com",
      referenceId: "c22927f5-988e-4bb6-bf33-f64e71e72a58"
    });
    const ok = await run({ ...activeContext(), invoice: null, ruleEnabled: false }, job);
    expect(ok.sendReviewRequestEmail).toHaveBeenCalledTimes(1);
  });
});
