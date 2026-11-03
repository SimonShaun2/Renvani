/** FS-234 consent authority. Not wired to outbound execution until migration 0062 and review gates land. */
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  bookingRequests,
  customers,
  emitEventWithExecutor,
  outboundConsentCaptureReceipts,
  outboundConsentEvents,
  outboundConsentStates,
  runTransactionWithTenantSession,
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  evaluateCurrentOutboundConsent,
  outboundConsentIntentSchema,
  outboundConsentKeySchema,
  outboundConsentChannelSchema,
  outboundConsentPurposeSchema,
  type OutboundConsentCheck,
  type OutboundConsentKey,
  type OutboundConsentDecisionInput,
} from "@fsm/types";
import { assertConsentReplayMatches, assertVerifiedConsentSource, fingerprintConsentDecision } from "./outbound-consent-decision.js";
import { fingerprintConsentCaptureReceipt, verifyPersistedConsentReceipt, type ConsentCaptureReceiptFacts, type TrustedConsentActor } from "./outbound-consent-receipt.js";

type TenantTx = Parameters<Parameters<typeof runTransactionWithTenantSession>[1]>[0];
type ActiveSubject = { companyId: string; contact: string | null; doNotContact: boolean };

export type { TrustedConsentActor } from "./outbound-consent-receipt.js";

function assertTrustedTenant(companyId: string, keyCompanyId: string): void {
  if (companyId !== keyCompanyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Consent key belongs to another tenant");
  }
}

// Source-specific receipt writers and approved public copy are not present. Keep the generic writer inert.
const CONSENT_RECEIPT_BOUNDARY_ACTIVE = false;

