/** FS-234 consent authority. Not wired to outbound execution until migration 0062 and review gates land. */
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import {
  bookingRequests,
  customers,
  emitEventWithExecutor,
  outboundConsentEvents,
  outboundConsentStates,
  runTransactionWithTenantSession,
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  evaluateCurrentOutboundConsent,
  outboundConsentDecisionInputSchema,
  outboundConsentKeySchema,
  type OutboundConsentCheck,
  type OutboundConsentKey,
} from "@fsm/types";
import { assertConsentReplayMatches, assertVerifiedConsentSource, fingerprintConsentDecision } from "./outbound-consent-decision.js";

type TenantTx = Parameters<Parameters<typeof runTransactionWithTenantSession>[1]>[0];
type ActiveSubject = { companyId: string; contact: string | null; doNotContact: boolean };

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
export async function recordOutboundConsentDecision(raw: unknown) {
  const input = outboundConsentDecisionInputSchema.parse(raw);
  assertVerifiedConsentSource(input);
  const key = input.key;
  const fingerprint = fingerprintConsentDecision(input);
  return runTransactionWithTenantSession(key.companyId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([key.companyId, input.idempotencyKey])}, 0))`);
    const [replay] = await tx.select().from(outboundConsentEvents).where(and(
      eq(outboundConsentEvents.companyId, key.companyId),
      eq(outboundConsentEvents.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (replay) {
      assertConsentReplayMatches(replay.decisionFingerprint, input);
      return replay;
    }

    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([
      key.companyId, key.subjectType, key.subjectId, key.channel, key.purpose, key.contact,
    ])}, 0))`);
    const subject = await loadActiveSubject(tx, key);
    if (!subject || (input.decision === "grant" && !destinationMatches(key, subject.contact))) {
      throw new AppError(ErrorCode.NOT_FOUND, "Active subject or destination unavailable");
    }
    if (input.decision === "grant" && subject.doNotContact) {
      throw new AppError(ErrorCode.CONSENT_REQUIRED, "Current contact restriction blocks grant");
    }
    const [prior] = await tx.select().from(outboundConsentStates).where(keyWhere(key)).limit(1).for("update");
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
      }).where(keyWhere(key));
    } else {
      await tx.insert(outboundConsentStates).values({
        ...key, state, version, decidedAt: event.occurredAt, sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId, statementVersion: input.statementVersion, lastEventId: eventId,
      });
    }
    await emitEventWithExecutor(tx, {
      companyId: key.companyId,
      eventType: input.decision === "grant" ? "outbound_consent.granted" : "outbound_consent.revoked",
      actorType: input.actorType, actorId: input.actorId,
      entityType: "outbound_consent", entityId: eventId,
      ...(key.subjectType === "customer" ? { customerId: key.subjectId } : {}),
      payload: { subjectType: key.subjectType, subjectId: key.subjectId, channel: key.channel,
        purpose: key.purpose, version, consentEventId: eventId },
      summary: input.decision === "grant" ? "Outbound consent granted" : "Outbound consent revoked",
    });
    return event;
  });
}

/** Read only current authority; use at execution and again immediately before provider handoff. */
export async function checkOutboundConsent(rawKey: unknown, expectedVersion?: number): Promise<OutboundConsentCheck> {
  const key = outboundConsentKeySchema.parse(rawKey);
  return runTransactionWithTenantSession(key.companyId, async (tx) => {
    const checkedAt = new Date();
    const subject = await loadActiveSubject(tx, key);
    const [state] = await tx.select().from(outboundConsentStates).where(keyWhere(key)).limit(1);
    return evaluateCurrentOutboundConsent({
      key, subject, state: state ?? null, checkedAt,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    });
  });
}
