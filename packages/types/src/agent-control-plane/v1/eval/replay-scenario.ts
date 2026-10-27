import { AppError, ErrorCode } from "../../../errors.js";
import { evaluateOutboundAuthorization } from "../../../outbound-policy/evaluate.js";
import { OUTBOUND_AUTHORIZATION_POLICY_V1 } from "../../../outbound-policy/types.js";
import {
  assertAgentActionExecutable,
  assertAgentActionRetryAllowed,
  evaluateAgentActionPolicyDecision
} from "../agent-action-state-machine.js";
import type { AgentEvalScenarioFixture } from "./scenarios.fixture.js";

const EVAL_CONSENT = {
  consentScope: "marketing" as const,
  capturedAt: "2026-10-01T12:00:00.000Z",
  consentVersion: 2,
  appointmentOptIn: true,
  marketingOptIn: true,
  revokedAt: null,
  currentConsentVersion: 2
};

const EVAL_CUSTOMER = {
  doNotContact: false,
  prefersSms: true,
  prefersEmail: true
};

const companyId = "11111111-1111-4111-8111-111111111111";

export interface AgentEvalReplayResult {
  scenarioId: string;
  passed: boolean;
  failures: string[];
}

function replayPolicyStep(fixture: AgentEvalScenarioFixture): string[] {
  const failures: string[] = [];

  if (fixture.denyUnknownTool) {
    try {
      evaluateAgentActionPolicyDecision({
        agentProduct: "revenue",
        actionType: fixture.denyUnknownTool,
        actorType: "ai",
        policyVersion: "agent-policy-v1",
        requiresApproval: false
      });
      failures.push(`expected policy evaluation to reject unknown tool ${fixture.denyUnknownTool}`);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== ErrorCode.POLICY_DENIED) {
        failures.push(
          `expected POLICY_DENIED for ${fixture.denyUnknownTool}, got ${String(error)}`
        );
      }
    }
  }

  if (!fixture.policy) {
    return failures;
  }

  const step = fixture.policy;

  const decision = evaluateAgentActionPolicyDecision({
    agentProduct: step.agentProduct,
    actionType: step.actionType,
    actorType: step.actorType,
    policyVersion: step.policyVersion,
    requiresApproval: step.requiresApproval
  });

  if (decision.initialState !== step.expectInitialState) {
    failures.push(
      `initialState expected ${step.expectInitialState}, got ${decision.initialState}`
    );
  }
  if (decision.requiresApproval !== step.expectRequiresApproval) {
    failures.push(
      `requiresApproval expected ${step.expectRequiresApproval}, got ${decision.requiresApproval}`
    );
  }
  if (decision.allowsAutoExecute !== step.expectAllowsAutoExecute) {
    failures.push(
      `allowsAutoExecute expected ${step.expectAllowsAutoExecute}, got ${decision.allowsAutoExecute}`
    );
  }

  return failures;
}

function replayOutboundStep(fixture: AgentEvalScenarioFixture): string[] {
  if (!fixture.outbound) {
    return [];
  }

  const step = fixture.outbound;
  const outboundInput = {
    policyVersion: OUTBOUND_AUTHORIZATION_POLICY_V1,
    kind: step.kind,
    resourceCompanyId: step.resourceCompanyId,
    actor: {
      companyId: step.actorCompanyId,
      actorId: "eval-actor",
      actorType: "user" as const
    },
    channel: step.channel,
    actionType: step.actionType,
    consent: EVAL_CONSENT,
    customer: EVAL_CUSTOMER,
    ...(step.approvalRequired
      ? { approval: { required: true, approved: step.approvalGranted } }
      : {})
  };

  const decision = evaluateOutboundAuthorization(outboundInput);

  const failures: string[] = [];
  if (decision.allowed !== step.expectAllowed) {
    failures.push(`outbound allowed expected ${step.expectAllowed}, got ${decision.allowed}`);
  }
  if (step.expectFailureCode && decision.failureCode !== step.expectFailureCode) {
    failures.push(
      `outbound failureCode expected ${step.expectFailureCode}, got ${decision.failureCode ?? "none"}`
    );
  }
  return failures;
}

function replayLifecycleSteps(fixture: AgentEvalScenarioFixture): string[] {
  if (!fixture.lifecycle?.length) {
    return [];
  }

  const failures: string[] = [];
  const expiresAt = new Date(Date.now() + 60_000);

  for (const step of fixture.lifecycle) {
    const slice = {
      companyId,
      state: step.state,
      actionType: step.actionType,
      requiresApproval: step.requiresApproval,
      expiresAt
    };

    if (step.state === "failed" && fixture.id === "failure_recovery") {
      try {
        assertAgentActionRetryAllowed(slice);
        failures.push("expected retry to be blocked for failed actions");
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== ErrorCode.CONFLICT) {
          failures.push(`expected CONFLICT on failed retry, got ${String(error)}`);
        }
      }
    }

    try {
      assertAgentActionExecutable(slice);
      if (!step.expectExecutable) {
        failures.push(`expected lifecycle step ${step.state} to be non-executable`);
      }
    } catch (error) {
      if (step.expectExecutable) {
        failures.push(`expected lifecycle step ${step.state} to execute: ${String(error)}`);
        continue;
      }
      if (step.expectErrorCode) {
        if (!(error instanceof AppError)) {
          failures.push(`expected AppError with ${step.expectErrorCode}, got ${String(error)}`);
        } else if (error.code !== step.expectErrorCode) {
          failures.push(`expected error code ${step.expectErrorCode}, got ${error.code}`);
        }
      }
    }
  }

  return failures;
}

export function replayAgentEvalScenario(fixture: AgentEvalScenarioFixture): AgentEvalReplayResult {
  const failures = [
    ...replayPolicyStep(fixture),
    ...replayOutboundStep(fixture),
    ...replayLifecycleSteps(fixture)
  ];

  return {
    scenarioId: fixture.id,
    passed: failures.length === 0,
    failures
  };
}

export function replayAllAgentEvalScenarios(
  fixtures: readonly AgentEvalScenarioFixture[]
): AgentEvalReplayResult[] {
  return fixtures.map((fixture) => replayAgentEvalScenario(fixture));
}
