/** FS-234: destination-control proof for a customer email. No consent grant is made here. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { customers, emitEventWithExecutor, outboundConsentEmailChallenges, runTransactionWithTenantSession } from "@fsm/db";
import { env } from "@fsm/config";
import { featureFlags } from "@fsm/config/feature-flags";
import { AppError, ErrorCode, outboundConsentKeySchema } from "@fsm/types";

const idempotencySchema = z.string().trim().min(1).max(128);
const uuidSchema = z.string().uuid();
const TOKEN_RE = /^([0-9a-f-]{36})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/i;
const MAX_CHALLENGES_PER_HOUR = 3;

/** Reconstructible by the trusted mail worker; queue data needs only company/challenge IDs. */
export function buildCustomerEmailChallengeToken(companyId: string, challengeId: string): string {
  const company = uuidSchema.parse(companyId).toLowerCase();
  const challenge = uuidSchema.parse(challengeId).toLowerCase();
  const mac = createHmac("sha256", env.BOOKING_HOLD_TOKEN_SECRET)
    .update(`fs234-customer-email-v1:${company}:${challenge}`).digest("hex");
  return `${company}.${challenge}.${mac}`;
}

export function parseCustomerEmailChallengeToken(raw: unknown): { companyId: string; challengeId: string; tokenHash: string } {
  const parsed = z.string().max(140).safeParse(raw);
  if (!parsed.success) throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
  const token = parsed.data;
  const match = TOKEN_RE.exec(token);
  if (!match) throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
  const company = uuidSchema.safeParse(match[1]);
  const challenge = uuidSchema.safeParse(match[2]);
  if (!company.success || !challenge.success) throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
  const companyId = company.data.toLowerCase();
  const challengeId = challenge.data.toLowerCase();
  const expected = buildCustomerEmailChallengeToken(companyId, challengeId);
  if (!timingSafeEqual(Buffer.from(token.toLowerCase()), Buffer.from(expected))) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
  }
  return { companyId, challengeId, tokenHash: createHash("sha256").update(expected).digest("hex") };
}

export interface CustomerEmailChallengeDeliveryIntent {
  companyId: string;
  customerId: string;
  challengeId: string;
}

