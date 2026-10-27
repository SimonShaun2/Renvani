import type { AgentActionStateV1 } from "../agent-action-state.js";

/** FS-16 — replayable local eval scenarios (deterministic, no live sends). */
export type AgentEvalScenarioId =
  | "intent"
  | "quote"
  | "handoff"
  | "policy_deny"
  | "failure_recovery";

export interface AgentEvalPolicyStepFixture {
  agentProduct: string;
  actionType: string;
  actorType: "user" | "system" | "ai" | "customer";
  policyVersion: string;
  requiresApproval: boolean;
  expectInitialState: AgentActionStateV1;
  expectRequiresApproval: boolean;
  expectAllowsAutoExecute: boolean;
}

export interface AgentEvalOutboundStepFixture {
  kind: "agent_action_execute" | "queued_outreach";
  resourceCompanyId: string;
  actorCompanyId: string;
  channel: "sms" | "email";
  actionType: string;
  approvalRequired: boolean;
  approvalGranted: boolean;
  expectAllowed: boolean;
  expectFailureCode?: string;
}

export interface AgentEvalLifecycleStepFixture {
  state: AgentActionStateV1;
  actionType: string;
  requiresApproval: boolean;
  expectExecutable: boolean;
  expectErrorCode?: string;
}

export interface AgentEvalScenarioFixture {
  id: AgentEvalScenarioId;
  summary: string;
  /** When set, policy replay asserts this tool is rejected (not in v1 registry). */
  denyUnknownTool?: string;
  policy?: AgentEvalPolicyStepFixture;
  outbound?: AgentEvalOutboundStepFixture;
  lifecycle?: AgentEvalLifecycleStepFixture[];
}

export const AGENT_EVAL_SCENARIO_FIXTURES: readonly AgentEvalScenarioFixture[] = [
  {
    id: "intent",
    summary: "Read-only intent resolution auto-passes policy without outbound send",
    policy: {
      agentProduct: "revenue",
      actionType: "context.resolve",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false,
      expectInitialState: "policy_evaluated",
      expectRequiresApproval: false,
      expectAllowsAutoExecute: true
    }
  },
  {
    id: "quote",
    summary: "Agent may draft quote copy without approval or live customer send",
    policy: {
      agentProduct: "revenue",
      actionType: "message.draft",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false,
      expectInitialState: "policy_evaluated",
      expectRequiresApproval: false,
      expectAllowsAutoExecute: true
    }
  },
  {
    id: "handoff",
    summary: "Operator handoff blocks send until approved; approved send is executable",
    policy: {
      agentProduct: "revenue",
      actionType: "message.send_proposed",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false,
      expectInitialState: "awaiting_approval",
      expectRequiresApproval: true,
      expectAllowsAutoExecute: false
    },
    outbound: {
      kind: "agent_action_execute",
      resourceCompanyId: "11111111-1111-4111-8111-111111111111",
      actorCompanyId: "11111111-1111-4111-8111-111111111111",
      channel: "sms",
      actionType: "message.send_proposed",
      approvalRequired: true,
      approvalGranted: false,
      expectAllowed: false,
      expectFailureCode: "UNAUTHORIZED_SEND"
    },
    lifecycle: [
      {
        state: "awaiting_approval",
        actionType: "message.send_proposed",
        requiresApproval: true,
        expectExecutable: false,
        expectErrorCode: "POLICY_DENIED"
      },
      {
        state: "approved",
        actionType: "message.send_proposed",
        requiresApproval: true,
        expectExecutable: true
      }
    ]
  },
  {
    id: "policy_deny",
    summary: "Unknown tools and cross-tenant outbound are denied with explicit codes",
    denyUnknownTool: "invoice.charge",
    outbound: {
      kind: "queued_outreach",
      resourceCompanyId: "22222222-2222-4222-8222-222222222222",
      actorCompanyId: "11111111-1111-4111-8111-111111111111",
      channel: "sms",
      actionType: "customer_message",
      approvalRequired: false,
      approvalGranted: false,
      expectAllowed: false,
      expectFailureCode: "CROSS_TENANT_ACCESS"
    }
  },
  {
    id: "failure_recovery",
    summary: "Failed actions cannot retry in place; fresh intent proposals remain allowed",
    lifecycle: [
      {
        state: "failed",
        actionType: "message.send_proposed",
        requiresApproval: true,
        expectExecutable: false,
        expectErrorCode: "CONFLICT"
      }
    ],
    policy: {
      agentProduct: "revenue",
      actionType: "context.resolve",
      actorType: "ai",
      policyVersion: "agent-policy-v1",
      requiresApproval: false,
      expectInitialState: "policy_evaluated",
      expectRequiresApproval: false,
      expectAllowsAutoExecute: true
    }
  }
];
