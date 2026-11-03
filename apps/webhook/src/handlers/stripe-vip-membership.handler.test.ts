import { randomUUID } from "node:crypto";

import type { FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

import { notificationsQueueAddMock } from "../test-support/fsm-jobs.mock.js";

const { subscriptionsRetrieveMock } = vi.hoisted(() => ({
  subscriptionsRetrieveMock: vi.fn()
}));

vi.mock("../lib/stripe-client.js", () => ({
  stripe: {
    subscriptions: {
      retrieve: subscriptionsRetrieveMock
    }
  }
}));

const { emitEventMock, selectState } = vi.hoisted(() => ({
  emitEventMock: vi.fn(),
  selectState: {
    call: 0,
    companyId: "",
    customerId: ""
  }
}));

vi.mock("@fsm/db", () => ({
  companies: { id: "id", deletedAt: "deletedAt" },
  customers: { id: "id", companyId: "companyId", deletedAt: "deletedAt" },
  db: {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectState.call += 1;
              if (selectState.call === 1) {
                return [{ id: selectState.companyId, name: "Juniper Home Co.", settings: {}, deletedAt: null }];
              }

              return [
                {
                  id: selectState.customerId,
                  companyId: selectState.companyId,
                  firstName: "Sam",
                  lastName: "Lee",
                  deletedAt: null
                }
              ];
            }
          })
        })
      })),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn()
    },
  emitEventWithExecutor: emitEventMock
}));

import {
  handleVipInvoicePaymentFailed,
  handleVipInvoicePaymentSucceeded,
  handleVipSubscriptionCreated
} from "./stripe-vip-membership.handler.js";

function createLog() {
  return {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  };
}

describe("stripe-vip-membership.handler", () => {
  beforeEach(() => {
    selectState.companyId = randomUUID();
    selectState.customerId = randomUUID();
    selectState.call = 0;
    notificationsQueueAddMock.mockReset();
    emitEventMock.mockReset();
    subscriptionsRetrieveMock.mockReset();
  });

  it("queues welcome email on VIP subscription created", async () => {
    const companyId = selectState.companyId;
    const customerId = selectState.customerId;

    const event = {
      id: "evt_sub_created",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_vip_1",
          latest_invoice: "in_welcome",
          metadata: {
            billingKind: "vip_membership",
            companyId,
            customerId,
            planName: "VIP Plus"
          }
        }
      }
    } as unknown as Stripe.CustomerSubscriptionCreatedEvent;

    const handled = await handleVipSubscriptionCreated(event, createLog() as unknown as FastifyRequest["log"]);

    expect(handled).toBe(true);
    expect(notificationsQueueAddMock).toHaveBeenCalledWith(
      "send-vip-membership-email",
      expect.objectContaining({
        emailKind: "welcome",
        planName: "VIP Plus"
      }),
      expect.objectContaining({ jobId: "vip-welcome-sub_vip_1" })
    );
  });

  it("schedules dunning emails on VIP invoice payment failed", async () => {
    const companyId = selectState.companyId;
    const customerId = selectState.customerId;

    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_vip_1",
      metadata: {
        billingKind: "vip_membership",
        companyId,
        customerId,
        planName: "VIP Plus"
      }
    });

    const event = {
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_failed",
          subscription: "sub_vip_1",
          amount_due: 2900,
          hosted_invoice_url: "https://pay.example.test/in_failed",
          next_payment_attempt: 1_761_000_000,
          metadata: {}
        }
      }
    } as unknown as Stripe.InvoicePaymentFailedEvent;

    const handled = await handleVipInvoicePaymentFailed(event, createLog() as unknown as FastifyRequest["log"]);

    expect(handled).toBe(true);
    expect(notificationsQueueAddMock).toHaveBeenCalledTimes(3);
    expect(notificationsQueueAddMock.mock.calls[0]?.[0]).toBe("send-vip-membership-email");
    expect(notificationsQueueAddMock.mock.calls[0]?.[1]).toMatchObject({
      emailKind: "payment_failed_dunning",
      dunningStepIndex: 0
    });
  });

  it("queues renewal receipt on subscription_cycle invoice success", async () => {
    const companyId = selectState.companyId;
    const customerId = selectState.customerId;

    subscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_vip_1",
      metadata: {
        billingKind: "vip_membership",
        companyId,
        customerId,
        planName: "VIP Plus"
      }
    });

    const event = {
      id: "evt_invoice_paid",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_renewal",
          subscription: "sub_vip_1",
          amount_paid: 2900,
          billing_reason: "subscription_cycle",
          metadata: {}
        }
      }
    } as unknown as Stripe.InvoicePaymentSucceededEvent;

    const handled = await handleVipInvoicePaymentSucceeded(event, createLog() as unknown as FastifyRequest["log"]);

    expect(handled).toBe(true);
    expect(notificationsQueueAddMock).toHaveBeenCalledWith(
      "send-vip-membership-email",
      expect.objectContaining({
        emailKind: "renewal_receipt",
        stripeInvoiceId: "in_renewal"
      }),
      expect.objectContaining({ jobId: "vip-renewal-in_renewal" })
    );
  });
});
