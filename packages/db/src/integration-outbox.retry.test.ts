import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirstOperation: vi.fn(),
  findFirstAudit: vi.fn(),
  insertAudit: vi.fn(),
  updateOperation: vi.fn()
}));

vi.mock("./client.js", () => ({
  db: {
    query: {
      integrationOutboxOperations: {
        findFirst: mocks.findFirstOperation
      },
      integrationOutboxAuditEvents: {
        findFirst: mocks.findFirstAudit
      }
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.insertAudit,
        onConflictDoNothing: vi.fn(() => ({ returning: mocks.insertAudit }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mocks.updateOperation
        }))
      }))
    }))
  }
}));

vi.mock("./run-with-tenant-session.js", async () => {
  const { db } = await import("./client.js");
  return {
    runTransactionWithTenantSession: (_companyId: string, cb: (tx: unknown) => unknown) => cb(db)
  };
});

import { recordIntegrationOutboxRetryReceipt } from "./integration-outbox.service.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const operationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const correlationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const retryReceiptKeyForAttempt = (attempt: number) => `${operationId}:${correlationId}:retry:${attempt}`;

describe("recordIntegrationOutboxRetryReceipt idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirstOperation.mockResolvedValue({
      id: operationId,
      companyId,
      kind: "sms_outbound",
      adapterId: "notifications_v1",
      idempotencyKey: "notifications_v1:msg-1",
      correlationId,
      status: "pending",
      attemptCount: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      attribution: {},
      payload: {}
    });
    mocks.findFirstAudit.mockResolvedValue(null);
    mocks.updateOperation.mockResolvedValue([
      {
        id: operationId,
        companyId,
        attemptCount: 1,
        status: "processing"
      }
    ]);
    mocks.insertAudit.mockResolvedValue([
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        companyId,
        outboxOperationId: operationId,
        eventType: "retry_receipt",
        retryReceiptKey: retryReceiptKeyForAttempt(1),
        receipt: {},
        createdAt: new Date()
      }
    ]);
  });

  it("returns deduplicated=true when retry receipt key already exists", async () => {
    const receiptKey = retryReceiptKeyForAttempt(1);
    mocks.findFirstAudit.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "existing-audit",
      companyId,
      outboxOperationId: operationId,
      eventType: "retry_receipt",
      retryReceiptKey: receiptKey,
      receipt: { schemaVersion: 1 },
      createdAt: new Date()
    });

    const first = await recordIntegrationOutboxRetryReceipt(companyId, operationId, {
      schemaVersion: 1,
      correlationId,
      attemptNumber: 1,
      idempotencyKey: "notifications_v1:msg-1",
      source: "worker"
    });

    expect(first.deduplicated).toBe(false);

    mocks.findFirstAudit.mockResolvedValue({
      id: "existing-audit",
      companyId,
      outboxOperationId: operationId,
      eventType: "retry_receipt",
      retryReceiptKey: receiptKey,
      receipt: { schemaVersion: 1 },
      createdAt: new Date()
    });

    const second = await recordIntegrationOutboxRetryReceipt(companyId, operationId, {
      schemaVersion: 1,
      correlationId,
      attemptNumber: 1,
      idempotencyKey: "notifications_v1:msg-1",
      source: "worker"
    });

    expect(second.deduplicated).toBe(true);
    expect(second.auditEvent.id).toBe("existing-audit");
  });

  it("rejects a receipt whose correlationId does not match the operation", async () => {
    await expect(
      recordIntegrationOutboxRetryReceipt(companyId, operationId, {
        schemaVersion: 1,
        correlationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        attemptNumber: 1,
        idempotencyKey: "notifications_v1:msg-1",
        source: "worker"
      })
    ).rejects.toThrow("INTEGRATION_OUTBOX_CORRELATION_MISMATCH");
    expect(mocks.updateOperation).not.toHaveBeenCalled();
  });

  it("does not reopen a terminal operation (guarded update matches no row)", async () => {
    mocks.updateOperation.mockResolvedValueOnce([]);
    await expect(
      recordIntegrationOutboxRetryReceipt(companyId, operationId, {
        schemaVersion: 1,
        correlationId,
        attemptNumber: 2,
        idempotencyKey: "notifications_v1:msg-1",
        source: "worker"
      })
    ).rejects.toThrow("INTEGRATION_OUTBOX_TERMINAL");
    expect(mocks.insertAudit).not.toHaveBeenCalled();
  });
});
