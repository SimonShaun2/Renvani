import { randomUUID } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";
import { notificationsQueueAddMock } from "../test-support/fsm-jobs.mock.js";

setupTestEnv();

const FIXED_WEBHOOK_TEST_NOW = new Date("2026-06-15T12:00:00.000Z");
const FIXED_RENEWAL_PAID_DATE = FIXED_WEBHOOK_TEST_NOW.toISOString().slice(0, 10);

type CompanyRecord = {
  id: string;
  name: string;
  stripeAccountId: string | null;
  stripeCustomerId: string | null;
  settings: Record<string, unknown>;
  deletedAt: Date | null;
  updatedAt: Date;
};

type CustomerRecord = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  deletedAt: Date | null;
};

type MaintenancePlanRecord = {
  id: string;
  companyId: string;
  customerId: string;
  name: string;
  status: "active" | "paused" | "expired" | "cancelled";
  price: string | null;
  stripeSubscriptionId: string | null;
  stripeCurrentPeriodStart: Date | null;
  stripeCurrentPeriodEnd: Date | null;
  stripeCancelAtPeriodEnd: boolean | null;
  endDate: string | null;
  lastServiceDate: string | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

type ActivityEventRecord = {
  id: string;
  companyId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  customerId: string | null;
  payload: unknown;
  summary: string;
};

type Predicate<T> = (row: T) => boolean;

interface MockTable {
  __name: string;
}

interface MockTransaction {
  update(table: MockTable): {
    set(values: Record<string, unknown>): {
      where(predicate: Predicate<Record<string, unknown>>): {
        returning(): Promise<Array<Record<string, unknown>>>;
      };
    };
  };
  insert(table: MockTable): {
    values(values: Record<string, unknown>): {
      returning(): Promise<Array<Record<string, unknown>>>;
    };
  };
}

const {
  forwardStripePaymentFailedMock,
  forwardStripePaymentSuccessMock,
  errorLogMock,
  infoLogMock,
  warnLogMock
} = vi.hoisted(() => ({
  forwardStripePaymentFailedMock: vi.fn(),
  forwardStripePaymentSuccessMock: vi.fn(),
  errorLogMock: vi.fn(),
  infoLogMock: vi.fn(),
  warnLogMock: vi.fn()
}));

const processedEventIds = new Set<string>();
const claimedEventIds = new Set<string>();

const state = {
  companies: [] as CompanyRecord[],
  customers: [] as CustomerRecord[],
  maintenancePlans: [] as MaintenancePlanRecord[],
  activityEvents: [] as ActivityEventRecord[]
};

const companiesTable = {
  __name: "companies",
  id: "id",
  stripeAccountId: "stripeAccountId",
  stripeCustomerId: "stripeCustomerId",
  deletedAt: "deletedAt"
} as const;

const customersTable = {
  __name: "customers",
  id: "id",
  companyId: "companyId",
  phone: "phone",
  deletedAt: "deletedAt"
} as const;

const maintenancePlansTable = {
  __name: "maintenancePlans",
  id: "id",
  companyId: "companyId",
  stripeSubscriptionId: "stripeSubscriptionId",
  deletedAt: "deletedAt"
} as const;

function getRows(tableName: string): Array<Record<string, unknown>> {
  switch (tableName) {
    case "companies":
      return state.companies;
    case "customers":
      return state.customers;
    case "maintenancePlans":
      return state.maintenancePlans;
    default:
      return [];
  }
}

function resetState(): void {
  state.companies.length = 0;
  state.customers.length = 0;
  state.maintenancePlans.length = 0;
  state.activityEvents.length = 0;
  processedEventIds.clear();
  claimedEventIds.clear();
}

function createCompany(values: Partial<CompanyRecord> = {}): CompanyRecord {
  return {
    id: values.id ?? randomUUID(),
    name: values.name ?? "Acme HVAC",
    stripeAccountId: values.stripeAccountId ?? null,
    stripeCustomerId: values.stripeCustomerId ?? null,
    settings: values.settings ?? {},
    deletedAt: values.deletedAt ?? null,
    updatedAt: values.updatedAt ?? new Date()
  };
}

function createCustomer(values: Partial<CustomerRecord> & Pick<CustomerRecord, "companyId">): CustomerRecord {
  return {
    id: values.id ?? randomUUID(),
    companyId: values.companyId,
    firstName: values.firstName ?? "Chris",
    lastName: values.lastName ?? "Pine",
    phone: values.phone ?? "555-0100",
    deletedAt: values.deletedAt ?? null
  };
}

function createMaintenancePlan(
  values: Partial<MaintenancePlanRecord> & Pick<MaintenancePlanRecord, "companyId" | "customerId">
): MaintenancePlanRecord {
  return {
    id: values.id ?? randomUUID(),
    companyId: values.companyId,
    customerId: values.customerId,
    name: values.name ?? "Gold Plan",
    status: values.status ?? "active",
    price: values.price ?? "29.99",
    stripeSubscriptionId: values.stripeSubscriptionId ?? null,
    stripeCurrentPeriodStart: values.stripeCurrentPeriodStart ?? null,
    stripeCurrentPeriodEnd: values.stripeCurrentPeriodEnd ?? null,
    stripeCancelAtPeriodEnd: values.stripeCancelAtPeriodEnd ?? false,
    endDate: values.endDate ?? null,
    lastServiceDate: values.lastServiceDate ?? null,
    deletedAt: values.deletedAt ?? null,
    updatedAt: values.updatedAt ?? new Date()
  };
}

function seedCompany(values: Partial<CompanyRecord> = {}): CompanyRecord {
  const record = createCompany(values);
  state.companies.push(record);
  return record;
}

function seedCustomer(values: Partial<CustomerRecord> & Pick<CustomerRecord, "companyId">): CustomerRecord {
  const record = createCustomer(values);
  state.customers.push(record);
  return record;
}

function seedMaintenancePlan(
  values: Partial<MaintenancePlanRecord> & Pick<MaintenancePlanRecord, "companyId" | "customerId">
): MaintenancePlanRecord {
  const record = createMaintenancePlan(values);
  state.maintenancePlans.push(record);
  return record;
}

vi.mock("drizzle-orm", () => ({
  and: <T>(...predicates: Array<Predicate<T>>) => (row: T) => predicates.every((predicate) => predicate(row)),
  eq: <T>(field: keyof T, value: T[keyof T]) => (row: T) => row[field] === value,
  isNull: <T>(field: keyof T) => (row: T) => row[field] === null
}));

vi.mock("@fsm/db", () => ({
  companies: companiesTable,
  customers: customersTable,
  maintenancePlans: maintenancePlansTable,
  db: {
    select() {
      return {
        from(table: MockTable) {
          let filteredRows = [...getRows(table.__name)];

          return {
            where(predicate: Predicate<Record<string, unknown>>) {
              filteredRows = filteredRows.filter(predicate);
              return {
                limit(limitCount: number) {
                  return Promise.resolve(filteredRows.slice(0, limitCount));
                }
              };
            }
          };
        }
      };
    },
    update(table: MockTable) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(predicate: Predicate<Record<string, unknown>>) {
              const rows = getRows(table.__name).filter(predicate);

              for (const row of rows) {
                Object.assign(row, values);
              }

              return {
                returning() {
                  return Promise.resolve(rows);
                }
              };
            }
          };
        }
      };
    },
    async transaction<T>(callback: (tx: MockTransaction) => Promise<T>): Promise<T> {
      const tx: MockTransaction = {
        update: this.update,
        insert: (table: MockTable) => ({
          values(values: Record<string, unknown>) {
            const row = {
              id: randomUUID(),
              ...values
            };
            getRows(table.__name).push(row);
            return {
              returning() {
                return Promise.resolve([row]);
              }
            };
          }
        })
      };

      return callback(tx);
    }
  },
  emitEventWithExecutor: async (
    _executor: unknown,
    event: Omit<ActivityEventRecord, "id">
  ) => {
    state.activityEvents.push({
      id: randomUUID(),
      ...event
    });
  }
}));

