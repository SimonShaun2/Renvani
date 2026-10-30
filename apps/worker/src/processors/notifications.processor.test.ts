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
      sendInvoicePaymentReceiptEmail: vi.fn(async () => undefined),
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
    claimInvoiceReceiptSend: vi.fn(async () => ({ claimed: true })),
    markInvoiceReceiptSent: vi.fn(async () => undefined),
    releaseInvoiceReceiptClaim: vi.fn(async () => undefined),
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

  describe("send-invoice-receipt", () => {
    function receiptContext(customer: Record<string, unknown>) {
      return {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1",
        status: "paid" as const,
        invoiceNumber: "INV-1001",
        total: "400.00",
        balanceDue: "0.00",
        dueAt: null,
        stripePaymentLinkUrl: "https://example.com/pay/tok",
        reminder1SentAt: null,
        reminder2SentAt: null,
        reminder3SentAt: null,
        customer: { firstName: "Chris", lastName: "Pine", email: "customer@example.com", ...customer },
        company: { name: "Acme HVAC" }
      };
    }
    const receiptJob = () =>
      createJob("send-invoice-receipt", {
        companyId: "company-1",
        invoiceId: "invoice-1",
        customerId: "customer-1",
        paymentId: "payment-1",
        amount: "400.00",
        paidAt: "2026-10-28T15:00:00.000Z"
      });

    it("sends the receipt via the processor switch, tenant-scoped load", async () => {
      vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
      await notificationsProcessor.createNotificationsProcessor(dependencies)(receiptJob(), "token");
      expect(dependencies.loadInvoiceEmailContext).toHaveBeenCalledWith("company-1", "invoice-1");
      expect(dependencies.email.sendInvoicePaymentReceiptEmail).toHaveBeenCalledWith("customer@example.com", {
        firstName: "Chris",
        invoiceNumber: "INV-1001",
        amount: "400.00",
        balanceDue: "0.00",
        paidAt: "2026-10-28T15:00:00.000Z",
        receiptUrl: "https://example.com/pay/tok",
        companyName: "Acme HVAC"
      });
    });

    it.each([
      ["doNotContact", { doNotContact: true }],
      ["prefersEmail=false", { prefersEmail: false }],
      ["no email", { email: null }]
    ])("skips when %s", async (_label, customer) => {
      vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext(customer));
      await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
      expect(dependencies.email.sendInvoicePaymentReceiptEmail).not.toHaveBeenCalled();
    });

    it("skips when the invoice belongs to another customer / tenant (context mismatch)", async () => {
      vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue({ ...receiptContext({}), customerId: "other" });
      await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
      vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(null);
      await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
      expect(dependencies.email.sendInvoicePaymentReceiptEmail).not.toHaveBeenCalled();
    });

    describe("idempotency (worker retry / stalled re-run)", () => {
      // In-memory stand-in for the message_logs (company, source_system, source_id) unique key.
      function withClaimStore(now: () => number = () => Date.now()) {
        const claims = new Map<string, { status: "sending" | "sent"; at: number }>();
        const key = (companyId: string, paymentId: string) => `${companyId}:${paymentId}`;
        vi.mocked(dependencies.claimInvoiceReceiptSend).mockImplementation(async ({ companyId, paymentId }) => {
          const existing = claims.get(key(companyId, paymentId));
          if (!existing) {
            claims.set(key(companyId, paymentId), { status: "sending", at: now() });
            return { claimed: true };
          }
          const age = now() - existing.at;
          if (existing.status === "sending" && age > notificationsProcessor.INVOICE_RECEIPT_STALE_CLAIM_MS) {
            existing.at = now();
            return { claimed: true, staleReclaimedAgeMs: age };
          }
          return { claimed: false };
        });
        vi.mocked(dependencies.markInvoiceReceiptSent).mockImplementation(async (companyId, paymentId) => {
          claims.set(key(companyId, paymentId), { status: "sent", at: now() });
        });
        vi.mocked(dependencies.releaseInvoiceReceiptClaim).mockImplementation(async (companyId, paymentId) => {
          if (claims.get(key(companyId, paymentId))?.status === "sending") claims.delete(key(companyId, paymentId));
        });
        return claims;
      }

      it("fresh 'sending' claim (another worker mid-send) → skip, no send", async () => {
        const claims = withClaimStore();
        claims.set("company-1:payment-1", { status: "sending", at: Date.now() - 60_000 });
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.email.sendInvoicePaymentReceiptEmail).not.toHaveBeenCalled();
      });

      it("stale 'sending' claim (worker died between claim and send) → re-claim, send once, then sent", async () => {
        const claims = withClaimStore();
        claims.set("company-1:payment-1", { status: "sending", at: Date.now() - notificationsProcessor.INVOICE_RECEIPT_STALE_CLAIM_MS - 60_000 });
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.email.sendInvoicePaymentReceiptEmail).toHaveBeenCalledTimes(1);
        expect(claims.get("company-1:payment-1")?.status).toBe("sent");
        expect(warnLogMock).toHaveBeenCalledWith(
          expect.objectContaining({ companyId: "company-1", paymentId: "payment-1", claimAgeMs: expect.any(Number) }),
          expect.stringContaining("stale")
        );
      });

      describe("createInvoiceReceiptClaimer (atomic stale takeover, microsecond timestamps)", () => {
        // Mimics Postgres: updated_at kept in MICROseconds; staleness evaluated "inside the DB" in one step.
        function microStore(nowMicros: () => bigint) {
          const rows = new Map<string, { status: "sending" | "sent"; updatedAtMicros: bigint }>();
          const key = (c: string, p: string) => `${c}:${p}`;
          const threshold = BigInt(notificationsProcessor.INVOICE_RECEIPT_STALE_CLAIM_MS) * 1000n;
          const store = {
            async insertClaim(claim: { companyId: string; paymentId: string }) {
              await Promise.resolve();
              if (rows.has(key(claim.companyId, claim.paymentId))) return false;
              rows.set(key(claim.companyId, claim.paymentId), { status: "sending" as const, updatedAtMicros: nowMicros() });
              return true;
            },
            async takeOverStaleClaim(companyId: string, paymentId: string) {
              await Promise.resolve();
              const row = rows.get(key(companyId, paymentId));
              if (!row || row.status !== "sending" || !(row.updatedAtMicros < nowMicros() - threshold)) return false;
              row.updatedAtMicros = nowMicros();
              return true;
            },
            async readClaimAgeMs(companyId: string, paymentId: string) {
              const row = rows.get(key(companyId, paymentId));
              return row ? Number((nowMicros() - row.updatedAtMicros) / 1000n) : null;
            }
          };
          return { rows, store };
        }
        const claim = { companyId: "company-1", customerId: "customer-1", paymentId: "payment-1", toAddress: "a@b.c", fromAddress: "x@y.z" };
        const NOW = 1_800_000_000_123_456n; // micros, non-zero sub-ms part

        it("stale claim with sub-ms updated_at: ms-truncated equality CAS would miss, atomic UPDATE wins", async () => {
          const { rows, store } = microStore(() => NOW);
          const staleMicros = NOW - BigInt(notificationsProcessor.INVOICE_RECEIPT_STALE_CLAIM_MS + 60_000) * 1000n + 789n;
          rows.set("company-1:payment-1", { status: "sending", updatedAtMicros: staleMicros });
          // What the old CAS did: read updated_at into a JS Date (ms) and compare for equality.
          const readBackAsJsDateMicros = BigInt(new Date(Number(staleMicros / 1000n)).getTime()) * 1000n;
          expect(readBackAsJsDateMicros === staleMicros).toBe(false);
          const result = await notificationsProcessor.createInvoiceReceiptClaimer(store)(claim);
          expect(result.claimed).toBe(true);
          expect(result.staleReclaimedAgeMs).toBeGreaterThan(notificationsProcessor.INVOICE_RECEIPT_STALE_CLAIM_MS);
          expect(rows.get("company-1:payment-1")?.updatedAtMicros).toBe(NOW);
        });

        it("two concurrent takeovers of a stale claim: exactly one wins", async () => {
          const { rows, store } = microStore(() => NOW);
          rows.set("company-1:payment-1", { status: "sending", updatedAtMicros: NOW - 3_600_000_000n + 1n });
          const claimer = notificationsProcessor.createInvoiceReceiptClaimer(store);
          const results = await Promise.all([claimer(claim), claimer(claim)]);
          expect(results.filter((r) => r.claimed)).toHaveLength(1);
        });

        it("fresh 'sending' claim and 'sent' claim are skipped", async () => {
          const { rows, store } = microStore(() => NOW);
          const claimer = notificationsProcessor.createInvoiceReceiptClaimer(store);
          rows.set("company-1:payment-1", { status: "sending", updatedAtMicros: NOW - 60_000_000n + 1n });
          expect((await claimer(claim)).claimed).toBe(false);
          rows.set("company-1:payment-1", { status: "sent", updatedAtMicros: NOW - 3_600_000_000n });
          expect((await claimer(claim)).claimed).toBe(false);
        });

        it("no existing row: first insert claims", async () => {
          const { store } = microStore(() => NOW);
          expect(await notificationsProcessor.createInvoiceReceiptClaimer(store)(claim)).toEqual({ claimed: true });
        });
      });

      it("claims by companyId + paymentId before sending, then marks sent", async () => {
        const claims = withClaimStore();
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.claimInvoiceReceiptSend).toHaveBeenCalledWith(
          expect.objectContaining({ companyId: "company-1", customerId: "customer-1", paymentId: "payment-1", toAddress: "customer@example.com" })
        );
        expect(claims.get("company-1:payment-1")?.status).toBe("sent");
      });

      it("retry after a successful send does not send the receipt twice", async () => {
        withClaimStore();
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.email.sendInvoicePaymentReceiptEmail).toHaveBeenCalledTimes(1);
      });

      it("retry after send succeeded but mark-sent failed still does not resend", async () => {
        withClaimStore();
        vi.mocked(dependencies.markInvoiceReceiptSent).mockRejectedValueOnce(new Error("db down"));
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.email.sendInvoicePaymentReceiptEmail).toHaveBeenCalledTimes(1);
      });

      it("a failed send releases the claim so the retry sends exactly once", async () => {
        const claims = withClaimStore();
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({}));
        vi.mocked(dependencies.email.sendInvoicePaymentReceiptEmail).mockRejectedValueOnce(new Error("resend 500"));
        await expect(notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies)).rejects.toThrow("resend 500");
        expect(claims.has("company-1:payment-1")).toBe(false);
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.email.sendInvoicePaymentReceiptEmail).toHaveBeenCalledTimes(2);
        expect(claims.get("company-1:payment-1")?.status).toBe("sent");
      });

      it("opted-out customers never take a claim", async () => {
        vi.mocked(dependencies.loadInvoiceEmailContext).mockResolvedValue(receiptContext({ doNotContact: true }));
        await notificationsProcessor.handleSendInvoicePaymentReceipt(receiptJob(), dependencies);
        expect(dependencies.claimInvoiceReceiptSend).not.toHaveBeenCalled();
      });
    });

    it("skips when identifiers are missing", async () => {
      await notificationsProcessor.handleSendInvoicePaymentReceipt(
        createJob("send-invoice-receipt", { companyId: "company-1", invoiceId: "invoice-1" }),
        dependencies
      );
      expect(dependencies.loadInvoiceEmailContext).not.toHaveBeenCalled();
    });
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

