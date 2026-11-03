import { AppError, ErrorCode, OUTBOUND_AUTHORIZATION_POLICY_V1 } from "@fsm/types";

import { getAgentAction } from "../agent-action.service.js";
import { authorizeAgentActionExecution } from "../outbound-policy-engine.service.js";

const REVENUE_PROPOSAL_PREFIX = "revenue.";

export interface RevenueProposalConsentCheck {
  actionId: string;
  channel: "sms" | "email";
  consentScope: "appointment" | "marketing";
  /** True when the outbound policy would let this proposal send on its channel once approved. */
  allowed: boolean;
  /** Consent-blocked state for the card: policy denied for consent / contact preferences. */
  blocked: boolean;
  reason: string;
  failureCode: string | null;
  policyVersion: string;
}

/**
 * Read-only consent/policy check for a Revenue Agent proposal: runs the same outbound policy as
 * execute (customer opt-in, do-not-contact, channel prefs) with approval assumed, so the operator
 * sees a consent-blocked proposal before approving it. Nothing is sent or written.
 */
export async function checkRevenueProposalConsent(
  companyId: string,
  actorId: string,
  actionId: string
): Promise<RevenueProposalConsentCheck> {
  const action = await getAgentAction(companyId, actionId);
  if (!action.actionType.startsWith(REVENUE_PROPOSAL_PREFIX)) {
    throw new AppError(ErrorCode.NOT_FOUND, "Revenue proposal not found");
  }

  const parameters = action.approvedParameters ?? action.parameters;
  let decision: Awaited<ReturnType<typeof authorizeAgentActionExecution>>;
  try {
    decision = await authorizeAgentActionExecution({
      companyId,
      actorId,
      actorType: "user",
      actionType: action.actionType,
      parameters,
      target: action.target,
      requiresApproval: action.requiresApproval,
      state: "approved"
    });
  } catch (error) {
    // Execute rejects an unsupported channel or a scope that disagrees with the action policy (#301).
    // The read-only check reports that as consent-blocked instead of failing the card request.
    if (!(error instanceof AppError) || error.code !== ErrorCode.CONSENT_REQUIRED) throw error;
    decision = {
      allowed: false,
      policyVersion: OUTBOUND_AUTHORIZATION_POLICY_V1,
      reason: error.message,
      failureCode: "CONSENT_REQUIRED",
      errorCode: ErrorCode.CONSENT_REQUIRED
    };
  }

  return {
    actionId: action.id,
    channel: parameters.channel === "email" ? "email" : "sms",
    consentScope: parameters.consentScope === "appointment" ? "appointment" : "marketing",
    allowed: decision.allowed,
    blocked: !decision.allowed,
    reason: decision.reason,
    failureCode: decision.failureCode ?? null,
    policyVersion: decision.policyVersion
  };
}
