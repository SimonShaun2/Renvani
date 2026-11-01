import { randomUUID } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

type CompanyRecord = {
  id: string;
  name: string;
  deletedAt: Date | null;
};

type CustomerRecord = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  doNotContact: boolean;
  deletedAt: Date | null;
  updatedAt: Date;
};

type MessageLogRecord = {
  id: string;
  companyId: string;
  customerId: string | null;
  channel: "sms";
  direction: "inbound" | "outbound";
  fromAddress: string | null;
  toAddress: string | null;
  body: string;
  providerMessageId: string | null;
  deletedAt?: Date | null;
  createdAt?: Date;
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
  insert(table: MockTable): {
    values(values: Record<string, unknown>): {
      returning(): Promise<Array<Record<string, unknown>>>;
    };
  };
  update(table: MockTable): {
    set(values: Record<string, unknown>): {
      where(predicate: Predicate<Record<string, unknown>>): {
        returning(): Promise<Array<Record<string, unknown>>>;
      };
    };
  };
}

const state = {
  companies: [] as CompanyRecord[],
  customers: [] as CustomerRecord[],
  messageLogs: [] as MessageLogRecord[],
  activityEvents: [] as ActivityEventRecord[]
};

const companiesTable = {
  __name: "companies",
  id: "id",
  deletedAt: "deletedAt"
} as const;

const customersTable = {
  __name: "customers",
  id: "id",
  companyId: "companyId",
  phone: "phone",
  deletedAt: "deletedAt"
} as const;

const messageLogsTable = {
  __name: "messageLogs",
  companyId: "companyId",
  channel: "channel",
  direction: "direction",
  toAddress: "toAddress",
  deletedAt: "deletedAt",
  createdAt: "createdAt"
} as const;

function getRows(tableName: string): Array<Record<string, unknown>> {
  switch (tableName) {
    case "companies":
      return state.companies;
    case "customers":
      return state.customers;
    case "messageLogs":
      return state.messageLogs;
    default:
      return [];
  }
}

function resetState(): void {
  state.companies.length = 0;
  state.customers.length = 0;
  state.messageLogs.length = 0;
  state.activityEvents.length = 0;
}

function seedCompany(values: Partial<CompanyRecord> = {}): CompanyRecord {
  const company: CompanyRecord = {
    id: values.id ?? randomUUID(),
    name: values.name ?? "Acme HVAC",
    deletedAt: values.deletedAt ?? null
  };
  state.companies.push(company);
  return company;
}

function seedCustomer(values: Partial<CustomerRecord> & Pick<CustomerRecord, "companyId">): CustomerRecord {
  const customer: CustomerRecord = {
    id: values.id ?? randomUUID(),
    companyId: values.companyId,
    firstName: values.firstName ?? "Chris",
    lastName: values.lastName ?? "Pine",
    phone: values.phone ?? "555-0100",
    doNotContact: values.doNotContact ?? false,
    deletedAt: values.deletedAt ?? null,
    updatedAt: values.updatedAt ?? new Date()
  };
  state.customers.push(customer);
  return customer;
}

vi.mock("drizzle-orm", () => ({
  and: <T>(...predicates: Array<Predicate<T>>) => (row: T) => predicates.every((predicate) => predicate(row)),
  eq: <T>(field: keyof T, value: T[keyof T]) => (row: T) => row[field] === value,
  isNull: <T>(field: keyof T) => (row: T) => row[field] === null || row[field] === undefined,
  desc: (field: string) => ({ field, direction: "desc" })
}));

