import { describe, expect, it } from "vitest";

import { AppError, ErrorCode } from "../../errors.js";

import {
  assertAgentActionApprovable,
  assertAgentActionExecutable,
  assertAgentActionTenantScope,
  assertNoDuplicateSideEffectExecution,
  assertNoUnapprovedSideEffects,
  evaluateAgentActionPolicyDecision,
  isTerminalAgentActionState
} from "./agent-action-state-machine.js";
import type { AgentActionLifecycleSliceV1 } from "./agent-action-state-machine.js";

const companyA = "11111111-1111-4111-8111-111111111111";
const companyB = "22222222-2222-4222-8222-222222222222";

function slice(overrides: Partial<AgentActionLifecycleSliceV1> = {}): AgentActionLifecycleSliceV1 {
  return {
    companyId: companyA,
    state: "awaiting_approval",
    actionType: "message.send_proposed",
    requiresApproval: true,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides
  };
}

describe("agent-action-state-machine (FS-12)", () => {
  it("treats succeeded and expired as terminal", () => {
    expect(isTerminalAgentActionState("succeeded")).toBe(true);
    expect(isTerminalAgentActionState("expired")).toBe(true);
    expect(isTerminalAgentActionState("approved")).toBe(false);
  });

  it("rejects cross-tenant access with NOT_FOUND", () => {
    try {
      assertAgentActionTenantScope(companyB, companyA);
      expect.fail("expected tenant error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it("requires manual approval for loyalty.reminder.propose", () => {
    const decision = evaluateAgentActionPolicyDecision({
      agentProduct: "loyalty",
      actionType: "loyalty.reminder.propose",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false
    });
    expect(decision.requiresApproval).toBe(true);
    expect(decision.initialState).toBe("awaiting_approval");
  });

  it("requires manual approval for message.send_proposed", () => {
    const decision = evaluateAgentActionPolicyDecision({
      agentProduct: "revenue",
      actionType: "message.send_proposed",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false
    });
    expect(decision.requiresApproval).toBe(true);
    expect(decision.initialState).toBe("awaiting_approval");
    expect(decision.allowsAutoExecute).toBe(false);
  });

  it("auto-approves read-only context.resolve", () => {
    const decision = evaluateAgentActionPolicyDecision({
      agentProduct: "revenue",
      actionType: "context.resolve",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false
    });
    expect(decision.initialState).toBe("policy_evaluated");
    expect(decision.allowsAutoExecute).toBe(true);
  });

  it("blocks unapproved side-effect execution", () => {
    try {
      assertNoUnapprovedSideEffects(slice({ state: "awaiting_approval" }));
      expect.fail("expected policy error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.POLICY_DENIED);
    }
  });

  it("allows execute when send_proposed is approved", () => {
    expect(() =>
      assertAgentActionExecutable(
        slice({ state: "approved", requiresApproval: true, actionType: "message.send_proposed" })
      )
    ).not.toThrow();
  });

  it("prevents duplicate send execution when already succeeded", () => {
    try {
      assertNoDuplicateSideEffectExecution(
        slice({ state: "succeeded", requiresApproval: true, actionType: "message.send_proposed" })
      );
      expect.fail("expected duplicate error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.CONFLICT);
    }
  });

  it("prevents approve on terminal cancelled actions", () => {
    try {
      assertAgentActionApprovable(slice({ state: "cancelled" }));
      expect.fail("expected terminal error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.CONFLICT);
    }
  });
});
