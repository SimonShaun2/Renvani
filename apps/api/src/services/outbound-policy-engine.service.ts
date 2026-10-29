import { and, desc, eq, isNull } from "drizzle-orm";

import { bookingRequests, customers, db } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type CanonicalEntityRefV1,
  type ConsentScope,
  type OutboundAuthorizationDecision,
  OUTBOUND_AUTHORIZATION_POLICY_V1,
  evaluateOutboundAuthorization
} from "@fsm/types";

import type { AgentActionState } from "./agent-action.service.js";

export interface AuthorizeAgentActionExecutionInput {
  companyId: string;
  actorId: string;
  actorType: "user" | "system" | "ai" | "customer";
  assertedCompanyId?: string;
  actionType: string;
  parameters: Record<string, unknown>;
  target: CanonicalEntityRefV1;
  requiresApproval: boolean;
  state: AgentActionState;
}

async function loadConsentSnapshotForTarget(
  companyId: string,
  target: CanonicalEntityRefV1,
  consentScope: ConsentScope,
  channel: "sms" | "email"
) {
  if (target.entityType === "booking_request") {
    const [row] = await db
      .select()
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.id, target.entityId),
          eq(bookingRequests.companyId, companyId),
          isNull(bookingRequests.deletedAt)
        )
      )
      .limit(1);

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Booking request not found for consent evaluation");
    }

    const consentVersion = row.updatedAt.getTime();
    return {
      consentScope,
      capturedAt: row.updatedAt.toISOString(),
      consentVersion,
      currentConsentVersion: consentVersion,
      appointmentOptIn: channel === "sms" && row.smsConsentAppointments === true,
      marketingOptIn: channel === "sms" && row.smsConsentMarketing === true,
      revokedAt: null
    };
  }

  if (target.entityType === "customer") {
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, target.entityId), eq(customers.companyId, companyId), isNull(customers.deletedAt))
      )
      .limit(1);

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found for consent evaluation");
    }

    // Customer preferences have no opt-in fields. The latest tenant-owned, contact-matching
    // inquiry is the only stored affirmative SMS grant; later opt-outs supersede older grants.
    const [latestInquiry] = await db
      .select()
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.companyId, companyId),
          eq(bookingRequests.customerId, row.id),
          isNull(bookingRequests.deletedAt)
        )
      )
      .orderBy(desc(bookingRequests.updatedAt))
      .limit(1);
    const consentVersion = latestInquiry?.updatedAt.getTime() ?? row.updatedAt.getTime();
    const capturedAt = latestInquiry?.updatedAt.toISOString() ?? row.updatedAt.toISOString();
    const matchingSmsGrant = channel === "sms" && !!row.phone && latestInquiry?.phone === row.phone;
    return {
      consentScope,
      capturedAt,
      consentVersion,
      currentConsentVersion: consentVersion,
      appointmentOptIn: matchingSmsGrant && latestInquiry?.smsConsentAppointments === true,
      marketingOptIn: matchingSmsGrant && latestInquiry?.smsConsentMarketing === true,
      revokedAt: row.doNotContact ? capturedAt : null
    };
  }

  throw new AppError(ErrorCode.VALIDATION_ERROR, "Unsupported target for outbound consent evaluation");
}

async function loadCustomerChannelPrefs(
  companyId: string,
  target: CanonicalEntityRefV1
): Promise<{ doNotContact: boolean; prefersSms: boolean; prefersEmail: boolean }> {
  let customerId: string | null = null;

  if (target.entityType === "customer") {
    customerId = target.entityId;
  }

  if (target.entityType === "booking_request") {
    const [row] = await db
      .select()
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.id, target.entityId),
          eq(bookingRequests.companyId, companyId),
          isNull(bookingRequests.deletedAt)
        )
      )
      .limit(1);
    customerId = row?.customerId ?? null;
  }

  if (!customerId) {
    return { doNotContact: false, prefersSms: true, prefersEmail: true };
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.id, customerId), eq(customers.companyId, companyId), isNull(customers.deletedAt))
    )
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found for outbound authorization");
  }

  return {
    doNotContact: customer.doNotContact ?? false,
    prefersSms: customer.prefersSms ?? true,
    prefersEmail: customer.prefersEmail ?? true
  };
}

function resolveConsentScope(actionType: string, target: CanonicalEntityRefV1): ConsentScope {
  if (actionType === "message.send_proposed" && target.entityType === "booking_request") return "appointment";
  if (actionType === "revenue.invoice_reminder.propose" || actionType === "revenue.estimate_followup.propose") {
    return "appointment";
  }
  return "marketing";
}

export async function authorizeAgentActionExecution(
  input: AuthorizeAgentActionExecutionInput
): Promise<OutboundAuthorizationDecision> {
  if (input.parameters.channel !== "sms" && input.parameters.channel !== "email") {
    throw new AppError(ErrorCode.CONSENT_REQUIRED, "Proposal must specify a supported outbound channel");
  }
  const channel = input.parameters.channel;
  const consentScope = resolveConsentScope(input.actionType, input.target);
  if (input.parameters.consentScope !== undefined && input.parameters.consentScope !== consentScope) {
    throw new AppError(ErrorCode.CONSENT_REQUIRED, "Proposal consent scope does not match the action policy");
  }
  // Proposal snapshots are historical evidence. Execute always reads current tenant-owned consent.
  const consent = await loadConsentSnapshotForTarget(input.companyId, input.target, consentScope, channel);
  const customer = await loadCustomerChannelPrefs(input.companyId, input.target);

  const decision = evaluateOutboundAuthorization({
    policyVersion: OUTBOUND_AUTHORIZATION_POLICY_V1,
    kind: "agent_action_execute",
    resourceCompanyId: input.target.companyId,
    actor: {
      companyId: input.companyId,
      actorId: input.actorId,
      actorType: input.actorType,
      ...(input.assertedCompanyId !== undefined
        ? { assertedCompanyId: input.assertedCompanyId }
        : {})
    },
    channel,
    actionType: input.actionType,
    consent,
    customer,
    approval: {
      required: input.requiresApproval,
      approved: input.state === "approved"
    }
  });

  return decision;
}

export function assertOutboundAuthorizationAllowed(decision: OutboundAuthorizationDecision): void {
  if (decision.allowed) {
    return;
  }

  throw new AppError(decision.errorCode ?? ErrorCode.POLICY_DENIED, decision.reason);
}
