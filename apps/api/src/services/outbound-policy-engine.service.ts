import { and, eq, isNull } from "drizzle-orm";

import { bookingRequests, customers, db, isPhoneSmsOptedOut, normalizePhoneE164 } from "@fsm/db";
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
      targetPhone: row.phone,
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

    // Customer preferences have no opt-in fields. Inquiry updatedAt can change for scheduling,
    // so it cannot order consent decisions. Conflicting records for the current phone deny.
    // Include soft-deleted inquiries so deleting a decline cannot revive an older grant.
    // FS-281: phones are compared in normalised E.164 form (customer phones are stored E.164, booking phones as
    // 10 digits). A phone that cannot be normalised never matches, so it yields no consent evidence (fail closed).
    const customerPhoneE164 = normalizePhoneE164(row.phone);
    const customerInquiries = await db
      .select()
      .from(bookingRequests)
      .where(and(eq(bookingRequests.companyId, companyId), eq(bookingRequests.customerId, row.id)));
    const inquiries = customerPhoneE164
      ? customerInquiries.filter((inquiry) => normalizePhoneE164(inquiry.phone) === customerPhoneE164)
      : [];
    const consentVersion = inquiries.reduce(
      (latest, inquiry) => Math.max(latest, inquiry.updatedAt.getTime()),
      row.updatedAt.getTime()
    );
    const capturedAt = new Date(consentVersion).toISOString();
    const hasMatchingSmsEvidence = channel === "sms" && !!row.phone && inquiries.length > 0;
    return {
      targetPhone: row.phone,
      consentScope,
      capturedAt,
      consentVersion,
      currentConsentVersion: consentVersion,
      appointmentOptIn: hasMatchingSmsEvidence && inquiries.every((inquiry) => inquiry.smsConsentAppointments === true),
      marketingOptIn: hasMatchingSmsEvidence && inquiries.every((inquiry) => inquiry.smsConsentMarketing === true),
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

/**
 * FS-281: platform-wide phone-level opt-out (`sms_opt_outs`, written by every inbound STOP).
 *
 * Tenant isolation: this is a plain-db read of a platform table with no company_id. It is safe because Renvani
 * sends every tenant's SMS from one shared Twilio number (#295 ruling): a STOP withdraws consent for that phone
 * for every tenant, the query is keyed only by the target's own phone, and it returns a yes/no, no row data.
 * Fail closed: a phone that cannot be normalised, or a failed lookup, counts as opted out. The caller folds that
 * into `consent.revokedAt` so the shared policy evaluator still applies its tenant/approval checks first and
 * then denies with CONSENT_REQUIRED.
 */
async function isTargetPhoneSmsOptedOut(phone: string | null): Promise<boolean> {
  const phoneE164 = normalizePhoneE164(phone);
  if (!phoneE164) return true;
  try {
    return await isPhoneSmsOptedOut(phoneE164);
  } catch {
    return true;
  }
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
  const { targetPhone, ...consent } = await loadConsentSnapshotForTarget(
    input.companyId,
    input.target,
    consentScope,
    channel
  );
  if (channel === "sms" && (await isTargetPhoneSmsOptedOut(targetPhone))) {
    consent.revokedAt = consent.capturedAt;
  }
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