export const operatorRevokeSchema = z.object({
  customerId: z.string().uuid(),
  channel: outboundConsentChannelSchema,
  purpose: outboundConsentPurposeSchema,
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();

function keyWhere(key: OutboundConsentKey) {
  return and(
    eq(outboundConsentStates.companyId, key.companyId),
    eq(outboundConsentStates.subjectType, key.subjectType),
    eq(outboundConsentStates.subjectId, key.subjectId),
    eq(outboundConsentStates.channel, key.channel),
    eq(outboundConsentStates.purpose, key.purpose),
    eq(outboundConsentStates.contact, key.contact),
    isNull(outboundConsentStates.deletedAt),
  );
}

async function loadActiveSubject(tx: TenantTx, key: OutboundConsentKey): Promise<ActiveSubject | null> {
  if (key.subjectType === "customer") {
    const [customer] = await tx.select({
      email: customers.email, phone: customers.phone, doNotContact: customers.doNotContact,
    }).from(customers).where(and(
      eq(customers.companyId, key.companyId), eq(customers.id, key.subjectId), isNull(customers.deletedAt),
    )).limit(1);
    return customer ? { companyId: key.companyId, contact: key.channel === "email" ? customer.email : customer.phone, doNotContact: customer.doNotContact ?? false } : null;
  }

  const [request] = await tx.select({
    email: bookingRequests.email, phone: bookingRequests.phone, customerId: bookingRequests.customerId,
  }).from(bookingRequests).where(and(
    eq(bookingRequests.companyId, key.companyId), eq(bookingRequests.id, key.subjectId), isNull(bookingRequests.deletedAt),
  )).limit(1);
  if (!request) return null;
  if (!request.customerId) {
    return { companyId: key.companyId, contact: key.channel === "email" ? request.email : request.phone, doNotContact: false };
  }
  const [customer] = await tx.select({ doNotContact: customers.doNotContact }).from(customers).where(and(
    eq(customers.companyId, key.companyId), eq(customers.id, request.customerId), isNull(customers.deletedAt),
  )).limit(1);
  if (!customer) return null;
  return { companyId: key.companyId, contact: key.channel === "email" ? request.email : request.phone, doNotContact: customer.doNotContact ?? false };
}

function destinationMatches(key: OutboundConsentKey, actual: string | null): boolean {
  if (!actual) return false;
  const parsed = outboundConsentKeySchema.safeParse({ ...key, contact: actual });
  return parsed.success && parsed.data.contact === key.contact;
}

/**
 * Two transaction-scoped advisory locks serialize both repeated idempotency keys and first writes
 * for a consent key. The persisted version is derived from the locked database state, never caller time.
 */
export async function recordOutboundConsentDecision(actor: TrustedConsentActor, raw: unknown) {
  const intent = outboundConsentIntentSchema.parse(raw);
  assertTrustedTenant(actor.companyId, intent.key.companyId);
  if (!CONSENT_RECEIPT_BOUNDARY_ACTIVE) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Verified consent receipt boundary is not active");
  }
  return runTransactionWithTenantSession(actor.companyId, (tx) => recordVerifiedDecisionInTransaction(tx, actor, intent));
}

async function recordVerifiedDecisionInTransaction(
  tx: TenantTx,
  actor: TrustedConsentActor,
  intent: z.output<typeof outboundConsentIntentSchema>,
) {
    const [receipt] = await tx.select().from(outboundConsentCaptureReceipts).where(and(
      eq(outboundConsentCaptureReceipts.companyId, actor.companyId),
      eq(outboundConsentCaptureReceipts.id, intent.receiptId),
      isNull(outboundConsentCaptureReceipts.deletedAt),
    )).limit(1);
    const currentSubject = await loadActiveSubject(tx, intent.key);
    const evidence = verifyPersistedConsentReceipt({
      actor, intent, receipt: receipt ?? null, currentSubject,
    });
    const input: OutboundConsentDecisionInput = {
      ...intent, ...evidence, actorType: actor.actorType, actorId: actor.actorId,
    };
    assertVerifiedConsentSource(input);
    const key = input.key;
    const fingerprint = fingerprintConsentDecision(input);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([key.companyId, input.idempotencyKey])}, 0))`);
    const [replay] = await tx.select().from(outboundConsentEvents).where(and(
      eq(outboundConsentEvents.companyId, actor.companyId),
      eq(outboundConsentEvents.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (replay) {
      assertConsentReplayMatches(replay.decisionFingerprint, input);
      return replay;
    }

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([
      actor.companyId, key.subjectType, key.subjectId, key.channel, key.purpose, key.contact,
    ])}, 0))`);
    const subject = await loadActiveSubject(tx, key);
    if (!subject || (input.decision === "grant" && !destinationMatches(key, subject.contact))) {
      throw new AppError(ErrorCode.NOT_FOUND, "Active subject or destination unavailable");
    }
    if (input.decision === "grant" && subject.doNotContact) {
      throw new AppError(ErrorCode.CONSENT_REQUIRED, "Current contact restriction blocks grant");
    }
    const [prior] = await tx.select().from(outboundConsentStates).where(and(
      eq(outboundConsentStates.companyId, actor.companyId), keyWhere(key),
    )).limit(1).for("update");
    const version = (prior?.version ?? 0) + 1;
    const state = input.decision === "grant" ? "granted" : "revoked";
    const eventId = randomUUID();
    const [event] = await tx.insert(outboundConsentEvents).values({
      id: eventId, ...key, decision: input.decision, version,
      sourceKind: input.sourceKind, sourceRecordId: input.sourceRecordId,
      statementVersion: input.statementVersion, evidenceRef: input.evidenceRef,
      actorType: input.actorType, actorId: input.actorId, idempotencyKey: input.idempotencyKey,
      decisionFingerprint: fingerprint, priorState: prior?.state ?? null, currentState: state,
    }).returning();
    if (!event) throw new Error("Consent event insert returned no row");
    if (prior) {
      await tx.update(outboundConsentStates).set({
        state, version, decidedAt: event.occurredAt, sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId, statementVersion: input.statementVersion,
        lastEventId: eventId, updatedAt: event.occurredAt,
      }).where(and(eq(outboundConsentStates.companyId, actor.companyId), keyWhere(key)));
    } else {
      await tx.insert(outboundConsentStates).values({
        ...key, state, version, decidedAt: event.occurredAt, sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId, statementVersion: input.statementVersion, lastEventId: eventId,
      });
    }
    await emitEventWithExecutor(tx, {
      companyId: actor.companyId,
      eventType: input.decision === "grant" ? "outbound_consent.granted" : "outbound_consent.revoked",
      actorType: input.actorType, actorId: input.actorId,
      entityType: "outbound_consent", entityId: eventId,
      ...(key.subjectType === "customer" ? { customerId: key.subjectId } : {}),
      payload: { subjectType: key.subjectType, subjectId: key.subjectId, channel: key.channel,
        purpose: key.purpose, version, consentEventId: eventId },
      summary: input.decision === "grant" ? "Outbound consent granted" : "Outbound consent revoked",
    });
    return event;
}

