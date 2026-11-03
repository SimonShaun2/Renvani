import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

const mocks = vi.hoisted(() => ({
  getIntegrationOutboxOperationById: vi.fn(),
  listIntegrationOutboxAuditEvents: vi.fn()
}));

vi.mock("@fsm/db", () => ({
  getIntegrationOutboxOperationById: mocks.getIntegrationOutboxOperationById,
  listIntegrationOutboxAuditEvents: mocks.listIntegrationOutboxAuditEvents,
  createOrGetIntegrationOutboxOperation: vi.fn(),
  recordIntegrationOutboxRetryReceipt: vi.fn()
}));

import { getIntegrationOutboxAuditTrail } from "./integration-outbox-audit.service.js";

describe("integration-outbox-audit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes audit reads to the tenant operation", async () => {
    const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const operationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    mocks.getIntegrationOutboxOperationById.mockResolvedValue({
      id: operationId,
      companyId,
      kind: "email_outbound",
      adapterId: "notifications_v1",
      idempotencyKey: "notifications_v1:1",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "pending",
      attemptCount: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    mocks.listIntegrationOutboxAuditEvents.mockResolvedValue([
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        companyId,
        outboxOperationId: operationId,
        eventType: "created",
        retryReceiptKey: null,
        receipt: { schemaVersion: 1 },
        createdAt: new Date()
      }
    ]);

    const trail = await getIntegrationOutboxAuditTrail(companyId, operationId, 25);

    expect(mocks.getIntegrationOutboxOperationById).toHaveBeenCalledWith(companyId, operationId);
    expect(trail).toHaveLength(1);
    expect(trail[0]?.eventType).toBe("created");
  });

  it("returns NOT_FOUND when operation is outside tenant scope", async () => {
    mocks.getIntegrationOutboxOperationById.mockResolvedValue(null);

    await expect(
      getIntegrationOutboxAuditTrail(
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "11111111-1111-4111-8111-111111111111"
      )
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
