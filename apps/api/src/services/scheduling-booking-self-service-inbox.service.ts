import { createHash } from "node:crypto";

import type { BookingManageTokenPayload } from "../lib/booking-manage-token.js";
import { createAgentActionProposal } from "./agent-action.service.js";
import { AGENT_POLICY_V1 } from "./agent-action.policy.js";
import { resolveEntityRef } from "./tenant-context.service.js";

export async function notifyOperatorBookingSelfService(input: {
  companyId: string;
  claims: BookingManageTokenPayload;
  action: "reschedule" | "cancel";
  summary: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}): Promise<void> {
  const target = await resolveEntityRef(input.companyId, "job", input.claims.jobId);
  const idempotencyKey = createHash("sha256")
    .update(
      `${input.claims.jti}:${input.action}:${input.scheduledStart ?? ""}:${input.scheduledEnd ?? ""}`
    )
    .digest("hex");

  await createAgentActionProposal({
    companyId: input.companyId,
    actorId: input.companyId,
    actorType: "system",
    agentProduct: "scheduling",
    actionType: "scheduling.booking.self_service",
    policyVersion: AGENT_POLICY_V1,
    idempotencyKey,
    target,
    sourceEventIds: [],
    reason: input.summary,
    parameters: {
      channel: "internal",
      action: input.action,
      referenceNumber: input.claims.referenceNumber,
      bookingRequestId: input.claims.bookingRequestId,
      jobId: input.claims.jobId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      recipient: {
        firstName: "Dispatch",
        lastName: "Team"
      },
      proposedMessage: input.summary
    }
  });
}
