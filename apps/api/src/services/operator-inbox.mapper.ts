import {
  OPERATOR_INBOX_DETAIL_FIELDS,
  OPERATOR_INBOX_UI_VERSION,
  type OperatorInboxChecks,
  type OperatorInboxPricing,
  type OperatorInboxItem,
  type OperatorInboxProposedContent,
  type OperatorInboxProvenanceEvent,
  type OperatorInboxRecipient,
  type OperatorInboxRiskLevel,
  type OperatorOverridePath
} from "@fsm/types";

import type { AgentActionState } from "./agent-action.service.js";
import { getAgentActionTypeDefinition } from "./agent-action.registry.js";

export interface AgentActionRowView {
  id: string;
  agentProduct: string;
  actionType: string;
  parameters: Record<string, unknown>;
  approvedParameters: Record<string, unknown> | null;
  sourceEventIds: string[];
  policyVersion: string;
  requiresApproval: boolean;
  state: AgentActionState;
  confidence: string | null;
  reason: string | null;
  expiresAt: string;
  reviewerId: string | null;
  executionReceipt: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
}

export interface OperatorInboxItemExtras {
  proposalNumber?: string;
  proposalVersion?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Risk and consequences come from the agent-action registry (per-kind entries, no switch). */
export function resolveRiskLevel(actionType: string): OperatorInboxRiskLevel {
  return getAgentActionTypeDefinition(actionType)?.risk ?? "low";
}

const DEFAULT_CONSEQUENCES = ["Applies the proposed agent action according to policy."];

export function resolveConsequences(actionType: string): string[] {
  const consequences = getAgentActionTypeDefinition(actionType)?.consequences;
  return consequences && consequences.length > 0 ? [...consequences] : [...DEFAULT_CONSEQUENCES];
}

export function resolveOverridePaths(state: AgentActionState, requiresApproval: boolean): OperatorOverridePath[] {
  const paths: OperatorOverridePath[] = [];

  if (state === "awaiting_approval" || state === "policy_evaluated") {
    paths.push("reject", "edit", "approve");
  }

  if (state === "awaiting_approval" || state === "policy_evaluated" || state === "approved") {
    paths.push("escalate");
  }

  if (state === "approved" || (!requiresApproval && state === "policy_evaluated")) {
    paths.push("execute");
  }

  if (state === "succeeded" || state === "failed" || state === "cancelled" || state === "expired") {
    return [];
  }

  return paths;
}

export function extractRecipient(parameters: Record<string, unknown>): OperatorInboxRecipient {
  const recipient = asRecord(parameters.recipient);
  const firstName = readString(recipient.firstName) ?? "";
  const lastName = readString(recipient.lastName) ?? "";
  const displayName = `${firstName} ${lastName}`.trim() || "Unknown recipient";
  const channelRaw = readString(parameters.channel);

  return {
    displayName,
    ...(channelRaw === "sms" || channelRaw === "email" ? { channel: channelRaw } : {}),
    phone: readString(recipient.phone),
    email: readString(recipient.email)
  };
}

export function extractProposedContent(parameters: Record<string, unknown>): OperatorInboxProposedContent {
  const channelRaw = readString(parameters.channel);
  const body = readString(parameters.body) ?? "(no message body)";

  return {
    ...(channelRaw === "sms" || channelRaw === "email" ? { channel: channelRaw } : {}),
    subject: readString(parameters.subject),
    body
  };
}

function readDisplayValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return readString(value);
}

function pickFields<T extends Record<string, readonly string[]>>(
  parameters: Record<string, unknown>,
  fields: T
): { [K in keyof T]: string | null } {
  const out = {} as { [K in keyof T]: string | null };
  for (const field of Object.keys(fields) as (keyof T)[]) {
    out[field] = fields[field]!.map((key) => readDisplayValue(parameters[key])).find((v) => v !== null) ?? null;
  }
  return out;
}

/** Price/check chips from proposal parameters, driven by OPERATOR_INBOX_DETAIL_FIELDS. */
export function extractPricing(parameters: Record<string, unknown>): OperatorInboxPricing {
  return pickFields(parameters, OPERATOR_INBOX_DETAIL_FIELDS.pricing);
}

export function extractChecks(parameters: Record<string, unknown>): OperatorInboxChecks {
  return pickFields(parameters, OPERATOR_INBOX_DETAIL_FIELDS.checks);
}

export function formatProposalNumber(sequence: number): string {
  return `P-${String(sequence).padStart(4, "0")}`;
}

export function toOperatorInboxItem(
  row: AgentActionRowView,
  sourceEvents: OperatorInboxProvenanceEvent[],
  extras: OperatorInboxItemExtras = {}
): OperatorInboxItem {
  const activeParameters = row.approvedParameters ?? row.parameters;

  return {
    contractVersion: OPERATOR_INBOX_UI_VERSION,
    id: row.id,
    state: row.state,
    risk: resolveRiskLevel(row.actionType),
    recipient: extractRecipient(activeParameters),
    proposedContent: extractProposedContent(activeParameters),
    consequences: resolveConsequences(row.actionType),
    expiresAt: row.expiresAt,
    overridePaths: resolveOverridePaths(row.state, row.requiresApproval),
    requiresApproval: row.requiresApproval,
    provenance: {
      agentProduct: row.agentProduct,
      actionType: row.actionType,
      sourceEventIds: row.sourceEventIds,
      sourceEvents,
      createdAt: row.createdAt,
      reason: row.reason,
      confidence: row.confidence ? Number(row.confidence) : null,
      policyVersion: row.policyVersion
    },
    executionReceipt: row.executionReceipt,
    reviewerId: row.reviewerId,
    ...(row.updatedAt ? { version: new Date(row.updatedAt).getTime() } : {}),
    ...(extras.proposalNumber ? { proposalNumber: extras.proposalNumber } : {}),
    ...(extras.proposalVersion ? { proposalVersion: extras.proposalVersion } : {}),
    pricing: extractPricing(activeParameters),
    checks: extractChecks(activeParameters)
  };
}