/** Office staff may revoke a current customer's destination; never use this path to grant. */
export async function revokeOperatorOutboundConsent(actor: TrustedConsentActor & { role: "owner" | "admin" }, raw: unknown) {
  const input = operatorRevokeSchema.parse(raw);
  if (actor.actorType !== "user" || !actor.actorId || !["owner", "admin"].includes(actor.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Authenticated operator required for consent revocation");
  }
  const operatorId = actor.actorId;
  return runTransactionWithTenantSession(actor.companyId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([actor.companyId, input.idempotencyKey])}, 0))`);
    const [customer] = await tx.select({ email: customers.email, phone: customers.phone }).from(customers).where(and(
      eq(customers.companyId, actor.companyId), eq(customers.id, input.customerId), isNull(customers.deletedAt),
    )).limit(1);
    if (!customer) throw new AppError(ErrorCode.NOT_FOUND, "Active customer unavailable");
    const contact = input.channel === "email" ? customer.email : customer.phone;
    if (!contact) throw new AppError(ErrorCode.NOT_FOUND, "Customer destination unavailable");
    const key = outboundConsentKeySchema.parse({
      companyId: actor.companyId, subjectType: "customer", subjectId: input.customerId,
      channel: input.channel, purpose: input.purpose, contact,
    });
    const [existing] = await tx.select().from(outboundConsentCaptureReceipts).where(and(
      eq(outboundConsentCaptureReceipts.companyId, actor.companyId),
      eq(outboundConsentCaptureReceipts.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    const receiptId = existing?.id ?? randomUUID();
    const receiptFacts: Omit<ConsentCaptureReceiptFacts, "payloadFingerprint"> = {
      id: receiptId, ...key, decision: "revoke", explicitChoice: true,
      statementVersion: "operator-revoke-v1", sourceRecordId: operatorId,
      sourceSurface: "operator", actorType: "user", actorId: operatorId,
      signedInboundIdentity: null, signatureVerifiedAt: null,
      capturedAt: existing?.capturedAt ?? new Date(), idempotencyKey: input.idempotencyKey,
      deletedAt: null,
    };
    const payloadFingerprint = fingerprintConsentCaptureReceipt(receiptFacts);
    if (existing) {
      if (existing.deletedAt || existing.payloadFingerprint !== payloadFingerprint) {
        throw new AppError(ErrorCode.CONFLICT, "Consent idempotency key has a different decision");
      }
    } else {
      await tx.insert(outboundConsentCaptureReceipts).values({ ...receiptFacts, payloadFingerprint });
    }
    const intent = outboundConsentIntentSchema.parse({
      key, decision: "revoke", receiptId, idempotencyKey: input.idempotencyKey,
    });
    return recordVerifiedDecisionInTransaction(tx, actor, intent);
  });
}

/** Read only current authority; use at execution and again immediately before provider handoff. */
export async function checkOutboundConsent(companyId: string, rawKey: unknown, expectedVersion?: number): Promise<OutboundConsentCheck> {
  const key = outboundConsentKeySchema.parse(rawKey);
  assertTrustedTenant(companyId, key.companyId);
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const checkedAt = new Date();
    const subject = await loadActiveSubject(tx, key);
    const [state] = await tx.select().from(outboundConsentStates).where(and(
      eq(outboundConsentStates.companyId, companyId), keyWhere(key),
    )).limit(1);
    return evaluateCurrentOutboundConsent({
      key, subject, state: state ?? null, checkedAt,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    });
  });
}
