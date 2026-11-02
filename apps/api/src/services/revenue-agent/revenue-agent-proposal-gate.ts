import { featureFlags } from "@fsm/config/feature-flags";
import { AppError, ErrorCode } from "@fsm/types";

/** FS-194: one gate covers new proposals and state changes on proposals created before disablement. */
export function assertRevenueAgentProposalsEnabled(): void {
  if (!featureFlags.revenueAgentProposalsEnabled) {
    throw new AppError(ErrorCode.FORBIDDEN, "Revenue Agent proposals are not enabled");
  }
}
