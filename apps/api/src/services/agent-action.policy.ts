import { featureFlags } from "@fsm/config/feature-flags";

import { AppError, ErrorCode } from "@fsm/types";

export const AGENT_POLICY_V1 = "agent-policy-v1";

const REVENUE_ALLOWED_ACTION_TYPES = new Set([
  "context.resolve",
  "message.draft",
  "message.send_proposed",
  "revenue.inquiry.qualify"
]);

const LOYALTY_ALLOWED_ACTION_TYPES = new Set(["loyalty.reminder.propose"]);

const SCHEDULING_ALLOWED_ACTION_TYPES = new Set(["scheduling.booking.self_service"]);

const AUTO_APPROVED_ACTION_TYPES = new Set(["context.resolve", "message.draft"]);

/** AI may create these proposals; execution still requires owner approval where applicable. */
const AI_PROPOSAL_ACTION_TYPES = new Set([
  "message.send_proposed",
  "revenue.inquiry.qualify",
  "loyalty.reminder.propose"
]);

export function assertPolicyVersion(policyVersion: string): void {
  if (policyVersion !== AGENT_POLICY_V1) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Unsupported agent policy version");
  }
}

export function assertActionAllowedForProduct(
  agentProduct: string,
  actionType: string,
  actorType: "user" | "system" | "ai" | "customer"
): void {
  if (agentProduct === "revenue") {
    if (!REVENUE_ALLOWED_ACTION_TYPES.has(actionType)) {
      throw new AppError(ErrorCode.POLICY_DENIED, "Action type is not allowed for revenue agent");
    }
    if (actorType === "ai" && AI_PROPOSAL_ACTION_TYPES.has(actionType)) {
      return;
    }
    if (actorType === "ai" && !AUTO_APPROVED_ACTION_TYPES.has(actionType)) {
      throw new AppError(
        ErrorCode.POLICY_DENIED,
        "AI actor cannot perform this action without human approval"
      );
    }
    return;
  }

  if (agentProduct === "loyalty") {
    if (!LOYALTY_ALLOWED_ACTION_TYPES.has(actionType)) {
      throw new AppError(ErrorCode.POLICY_DENIED, "Action type is not allowed for loyalty agent");
    }

    if (actorType === "ai") {
      return;
    }

    throw new AppError(
      ErrorCode.POLICY_DENIED,
      "Only AI may propose loyalty reminder actions in v1"
    );
  }

  if (agentProduct === "scheduling") {
    if (!SCHEDULING_ALLOWED_ACTION_TYPES.has(actionType)) {
      throw new AppError(ErrorCode.POLICY_DENIED, "Action type is not allowed for scheduling agent");
    }

    if (actorType === "system" || actorType === "user") {
      return;
    }

    throw new AppError(ErrorCode.POLICY_DENIED, "Scheduling self-service notices require a system actor");
  }

  throw new AppError(ErrorCode.POLICY_DENIED, "Agent product is not enabled");
}

export function requiresHumanApproval(actionType: string): boolean {
  if (
    actionType === "message.send_proposed" ||
    actionType === "loyalty.reminder.propose" ||
    actionType === "scheduling.booking.self_service"
  ) {
    return true;
  }
  return !AUTO_APPROVED_ACTION_TYPES.has(actionType);
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
