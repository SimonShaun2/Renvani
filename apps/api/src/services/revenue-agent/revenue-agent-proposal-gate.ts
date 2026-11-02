import { featureFlags } from "@fsm/config/feature-flags";
import { AppError, ErrorCode } from "@fsm/types";

import { getAgentActionTypeDefinition } from "../agent-action.registry.js";

/** FS-194: one gate covers new proposals and state changes on proposals created before disablement. */
export function assertRevenueAgentProposalsEnabled(): void {
  if (!featureFlags.revenueAgentProposalsEnabled) {
    throw new AppError(ErrorCode.FORBIDDEN, "Revenue Agent proposals are not enabled");
  }
}

export function assertRevenueAgentProposalActionEnabled(actionType: string): void {
  const definition = getAgentActionTypeDefinition(actionType);
  if (definition?.agentProduct === "revenue" && definition.fromRecommendationType) {
    assertRevenueAgentProposalsEnabled();
  }
}