/** Caller must derive tenant/customer from a validated portal session, never from request JSON. */
export async function issueCustomerEmailChallenge(
  trustedSession: { companyId: string; customerId: string },
  rawIdempotencyKey: unknown,
): Promise<CustomerEmailChallengeDeliveryIntent> {
  if (!featureFlags.customerEmailVerificationDeliveryEnabled) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Customer email verification is not enabled");
  }
  const companyId = uuidSchema.parse(trustedSession.companyId);
  const customerId = uuidSchema.parse(trustedSession.customerId);
  const idempotencyKey = idempotencySchema.parse(rawIdempotencyKey);
  return runTransactionWithTenantSession(companyId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([companyId, customerId, "email-verification"])}, 0))`);
    const [customer] = await tx.select({ email: customers.email }).from(customers).where(and(
      eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt),
    )).limit(1);
    if (!customer?.email) throw new AppError(ErrorCode.NOT_FOUND, "Customer email unavailable");
    const email = outboundConsentKeySchema.parse({
      companyId, subjectType: "customer", subjectId: customerId,
      channel: "email", purpose: "marketing", contact: customer.email,
    }).contact;
    const [prior] = await tx.select({
      id: outboundConsentEmailChallenges.id,
      customerId: outboundConsentEmailChallenges.customerId,
      email: outboundConsentEmailChallenges.email,
      consumedAt: outboundConsentEmailChallenges.consumedAt,
      deletedAt: outboundConsentEmailChallenges.deletedAt,
      active: sql<boolean>`${outboundConsentEmailChallenges.expiresAt} > now()`,
    }).from(outboundConsentEmailChallenges).where(and(
      eq(outboundConsentEmailChallenges.companyId, companyId),
      eq(outboundConsentEmailChallenges.idempotencyKey, idempotencyKey),
    )).limit(1);
    if (prior) {
      if (prior.customerId !== customerId || prior.email !== email || prior.deletedAt || prior.consumedAt || !prior.active) {
        throw new AppError(ErrorCode.CONFLICT, "Verification request cannot be replayed");
      }
      return { companyId, customerId, challengeId: prior.id };
    }
    const recent = await tx.select({ id: outboundConsentEmailChallenges.id }).from(outboundConsentEmailChallenges).where(and(
      eq(outboundConsentEmailChallenges.companyId, companyId),
      eq(outboundConsentEmailChallenges.customerId, customerId),
      gte(outboundConsentEmailChallenges.createdAt, sql`now() - interval '1 hour'`),
    )).limit(MAX_CHALLENGES_PER_HOUR);
    if (recent.length >= MAX_CHALLENGES_PER_HOUR) {
      throw new AppError(ErrorCode.POLICY_DENIED, "Verification request limit reached");
    }
    const challengeId = randomUUID();
    const tokenHash = createHash("sha256")
      .update(buildCustomerEmailChallengeToken(companyId, challengeId)).digest("hex");
    const [issued] = await tx.insert(outboundConsentEmailChallenges).values({
      id: challengeId, companyId, customerId, email, tokenHash, idempotencyKey,
      createdAt: sql`now()`, expiresAt: sql`now() + interval '10 minutes'`,
    }).returning({ id: outboundConsentEmailChallenges.id, email: outboundConsentEmailChallenges.email,
      expiresAt: outboundConsentEmailChallenges.expiresAt });
    if (!issued || issued.id !== challengeId || issued.email !== email) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Verification challenge was not persisted");
    }
    await emitEventWithExecutor(tx, {
      companyId, eventType: "outbound_consent.email_challenge_issued",
      actorType: "system", entityType: "outbound_consent_email_challenge", entityId: challengeId,
      customerId, payload: { challengeId, source: "customer_portal" },
      summary: "Customer email verification challenge issued",
    });
    return { companyId, customerId, challengeId };
  });
}

/** A successful consume proves email control, but does not itself grant marketing consent. */
export async function consumeCustomerEmailChallenge(rawToken: unknown): Promise<{
  companyId: string; customerId: string; email: string; challengeId: string; verifiedAt: Date;
}> {
  if (!featureFlags.customerEmailVerificationDeliveryEnabled) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Customer email verification is not enabled");
  }
  const token = parseCustomerEmailChallengeToken(rawToken);
  return runTransactionWithTenantSession(token.companyId, async (tx) => {
    const [challenge] = await tx.select().from(outboundConsentEmailChallenges).where(and(
      eq(outboundConsentEmailChallenges.id, token.challengeId),
      eq(outboundConsentEmailChallenges.companyId, token.companyId),
      eq(outboundConsentEmailChallenges.tokenHash, token.tokenHash),
      isNull(outboundConsentEmailChallenges.consumedAt), isNull(outboundConsentEmailChallenges.deletedAt),
      sql`${outboundConsentEmailChallenges.expiresAt} > now()`,
    )).limit(1).for("update");
    if (!challenge) throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
    const [customer] = await tx.select({ email: customers.email }).from(customers).where(and(
      eq(customers.companyId, token.companyId), eq(customers.id, challenge.customerId), isNull(customers.deletedAt),
    )).limit(1);
    const currentEmail = customer?.email && outboundConsentKeySchema.safeParse({
      companyId: token.companyId, subjectType: "customer", subjectId: challenge.customerId,
      channel: "email", purpose: "marketing", contact: customer.email,
    });
    if (!currentEmail || !currentEmail.success || currentEmail.data.contact !== challenge.email) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
    }
    const [consumed] = await tx.update(outboundConsentEmailChallenges)
      .set({ consumedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(outboundConsentEmailChallenges.companyId, token.companyId),
        eq(outboundConsentEmailChallenges.id, challenge.id), isNull(outboundConsentEmailChallenges.consumedAt),
        sql`${outboundConsentEmailChallenges.expiresAt} > now()`)).returning({ consumedAt: outboundConsentEmailChallenges.consumedAt });
    if (!consumed?.consumedAt) throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired verification link");
    await emitEventWithExecutor(tx, {
      companyId: token.companyId, eventType: "outbound_consent.email_verified",
      actorType: "customer", entityType: "outbound_consent_email_challenge", entityId: challenge.id,
      customerId: challenge.customerId, payload: { challengeId: challenge.id },
      summary: "Customer email destination verified",
    });
    return { companyId: token.companyId, customerId: challenge.customerId, email: challenge.email,
      challengeId: challenge.id, verifiedAt: consumed.consumedAt };
  });
}
