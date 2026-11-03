import { describe, expect, it, vi } from "vitest";

vi.mock("@fsm/db", () => ({
  db: {},
  agentActions: {},
  emitEventWithExecutor: vi.fn()
}));

// FS-25: agent-action.service imports the job brief service, which loads @fsm/jobs queues (env at import).
vi.mock("./job-service-brief.service.js", () => ({
  applyApprovedJobServiceBrief: vi.fn(),
  applyApprovedJobServiceBriefInTransaction: vi.fn()
}));

import { AppError, ErrorCode, type CanonicalEntityRefV1 } from "@fsm/types";

import { resolveExecutableParameters } from "./agent-action.service.js";
import * as outboundPolicy from "./outbound-policy-engine.service.js";

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  agentProduct: "revenue" as const,
  actionType: "message.send_proposed",
  parameters: { channel: "sms", body: "Drifted after approval" },
  approvedParameters: { channel: "sms", body: "Approved snapshot" },
  target: {
    contractVersion: "1.0.0",
    entityType: "booking_request",
    entityId: "33333333-3333-4333-8333-333333333333",
    companyId: "22222222-2222-4222-8222-222222222222",
    observedAt: "2026-01-01T00:00:00.000Z",
    recordVersion: "1"
  } satisfies CanonicalEntityRefV1,
  sourceEventIds: [],
  idempotencyKey: "idem",
  payloadHash: "hash",
  policyVersion: "agent-policy-v1",
  requiresApproval: true,
  state: "approved" as const,
  confidence: null,
  reason: null,
  expiresAt: new Date(Date.now() + 60_000),
  reviewerId: "44444444-4444-4444-8444-444444444444",
  executionReceipt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("resolveExecutableParameters", () => {
  it("blocks execute when approval is required but approved_parameters is missing", () => {
    try {
      resolveExecutableParameters({
        ...baseRow,
        approvedParameters: null
      });
      expect.fail("expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.CONFLICT);
    }
  });

  it("returns approved snapshot even when live parameters drift", () => {
    const resolved = resolveExecutableParameters(baseRow);
    expect(resolved.body).toBe("Approved snapshot");
    expect(resolved.body).not.toBe(baseRow.parameters.body);
  });
});

describe("executeAgentAction outbound authorization", () => {
  it("passes approved snapshot parameters to outbound authorization", async () => {
    const authorizeSpy = vi.spyOn(outboundPolicy, "authorizeAgentActionExecution").mockResolvedValue({
      allowed: true,
      policyVersion: "outbound-auth-v1",
      reason: "ok"
    });

    const row = { ...baseRow };
    const executableParameters = resolveExecutableParameters(row);

    await outboundPolicy.authorizeAgentActionExecution({
      companyId: row.companyId,
      actorId: "user-1",
      actorType: "user",
      actionType: row.actionType,
      parameters: executableParameters,
      target: row.target,
      requiresApproval: row.requiresApproval,
      state: row.state
    });

    expect(authorizeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: expect.objectContaining({ body: "Approved snapshot" })
      })
    );

    authorizeSpy.mockRestore();
  });
});
