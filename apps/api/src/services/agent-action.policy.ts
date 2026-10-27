import { featureFlags } from "@fsm/config/feature-flags";

import { AppError, ErrorCode } from "@fsm/types";

import {
  type AgentActorType,
  getAgentActionTypeDefinition,
  getAgentProductDefinition
} from "./agent-action.registry.js";

export const AGENT_POLICY_V1 = "agent-policy-v1";

export function assertPolicyVersion(policyVersion: string): void {
  if (policyVersion !== AGENT_POLICY_V1) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Unsupported agent policy version");
  }
}

export function assertActionAllowedForProduct(
  agentProduct: string,
  actionType: string,
  actorType: AgentActorType
): void {
  const product = getAgentProductDefinition(agentProduct);
  if (!product) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Agent product is not enabled");
  }

  const definition = getAgentActionTypeDefinition(actionType);
  if (!definition || definition.agentProduct !== agentProduct) {
    throw new AppError(
      ErrorCode.POLICY_DENIED,
      `Action type is not allowed for ${agentProduct} agent`
    );
  }

  product.assertActorAllowed(definition, actorType);
}

/** Unknown action types always require approval. */
export function requiresHumanApproval(actionType: string): boolean {
  return getAgentActionTypeDefinition(actionType)?.autoApproved !== true;
}

/** Operators may edit parameters of these action types while awaiting approval. */
export function isAgentActionEditable(actionType: string): boolean {
  return getAgentActionTypeDefinition(actionType)?.editable === true;
}

/** FS-72 founder gate — blocks customer-visible execution while dry-run / disabled. */
export function assertLoyaltyReminderExecutionAllowed(): void {
  if (!featureFlags.loyaltyRemindersEnabled) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Loyalty reminders are disabled");
  }

  if (featureFlags.loyaltyRemindersDryRun) {
    throw new AppError(
      ErrorCode.POLICY_DENIED,
      "Loyalty reminder customer sends remain dry-run until founder approval"
    );
  }
}