vi.mock("../lib/invoice-service-bridge.js", () => ({
  forwardStripePaymentFailed: forwardStripePaymentFailedMock,
  forwardStripePaymentSuccess: forwardStripePaymentSuccessMock
}));

vi.mock("../lib/stripe-idempotency.js", () => ({
  isEventProcessed: async (stripeEventId: string) => processedEventIds.has(stripeEventId),
  claimEventProcessing: async (stripeEventId: string) => {
    if (claimedEventIds.has(stripeEventId)) {
      return false;
    }

    claimedEventIds.add(stripeEventId);
    return true;
  },
  clearEventProcessingClaim: async (stripeEventId: string) => {
    claimedEventIds.delete(stripeEventId);
  },
  markEventProcessed: async (stripeEventId: string) => {
    processedEventIds.add(stripeEventId);
    claimedEventIds.delete(stripeEventId);
  }
}));

type StripeHandlerModule = typeof import("./stripe.handler.js");

let stripeHandlerModule: StripeHandlerModule;

beforeAll(async () => {
  stripeHandlerModule = await import("./stripe.handler.js");
});

beforeEach(() => {
  // #45: pin renewal dates only — full fake timers break BullMQ if @fsm/jobs ever resolves to dist.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_WEBHOOK_TEST_NOW);
  resetState();
  notificationsQueueAddMock.mockReset();
  notificationsQueueAddMock.mockResolvedValue({ id: "mock-notification-job" });
  forwardStripePaymentFailedMock.mockReset();
  forwardStripePaymentSuccessMock.mockReset();
  errorLogMock.mockReset();
  infoLogMock.mockReset();
  warnLogMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function createLog() {
  return {
    info: infoLogMock,
    warn: warnLogMock,
    error: errorLogMock
  };
}

function createReplyRecorder(): FastifyReply & { statusCode: number | null; payload: unknown } {
  const recorder = {
    statusCode: null as number | null,
    payload: null as unknown,
    code(statusCode: number) {
      recorder.statusCode = statusCode;
      return recorder;
    },
    send(payload: unknown) {
      recorder.payload = payload;
      return recorder;
    }
  };

  return recorder as unknown as FastifyReply & { statusCode: number | null; payload: unknown };
}

function createRequestWithEvent(event: Stripe.Event): FastifyRequest {
  return {
    stripeEvent: event,
    log: createLog()
  } as unknown as FastifyRequest;
}

describe("stripe.handler", () => {
  it("handlePaymentIntentSucceeded forwards FSM invoice payments to the invoice service", async () => {
    const event = {
      id: "evt_pi_succeeded",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          metadata: {
            companyId: "company-1",
            invoiceId: "invoice-1"
          }
        }
      }
    } as unknown as Stripe.PaymentIntentSucceededEvent;

    await stripeHandlerModule.handlePaymentIntentSucceeded(event, createLog() as unknown as FastifyRequest["log"]);

    expect(forwardStripePaymentSuccessMock).toHaveBeenCalledWith(event);
  });

  it("handlePaymentIntentFailed forwards failed FSM invoice payments to the invoice service", async () => {
    const event = {
      id: "evt_pi_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_456",
          metadata: {
            companyId: "company-1",
            invoiceId: "invoice-1"
          }
        }
      }
    } as unknown as Stripe.PaymentIntentPaymentFailedEvent;

    await stripeHandlerModule.handlePaymentIntentFailed(event, createLog() as unknown as FastifyRequest["log"]);

    expect(forwardStripePaymentFailedMock).toHaveBeenCalledWith(event);
  });

  it("handleSubscriptionUpdated updates maintenance plan status and emits renewal when the period changes", async () => {
    const previousPeriodStart = new Date("2026-04-01T00:00:00.000Z");
    const nextPeriodStart = new Date("2026-05-01T00:00:00.000Z");
    const nextPeriodEnd = new Date("2026-06-01T00:00:00.000Z");
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id });
    const plan = seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      stripeSubscriptionId: "sub_123",
      stripeCurrentPeriodStart: previousPeriodStart
    });
    const event = {
      id: "evt_sub_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "past_due",
          current_period_start: Math.floor(nextPeriodStart.getTime() / 1000),
          current_period_end: Math.floor(nextPeriodEnd.getTime() / 1000),
          cancel_at_period_end: false,
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.CustomerSubscriptionUpdatedEvent;
    const expectedPeriodStart = nextPeriodStart.toISOString();

    await stripeHandlerModule.handleSubscriptionUpdated(event, createLog() as unknown as FastifyRequest["log"]);

    expect(plan.status).toBe("active");
    expect(plan.stripeCurrentPeriodStart?.toISOString()).toBe(expectedPeriodStart);
    expect(state.activityEvents.at(-1)?.eventType).toBe("maintenance_plan.renewed");
  });

  it("handleSubscriptionDeleted marks the maintenance plan cancelled and sets the end date", async () => {
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id });
    const plan = seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      stripeSubscriptionId: "sub_cancel"
    });
    const event = {
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_cancel",
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.CustomerSubscriptionDeletedEvent;

    await stripeHandlerModule.handleSubscriptionDeleted(event, createLog() as unknown as FastifyRequest["log"]);

    expect(plan.status).toBe("cancelled");
    expect(plan.endDate).not.toBeNull();
    expect(state.activityEvents.at(-1)?.eventType).toBe("maintenance_plan.cancelled");
  });

  it("handleInvoicePaymentSucceeded updates the maintenance plan and emits payment.received for subscription invoices", async () => {
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id, firstName: "Chris", lastName: "Pine" });
    const plan = seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      stripeSubscriptionId: "sub_success",
      name: "Gold Plan",
      price: "49.00",
      lastServiceDate: null
    });
    const event = {
      id: "evt_invoice_succeeded",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_success_123",
          subscription: "sub_success",
          amount_paid: 4900,
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.InvoicePaymentSucceededEvent;
    await stripeHandlerModule.handleInvoicePaymentSucceeded(event, createLog() as unknown as FastifyRequest["log"]);

    expect(plan.lastServiceDate).toBe(FIXED_RENEWAL_PAID_DATE);
    expect(state.activityEvents.at(-1)?.eventType).toBe("payment.received");
  });

  it("handleInvoicePaymentSucceeded ignores non-subscription invoices", async () => {
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id });
    const plan = seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      stripeSubscriptionId: "sub_unused",
      lastServiceDate: null
    });
    const event = {
      id: "evt_invoice_non_subscription",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_non_subscription",
          subscription: null,
          amount_paid: 4900,
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.InvoicePaymentSucceededEvent;

    await stripeHandlerModule.handleInvoicePaymentSucceeded(event, createLog() as unknown as FastifyRequest["log"]);

    expect(plan.lastServiceDate).toBeNull();
    expect(state.activityEvents).toHaveLength(0);
  });

  it("handleInvoicePaymentFailed queues a dunning notification for the company owner and emits payment.failed", async () => {
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id, firstName: "Chris", lastName: "Pine" });
    seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      stripeSubscriptionId: "sub_failed",
      name: "Gold Plan",
      price: "49.00"
    });
    const event = {
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_123",
          subscription: "sub_failed",
          amount_due: 4900,
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.InvoicePaymentFailedEvent;

    await stripeHandlerModule.handleInvoicePaymentFailed(event, createLog() as unknown as FastifyRequest["log"]);

    expect(notificationsQueueAddMock).toHaveBeenCalledWith(
      "send-service-agreement-email",
      {
        companyId: company.id,
        maintenancePlanId: state.maintenancePlans[0]?.id,
        emailType: "payment_failed",
        manageUrl: "http://localhost:3000/settings/service-agreements"
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
    expect(state.activityEvents.at(-1)?.eventType).toBe("payment.failed");
  });

  it("handleAccountUpdated stores the latest Stripe Connect flags on the company record", async () => {
    const company = seedCompany({
      stripeAccountId: "acct_123",
      settings: {}
    });
    const event = {
      id: "evt_account_updated",
      type: "account.updated",
      data: {
        object: {
          id: "acct_123",
          charges_enabled: true,
          payouts_enabled: false,
          details_submitted: true
        }
      }
    } as unknown as Stripe.AccountUpdatedEvent;

    await stripeHandlerModule.handleAccountUpdated(event, createLog() as unknown as FastifyRequest["log"]);

    expect(company.settings).toEqual({
      stripeConnect: {
        chargesEnabled: true,
        payoutsEnabled: false,
        detailsSubmitted: true
      }
    });
    expect(state.activityEvents.at(-1)?.eventType).toBe("company.updated");
  });

  it("stripeHandler returns 200 and skips duplicate subscription invoice success events after the first successful processing", async () => {
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id });
    const plan = seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      stripeSubscriptionId: "sub_duplicate_success",
      lastServiceDate: null
    });
    const firstReply = createReplyRecorder();
    const secondReply = createReplyRecorder();
    const event = {
      id: "evt_duplicate_invoice_success",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_duplicate_success",
          subscription: "sub_duplicate_success",
          amount_paid: 4900,
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.InvoicePaymentSucceededEvent;
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), firstReply);
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), secondReply);

    expect(firstReply.statusCode).toBe(200);
    expect(secondReply.statusCode).toBe(200);
    expect(plan.lastServiceDate).toBe(FIXED_RENEWAL_PAID_DATE);
    expect(state.activityEvents.filter((activityEvent) => activityEvent.eventType === "payment.received")).toHaveLength(1);
  });

  it("handleSubscriptionUpdated persists platform billing snapshot without touching maintenance plans", async () => {
    const company = seedCompany({ settings: {} });
    const event = {
      id: "evt_platform_sub_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_platform_1",
          status: "active",
          current_period_end: Math.floor(new Date("2026-07-01T00:00:00.000Z").getTime() / 1000),
          customer: "cus_platform_1",
          metadata: {
            companyId: company.id,
            billingKind: "platform_mvp"
          }
        }
      }
    } as unknown as Stripe.CustomerSubscriptionUpdatedEvent;

    await stripeHandlerModule.handleSubscriptionUpdated(event, createLog() as unknown as FastifyRequest["log"]);

    expect(state.maintenancePlans).toHaveLength(0);
    expect(company.settings).toEqual({
      stripePlatformBilling: {
        subscriptionId: "sub_platform_1",
        status: "active",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        planTier: null
      }
    });
    expect(company.stripeCustomerId).toBe("cus_platform_1");
    expect(state.activityEvents.at(-1)?.eventType).toBe("company.updated");
    expect(state.activityEvents.at(-1)?.summary).toBe("Platform subscription updated");
  });

  it("handleSubscriptionDeleted marks platform billing snapshot canceled", async () => {
    const company = seedCompany({
      settings: {
        stripePlatformBilling: {
          subscriptionId: "sub_platform_cancel",
          status: "active",
          currentPeriodEnd: "2026-08-01T00:00:00.000Z"
        }
      }
    });
    const event = {
      id: "evt_platform_sub_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_platform_cancel",
          status: "canceled",
          current_period_end: Math.floor(new Date("2026-08-01T00:00:00.000Z").getTime() / 1000),
          metadata: {
            companyId: company.id,
            billingKind: "platform_mvp"
          }
        }
      }
    } as unknown as Stripe.CustomerSubscriptionDeletedEvent;

    await stripeHandlerModule.handleSubscriptionDeleted(event, createLog() as unknown as FastifyRequest["log"]);

    expect(company.settings).toEqual({
      stripePlatformBilling: {
        subscriptionId: "sub_platform_cancel",
        status: "canceled",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z"
      }
    });
    expect(state.activityEvents.at(-1)?.summary).toBe("Platform subscription cancelled");
  });

  it("handleInvoicePaymentSucceeded ignores platform MVP subscription invoices", async () => {
    const company = seedCompany({
      settings: {
        stripePlatformBilling: {
          subscriptionId: "sub_platform_invoice",
          status: "active"
        }
      }
    });
    const event = {
      id: "evt_platform_invoice_success",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_platform",
          subscription: "sub_platform_invoice",
          amount_paid: 9900,
          metadata: {
            companyId: company.id
          }
        }
      }
    } as unknown as Stripe.InvoicePaymentSucceededEvent;

    await stripeHandlerModule.handleInvoicePaymentSucceeded(event, createLog() as unknown as FastifyRequest["log"]);

    expect(state.activityEvents).toHaveLength(0);
    expect(warnLogMock).not.toHaveBeenCalled();
  });

  it("stripeHandler returns 200 and skips duplicate platform subscription events after the first successful processing", async () => {
    const company = seedCompany({ settings: {} });
    const firstReply = createReplyRecorder();
    const secondReply = createReplyRecorder();
    const event = {
      id: "evt_duplicate_platform_sub",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_platform_dup",
          status: "trialing",
          current_period_end: Math.floor(new Date("2026-07-15T00:00:00.000Z").getTime() / 1000),
          metadata: {
            companyId: company.id,
            billingKind: "platform_mvp"
          }
        }
      }
    } as unknown as Stripe.CustomerSubscriptionCreatedEvent;

    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), firstReply);
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), secondReply);

    expect(firstReply.statusCode).toBe(200);
    expect(secondReply.statusCode).toBe(200);
    expect(state.activityEvents.filter((activityEvent) => activityEvent.eventType === "company.updated")).toHaveLength(1);
  });

  it("stripeHandler returns 200 and skips duplicate Stripe events after the first successful processing", async () => {
    const firstReply = createReplyRecorder();
    const secondReply = createReplyRecorder();
    const event = {
      id: "evt_duplicate",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_duplicate",
          metadata: {
            companyId: "company-1",
            invoiceId: "invoice-1"
          }
        }
      }
    } as unknown as Stripe.PaymentIntentSucceededEvent;

    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), firstReply);
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), secondReply);

    expect(firstReply.statusCode).toBe(200);
    expect(secondReply.statusCode).toBe(200);
    expect(forwardStripePaymentSuccessMock).toHaveBeenCalledTimes(1);
  });

  it("stripeHandler returns 500 when processing fails so Stripe redelivers, then 200 once a retry succeeds", async () => {
    const event = {
      id: "evt_fail_then_retry",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_fail", metadata: { companyId: "company-1", invoiceId: "invoice-1" } } }
    } as unknown as Stripe.PaymentIntentSucceededEvent;
    forwardStripePaymentSuccessMock.mockRejectedValueOnce(new Error("db down"));

    const failedReply = createReplyRecorder();
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), failedReply);

    expect(failedReply.statusCode).toBe(500);
    expect(failedReply.payload).toEqual({
      error: "STRIPE_WEBHOOK_PROCESSING_FAILED",
      message: "Stripe event processing failed; retry"
    });
    expect(errorLogMock).toHaveBeenCalled();

    const retryReply = createReplyRecorder();
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), retryReply);
    const duplicateReply = createReplyRecorder();
    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), duplicateReply);

    expect(retryReply.statusCode).toBe(200);
    expect(duplicateReply.statusCode).toBe(200);
    expect(forwardStripePaymentSuccessMock).toHaveBeenCalledTimes(2);
  });

  it("stripeHandler returns 200 on successful processing", async () => {
    const event = {
      id: "evt_ok",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_ok", metadata: { companyId: "company-1", invoiceId: "invoice-1" } } }
    } as unknown as Stripe.PaymentIntentSucceededEvent;
    const reply = createReplyRecorder();

    await stripeHandlerModule.stripeHandler(createRequestWithEvent(event), reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toEqual({ received: true });
  });
});
