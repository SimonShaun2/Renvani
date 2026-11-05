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

const STORED_PHONE = "(555) 010-0100";

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
  activityEvents: [] as ActivityEventRecord[],
  smsOptOuts: [] as Array<{ phoneE164: string; source: string; providerMessageId: string | null }>
};

// Mirrors @fsm/import-normalize normalizePhoneE164 (the webhook package does not depend on it directly).
function normalizePhoneE164(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/gu, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Mirrors the SQL in @fsm/db phoneMatchesE164: digits-only compare (with/without the US leading 1).
function phoneMatchesE164(field: string, phoneE164: string) {
  const digits = phoneE164.replace(/\D/gu, "");
  const candidates = digits.length === 11 && digits.startsWith("1") ? [digits, digits.slice(1)] : [digits];
  return (row: Record<string, unknown>) => candidates.includes(String(row[field] ?? "").replace(/[^0-9]/gu, ""));
}

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
  state.smsOptOuts.length = 0;
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
    phone: values.phone ?? STORED_PHONE,
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
  normalizePhoneE164,
  phoneMatchesE164,
  recordSmsOptOut: async (
    _executor: unknown,
    input: { phoneE164: string; source: string; providerMessageId: string | null }
  ) => {
    const existing = state.smsOptOuts.find((row) => row.phoneE164 === input.phoneE164);
    if (existing) Object.assign(existing, input);
    else state.smsOptOuts.push({ ...input });
  },
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

/** Twilio always sends E.164; stored customer phones may be legacy formats (FS-281: no backfill). */
const PHONE = "+15550100100";

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
    const other = seedCustomer({ companyId: b.id, phone: "555-019-9999" });
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

  it("unknown phone: STOP records a phone-level opt-out only; non-STOP is a no-op (FS-281)", async () => {
    const a = seedCompany();
    seedCustomer({ companyId: a.id });
    expectEmptyTwiml(await inbound("STOP", "+15550999999"));
    expectEmptyTwiml(await inbound("hello", "+15550999999"));
    expect(state.customers[0]?.doNotContact).toBe(false);
    expect(inboundLogs()).toHaveLength(0);
    expect(state.activityEvents).toHaveLength(0);
    expect(state.smsOptOuts).toEqual([
      expect.objectContaining({ phoneE164: "+15550999999", source: "twilio_stop" })
    ]);
  });

  it("every STOP writes the phone-level opt-out, also when customers match", async () => {
    const a = seedCompany();
    seedCustomer({ companyId: a.id });
    expectEmptyTwiml(await inbound("STOP"));
    expect(state.smsOptOuts.map((row) => row.phoneE164)).toEqual([PHONE]);
    expectEmptyTwiml(await inbound("STOP"));
    expect(state.smsOptOuts).toHaveLength(1);
  });

  it.each(["STOP", "stop", " Stop ", "STOPALL", "stop all", "UNSUBSCRIBE", "unsubscribe", "CANCEL", "End", "quit", "\tQUIT\n"])(
    "keyword %j withdraws consent (case/whitespace-insensitive)",
    async (body) => {
      const a = seedCompany();
      const customer = seedCustomer({ companyId: a.id });
      expectEmptyTwiml(await inbound(body));
      expect(state.customers.find((row) => row.id === customer.id)?.doNotContact).toBe(true);
      expect(state.smsOptOuts.map((row) => row.phoneE164)).toEqual([PHONE]);
    }
  );

  it.each(["START", "UNSTOP", "stop texting me so much", "please cancel my appointment", "YES"])(
    "%j is not a STOP keyword (START/UNSTOP stay FS-270)",
    async (body) => {
      const a = seedCompany();
      const customer = seedCustomer({ companyId: a.id });
      expectEmptyTwiml(await inbound(body));
      expect(state.customers.find((row) => row.id === customer.id)?.doNotContact).toBe(false);
      expect(state.smsOptOuts).toHaveLength(0);
    }
  );

  it.each(["5550100100", "555.010.0100", "+1 (555) 010-0100", "15550100100", "+15550100100"])(
    "stored legacy phone %j matches the E.164 From without a backfill",
    async (stored) => {
      const a = seedCompany();
      const customer = seedCustomer({ companyId: a.id, phone: stored });
      expectEmptyTwiml(await inbound("STOP"));
      expect(state.customers.find((row) => row.id === customer.id)?.doNotContact).toBe(true);
    }
  );

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