describe("send-plan-reminder", () => {
  it("emails the renewal reminder via the Resend template", async () => {
    const deps = createDependencies();
    const sendPlanReminderEmail = vi.fn(async () => undefined);
    (deps.email as unknown as Record<string, unknown>).sendPlanReminderEmail = sendPlanReminderEmail;
    await notificationsProcessor.handleSendPlanReminder(
      createJob("send-plan-reminder", {
        companyId: "company-1",
        maintenancePlanId: "plan-1",
        reminderKind: "renewal",
        channel: "email",
        customerEmail: "chris@example.com",
        firstName: "Chris",
        companyName: "Acme HVAC",
        planName: "Gold Plan",
        dueDateLabel: "November 20, 2026"
      }),
      deps
    );
    expect(sendPlanReminderEmail).toHaveBeenCalledWith("chris@example.com", {
      firstName: "Chris",
      companyName: "Acme HVAC",
      planName: "Gold Plan",
      dueDateLabel: "November 20, 2026",
      reminderKind: "renewal"
    });
    expect(deps.sms.sendSms).not.toHaveBeenCalled();
  });

  it("routes SMS jobs through the SMS module (disabled stub in dev)", async () => {
    const deps = createDependencies();
    await notificationsProcessor.handleSendPlanReminder(
      createJob("send-plan-reminder", { channel: "sms", reminderKind: "tune_up", customerPhone: "555-0100", smsBody: "Tune-up due" }),
      deps
    );
    expect(deps.sms.sendSms).toHaveBeenCalledWith("555-0100", "Tune-up due");
  });

  describe("send-time re-check (#264 standard)", () => {
    const job = (channel: "email" | "sms") =>
      createJob("send-plan-reminder", {
        companyId: "company-1",
        maintenancePlanId: "plan-1",
        customerId: "cust-1",
        reminderKind: "renewal",
        channel,
        customerEmail: "chris@example.com",
        customerPhone: "555-0100",
        smsBody: "Renewal due",
        firstName: "Chris",
        companyName: "Acme HVAC",
        planName: "Gold Plan",
        dueDateLabel: "November 20, 2026"
      });
    const ok = {
      plan: { status: "active", deleted: false, customerId: "cust-1" },
      customer: { prefersEmail: true, prefersSms: true, doNotContact: false },
      ruleEnabled: true
    };

    it.each([
      ["plan gone", null],
      ["plan deleted", { ...ok, plan: { ...ok.plan, deleted: true } }],
      ["plan cancelled", { ...ok, plan: { ...ok.plan, status: "cancelled" } }],
      ["rule turned off", { ...ok, ruleEnabled: false }],
      ["do not contact", { ...ok, customer: { ...ok.customer, doNotContact: true } }],
      ["email consent withdrawn", { ...ok, customer: { ...ok.customer, prefersEmail: false } }],
      ["plan moved to another customer", { ...ok, plan: { ...ok.plan, customerId: "cust-2" } }]
    ])("skips when %s", async (_label, context) => {
      const deps = createDependencies();
      const sendPlanReminderEmail = vi.fn(async () => undefined);
      (deps.email as unknown as Record<string, unknown>).sendPlanReminderEmail = sendPlanReminderEmail;
      const load = vi.fn(async () => context);
      (deps as unknown as Record<string, unknown>).loadPlanReminderSendContext = load;
      await notificationsProcessor.handleSendPlanReminder(job("email"), deps);
      expect(load).toHaveBeenCalledWith("company-1", "plan-1");
      expect(sendPlanReminderEmail).not.toHaveBeenCalled();
    });

    it("skips SMS when SMS consent is withdrawn, sends when consent and plan are still valid", async () => {
      const deps = createDependencies();
      (deps as unknown as Record<string, unknown>).loadPlanReminderSendContext = vi.fn(async () => ({
        ...ok,
        customer: { ...ok.customer, prefersSms: false }
      }));
      await notificationsProcessor.handleSendPlanReminder(job("sms"), deps);
      expect(deps.sms.sendSms).not.toHaveBeenCalled();

      (deps as unknown as Record<string, unknown>).loadPlanReminderSendContext = vi.fn(async () => ok);
      await notificationsProcessor.handleSendPlanReminder(job("sms"), deps);
      expect(deps.sms.sendSms).toHaveBeenCalledWith("555-0100", "Renewal due");
    });
  });
});