vi.mock("@fsm/db", () => ({
  companies: companiesTable,
  customers: customersTable,
  messageLogs: messageLogsTable,
  db: {
    select() {
      return {
        from(table: MockTable) {
          let filteredRows = [...getRows(table.__name)];

          return {
            where(predicate: Predicate<Record<string, unknown>>) {
              filteredRows = filteredRows.filter(predicate);
              const limited = {
                limit(limitCount: number) {
                  return Promise.resolve(filteredRows.slice(0, limitCount));
                }
              };
              return {
                ...limited,
                orderBy(order: { field: string; direction: "desc" }) {
                  filteredRows.sort(
                    (a, b) => ((b[order.field] as Date)?.getTime() ?? 0) - ((a[order.field] as Date)?.getTime() ?? 0)
                  );
                  return limited;
                }
              };
            }
          };
        }
      };
    },
    insert(table: MockTable) {
      return {
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
        insert: this.insert,
        update: this.update
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

type TwilioHandlerModule = typeof import("./twilio.handler.js");

let twilioHandlerModule: TwilioHandlerModule;

beforeAll(async () => {
  twilioHandlerModule = await import("./twilio.handler.js");
});

beforeEach(() => {
  resetState();
});

function createReply() {
  const reply = {
    statusCode: 200,
    contentType: "",
    payload: undefined as unknown,
    code(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    type(contentType: string) {
      this.contentType = contentType;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    }
  };

  return reply as unknown as FastifyReply & {
    statusCode: number;
    contentType: string;
    payload: unknown;
  };
}

function createRequest(params: Record<string, string>): FastifyRequest {
  return {
    twilioParams: params,
    headers: {},
    protocol: "https",
    url: "/twilio",
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  } as unknown as FastifyRequest;
}

function seedOutbound(companyId: string, toAddress: string, createdAt: Date): void {
  state.messageLogs.push({
    id: randomUUID(),
    companyId,
    customerId: null,
    channel: "sms",
    direction: "outbound",
    fromAddress: "+15555555555",
    toAddress,
    body: "Your tech is on the way",
    providerMessageId: null,
    deletedAt: null,
    createdAt
  });
}

const PHONE = "555-0100";

async function inbound(body: string, from = PHONE) {
  const reply = createReply();
  await twilioHandlerModule.twilioHandler(
    createRequest({ From: from, To: "+15555555555", Body: body, MessageSid: `SM${randomUUID()}` }),
    reply
  );
  return reply;
}

function inboundLogs() {
  return state.messageLogs.filter((row) => row.direction === "inbound");
}

function expectEmptyTwiml(reply: Awaited<ReturnType<typeof inbound>>) {
  expect(reply.statusCode).toBe(200);
  expect(reply.contentType).toBe("text/xml");
  expect(reply.payload).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

describe("twilio.handler", () => {
  it("STOP withdraws consent for the customer and logs under its tenant", async () => {
    const company = seedCompany();
    const customer = seedCustomer({ companyId: company.id, phone: PHONE });
    const reply = await inbound("STOP");
    expectEmptyTwiml(reply);
    expect(state.customers.find((row) => row.id === customer.id)?.doNotContact).toBe(true);
    expect(inboundLogs()).toHaveLength(1);
    expect(inboundLogs()[0]).toMatchObject({ companyId: company.id, customerId: customer.id });
    expect(state.activityEvents.some((row) => row.eventType === "customer.updated")).toBe(true);
  });

  it("two tenants, same phone: STOP withdraws consent at both, each logged under its own tenant", async () => {
    const a = seedCompany({ name: "A" });
    const b = seedCompany({ name: "B" });
    const ca = seedCustomer({ companyId: a.id, phone: PHONE });
    const cb = seedCustomer({ companyId: b.id, phone: PHONE });
    const other = seedCustomer({ companyId: b.id, phone: "555-0199" });
    expectEmptyTwiml(await inbound(" stop "));
    expect(state.customers.find((r) => r.id === ca.id)?.doNotContact).toBe(true);
    expect(state.customers.find((r) => r.id === cb.id)?.doNotContact).toBe(true);
    expect(state.customers.find((r) => r.id === other.id)?.doNotContact).toBe(false);
    expect(inboundLogs().map((r) => [r.companyId, r.customerId]).sort()).toEqual(
      [[a.id, ca.id], [b.id, cb.id]].sort()
    );
    for (const event of state.activityEvents.filter((e) => e.eventType === "customer.updated")) {
      const target = state.customers.find((c) => c.id === event.entityId);
      expect(event.companyId).toBe(target?.companyId);
    }
  });

  it("two tenants, same phone: non-STOP routes to the most recent outbound tenant only, no consent change anywhere", async () => {
    const a = seedCompany({ name: "A" });
    const b = seedCompany({ name: "B" });
    const ca = seedCustomer({ companyId: a.id, phone: PHONE, doNotContact: true });
    const cb = seedCustomer({ companyId: b.id, phone: PHONE, doNotContact: true });
    seedOutbound(b.id, PHONE, new Date("2026-10-27T15:00:00Z"));
    seedOutbound(b.id, PHONE, new Date("2026-10-28T15:00:00Z"));
    const before = state.customers.map((c) => ({ ...c }));
    expectEmptyTwiml(await inbound("Can you call me back?"));
    expect(inboundLogs()).toHaveLength(1);
    expect(inboundLogs()[0]).toMatchObject({ companyId: b.id, customerId: cb.id });
    // Never opts anyone back in, and nothing in tenant A (or B's customer row) is written.
    expect(state.customers).toEqual(before);
    expect(state.customers.find((r) => r.id === ca.id)?.doNotContact).toBe(true);
    expect(state.activityEvents.every((e) => e.companyId === b.id)).toBe(true);
    expect(state.activityEvents.some((e) => e.eventType === "customer.updated")).toBe(false);
  });

  it("ambiguous: recent outbound rows span several companies -> no-op", async () => {
    const a = seedCompany({ name: "A" });
    const b = seedCompany({ name: "B" });
    seedCustomer({ companyId: a.id, phone: PHONE });
    seedCustomer({ companyId: b.id, phone: PHONE });
    seedOutbound(a.id, PHONE, new Date("2026-10-28T14:00:00Z"));
    seedOutbound(b.id, PHONE, new Date("2026-10-28T15:00:00Z"));
    expectEmptyTwiml(await inbound("yes"));
    expect(inboundLogs()).toHaveLength(0);
    expect(state.activityEvents).toHaveLength(0);
  });

  it("no outbound history -> no-op even when exactly one company/customer exists", async () => {
    const a = seedCompany();
    seedCustomer({ companyId: a.id, phone: PHONE });
    expectEmptyTwiml(await inbound("Can you call me back?"));
    expect(inboundLogs()).toHaveLength(0);
    expect(state.activityEvents).toHaveLength(0);
  });

  it("unknown phone: STOP and non-STOP are both no-ops", async () => {
    const a = seedCompany();
    seedCustomer({ companyId: a.id, phone: PHONE });
    expectEmptyTwiml(await inbound("STOP", "555-0999"));
    expectEmptyTwiml(await inbound("hello", "555-0999"));
    expect(state.customers[0]?.doNotContact).toBe(false);
    expect(inboundLogs()).toHaveLength(0);
    expect(state.activityEvents).toHaveLength(0);
  });

  it("routed tenant without a matching customer logs with customerId null", async () => {
    const a = seedCompany();
    seedOutbound(a.id, PHONE, new Date("2026-10-28T15:00:00Z"));
    expectEmptyTwiml(await inbound("who is this?"));
    expect(inboundLogs()[0]).toMatchObject({ companyId: a.id, customerId: null });
  });

  it("missing fields -> 200 TwiML, no writes", async () => {
    const reply = createReply();
    await twilioHandlerModule.twilioHandler(createRequest({ To: "+15555555555", Body: "hi" }), reply);
    expectEmptyTwiml(reply);
    expect(state.messageLogs).toHaveLength(0);
  });
});
