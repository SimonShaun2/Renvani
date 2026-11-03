import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, valuesMock, onConflictDoNothingMock, warnLogMock } = vi.hoisted(() => {
  const onConflictDoNothingMock = vi.fn(async () => undefined);
  const valuesMock = vi.fn(() => ({ onConflictDoNothing: onConflictDoNothingMock }));
  const insertMock = vi.fn(() => ({ values: valuesMock }));
  return { insertMock, valuesMock, onConflictDoNothingMock, warnLogMock: vi.fn() };
});

vi.mock("@fsm/db", () => ({ db: { insert: insertMock }, messageLogs: { __table: "message_logs" } }));
vi.mock("pino", () => ({ default: () => ({ warn: warnLogMock, info: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));

import { recordTransactionalEmailMessageLog } from "./transactional-email-message-log.js";

const input = {
  companyId: "company-1",
  customerId: "customer-1",
  toAddress: "a@example.com",
  fromAddress: "noreply@example.com",
  delivery: { templateId: "booking.confirmation" as const, subject: "Confirmed", providerMessageId: "msg-1" },
  sourceSystem: "booking_notification" as const,
  sourceId: "booking-1"
};

describe("recordTransactionalEmailMessageLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts with onConflictDoNothing so retries do not fail on the unique key", async () => {
    await recordTransactionalEmailMessageLog(input);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(1);
  });

  it("does not set deliveredAt at send time and records subject/providerMessageId", async () => {
    await recordTransactionalEmailMessageLog(input);
    const row = (valuesMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row.deliveredAt).toBeUndefined();
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(row.subject).toBe("Confirmed");
    expect(row.providerMessageId).toBe("msg-1");
    expect(row.providerStatus).toBe("sent");
  });

  it("swallows and logs DB errors so logging never fails the job", async () => {
    onConflictDoNothingMock.mockRejectedValueOnce(new Error("db down"));
    await expect(recordTransactionalEmailMessageLog(input)).resolves.toBeUndefined();
    expect(warnLogMock).toHaveBeenCalledTimes(1);
  });

  it("logs only the error name and Postgres code, never SQL, params, email or subject", async () => {
    const cause = Object.assign(new Error("duplicate key"), { code: "23505" });
    const dbError = Object.assign(
      new Error('Failed query: insert into "message_logs" params: a@example.com,Confirmed'),
      { query: 'insert into "message_logs"', params: ["a@example.com", "Confirmed"], cause }
    );
    onConflictDoNothingMock.mockRejectedValueOnce(dbError);
    await recordTransactionalEmailMessageLog(input);
    const payload = (warnLogMock.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload.errorName).toBe("Error");
    expect(payload.errorCode).toBe("23505");
    expect(payload).not.toHaveProperty("err");
    const serialized = JSON.stringify(payload);
    for (const leak of ["a@example.com", "Confirmed", "insert into", "params", "Failed query"]) {
      expect(serialized).not.toContain(leak);
    }
  });
});
