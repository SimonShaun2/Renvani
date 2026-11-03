import { and, eq, isNull } from "drizzle-orm";

import { customers, db } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  OUTBOUND_AUTHORIZATION_POLICY_V1,
  evaluateOutboundAuthorization,
  type LoyaltyReminderProposeParamsV1
} from "@fsm/types";

import { createAgentActionProposal } from "./agent-action.service.js";
import { AGENT_POLICY_V1, assertActionAllowedForProduct } from "./agent-action.policy.js";
import { resolveEntityRef } from "./tenant-context.service.js";

export interface CreateLoyaltyReminderProposalInput {
  companyId: string;
  actorId: string;
  idempotencyKey: string;
  parameters: LoyaltyReminderProposeParamsV1;
}

export async function createLoyaltyReminderProposal(input: CreateLoyaltyReminderProposalInput) {
  assertActionAllowedForProduct("loyalty", "loyalty.reminder.propose", "ai");

  const target = await resolveEntityRef(input.companyId, "customer", input.parameters.customerId);

  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, input.parameters.customerId),
        eq(customers.companyId, input.companyId),
        isNull(customers.deletedAt)
      )
    )
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  if (customer.doNotContact) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Customer is marked do not contact");
  }

  const consentVersion = customer.updatedAt.getTime();
  const consentSnapshot = {
    consentScope: "marketing" as const,
    capturedAt: customer.updatedAt.toISOString(),
    consentVersion,
    currentConsentVersion: consentVersion,
    appointmentOptIn: !customer.doNotContact,
    marketingOptIn: !customer.doNotContact,
    revokedAt: customer.doNotContact ? customer.updatedAt.toISOString() : null
  };

  const authorization = evaluateOutboundAuthorization({
    policyVersion: OUTBOUND_AUTHORIZATION_POLICY_V1,
    kind: "queued_outreach",
    resourceCompanyId: input.companyId,
    actor: {
      companyId: input.companyId,
      actorId: input.actorId,
      actorType: "system"
    },
    channel: "sms",
    actionType: "loyalty.reminder.propose",
    consent: consentSnapshot,
    customer: {
      doNotContact: customer.doNotContact ?? false,
      prefersSms: customer.prefersSms ?? true,
      prefersEmail: customer.prefersEmail ?? true
    }
  });

  if (!authorization.allowed) {
    throw new AppError(
      ErrorCode.POLICY_DENIED,
      authorization.reason ?? "Outbound policy denied loyalty reminder proposal"
    );
  }

  return createAgentActionProposal({
    companyId: input.companyId,
    actorId: input.actorId,
    actorType: "ai",
    agentProduct: "loyalty",
    actionType: "loyalty.reminder.propose",
    policyVersion: AGENT_POLICY_V1,
    idempotencyKey: input.idempotencyKey,
    target,
    sourceEventIds: [],
    reason: input.parameters.summary,
    parameters: {
      ...input.parameters,
      channel: "sms",
      consentScope: "marketing",
      consentSnapshot,
      dryRun: true
    }
  });
}
