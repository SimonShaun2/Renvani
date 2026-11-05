/** FS-234: transactional proof-of-email delivery. Disabled until the capture contract is approved. */
import { and, eq, isNull, sql } from "drizzle-orm";

import { resolveTransactionalEmailFromAddress } from "@fsm/comms";
import { env } from "@fsm/config";
import { featureFlags } from "@fsm/config/feature-flags";
import {
  customers,
  emitEventWithExecutor,
  messageLogs,
  outboundConsentEmailChallenges,
  runTransactionWithTenantSession,
} from "@fsm/db";
import { customerEmailVerificationJobSchema, type CustomerEmailVerificationJob } from "@fsm/jobs";

const SUBJECT = "Verify your email for Renvani";
const SOURCE_SYSTEM = "customer_email_verification";

type DeliveryFacts = { companyId: string; customerId: string; challengeId: string; email: string };
type SendResult = { providerMessageId: string | null };

export interface CustomerEmailVerificationDeliveryDependencies {
  enabled: boolean;
  load(payload: CustomerEmailVerificationJob): Promise<DeliveryFacts | null>;
  buildToken(companyId: string, challengeId: string): Promise<string> | string;
  send(input: { to: string; subject: string; html: string; text: string }): Promise<SendResult>;
  record(facts: DeliveryFacts, result: SendResult): Promise<void>;
  markUncertain(facts: DeliveryFacts): Promise<void>;
  appUrl: string;
}

/** No token or destination is accepted from the queued payload. */
export async function processCustomerEmailVerificationDelivery(
  raw: unknown,
  deps: CustomerEmailVerificationDeliveryDependencies,
): Promise<"disabled" | "skipped" | "accepted"> {
  const payload = customerEmailVerificationJobSchema.parse(raw);
  if (!deps.enabled) return "disabled";
  const facts = await deps.load(payload);
  if (!facts || facts.companyId !== payload.companyId || facts.customerId !== payload.customerId ||
      facts.challengeId !== payload.challengeId) return "skipped";
  try {
    const token = await deps.buildToken(facts.companyId, facts.challengeId);
    const portalUrl = new URL("/portal", deps.appUrl);
    portalUrl.hash = `verify-email=${encodeURIComponent(token)}`;
    const url = portalUrl.toString();
    const result = await deps.send({
      to: facts.email,
      subject: SUBJECT,
      text: `Use this link to verify your email address for Renvani. The link expires in 10 minutes: ${url}`,
      html: `<p>Use this link to verify your email address for Renvani. The link expires in 10 minutes.</p><p><a href="${url}">Verify email</a></p>`,
    });
    if (!result.providerMessageId) throw new Error("Verification email provider did not confirm acceptance");
    await deps.record(facts, result);
    return "accepted";
  } catch (error) {
    // Provider acceptance may be unknowable after a timeout or DB failure. Preserve
    // the claim and require reconciliation; never allow an automatic duplicate send.
    try {
      await deps.markUncertain(facts);
    } catch {
      throw new Error("Verification delivery reconciliation failed; claim remains attempting");
    }
    throw error;
  }
}

async function loadCurrent(payload: CustomerEmailVerificationJob): Promise<DeliveryFacts | null> {
  return runTransactionWithTenantSession(payload.companyId, async (tx) => {
    const [challenge] = await tx.select({
      companyId: outboundConsentEmailChallenges.companyId,
      customerId: outboundConsentEmailChallenges.customerId,
      challengeId: outboundConsentEmailChallenges.id,
      email: outboundConsentEmailChallenges.email,
    }).from(outboundConsentEmailChallenges).where(and(
      eq(outboundConsentEmailChallenges.companyId, payload.companyId),
      eq(outboundConsentEmailChallenges.customerId, payload.customerId),
      eq(outboundConsentEmailChallenges.id, payload.challengeId),
      isNull(outboundConsentEmailChallenges.consumedAt),
      isNull(outboundConsentEmailChallenges.deletedAt),
      sql`${outboundConsentEmailChallenges.expiresAt} > now()`,
    )).limit(1);
    if (!challenge) return null;
    const [customer] = await tx.select({ email: customers.email, doNotContact: customers.doNotContact })
      .from(customers).where(and(
        eq(customers.companyId, payload.companyId), eq(customers.id, payload.customerId), isNull(customers.deletedAt),
      )).limit(1);
    if (!customer?.email || customer.doNotContact || customer.email.trim().toLowerCase() !== challenge.email) return null;
    // Claim before provider handoff. An uncertain send stays "attempting" and requires
    // reconciliation; a retry must never send a second verification link automatically.
    const [claimed] = await tx.insert(messageLogs).values({
      companyId: payload.companyId, customerId: payload.customerId,
      channel: "email", direction: "outbound", toAddress: challenge.email,
      fromAddress: resolveTransactionalEmailFromAddress({
        resendApiKey: env.RESEND_API_KEY, sendgridApiKey: env.SENDGRID_API_KEY,
        nodeEnv: env.NODE_ENV, resendFromEmail: env.RESEND_FROM_EMAIL,
        emailFrom: env.EMAIL_FROM, sendgridFromEmail: env.SENDGRID_FROM_EMAIL,
      }),
      subject: SUBJECT, body: SUBJECT, providerStatus: "attempting",
      sourceSystem: SOURCE_SYSTEM, sourceId: payload.challengeId,
    }).onConflictDoNothing().returning({ id: messageLogs.id });
    if (!claimed) return null;
    await emitEventWithExecutor(tx, {
      companyId: payload.companyId,
      eventType: "outbound_consent.email_verification_attempted",
      actorType: "system", entityType: "outbound_consent_email_challenge", entityId: payload.challengeId,
      customerId: payload.customerId, payload: { challengeId: payload.challengeId },
      summary: "Customer email verification delivery attempted",
    });
    return challenge;
  });
}

async function recordAccepted(facts: DeliveryFacts, result: SendResult): Promise<void> {
  await runTransactionWithTenantSession(facts.companyId, async (tx) => {
    const [logged] = await tx.update(messageLogs).set({
      providerMessageId: result.providerMessageId, providerStatus: "accepted", sentAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(messageLogs.companyId, facts.companyId), eq(messageLogs.customerId, facts.customerId),
      eq(messageLogs.sourceSystem, SOURCE_SYSTEM), eq(messageLogs.sourceId, facts.challengeId),
      eq(messageLogs.toAddress, facts.email), eq(messageLogs.providerStatus, "attempting"),
    )).returning({ id: messageLogs.id });
    if (!logged) throw new Error("Verification delivery claim was not available for acceptance");
    await emitEventWithExecutor(tx, {
      companyId: facts.companyId,
      eventType: "outbound_consent.email_verification_sent",
      actorType: "system", entityType: "outbound_consent_email_challenge", entityId: facts.challengeId,
      customerId: facts.customerId,
      payload: { challengeId: facts.challengeId, providerMessageId: result.providerMessageId },
      summary: "Customer email verification delivery accepted by provider",
    });
  });
}

async function recordUncertain(facts: DeliveryFacts): Promise<void> {
  await runTransactionWithTenantSession(facts.companyId, async (tx) => {
    const [logged] = await tx.update(messageLogs).set({
      providerStatus: "uncertain", failureReason: "Provider outcome requires reconciliation",
      updatedAt: new Date(),
    }).where(and(
      eq(messageLogs.companyId, facts.companyId), eq(messageLogs.customerId, facts.customerId),
      eq(messageLogs.sourceSystem, SOURCE_SYSTEM), eq(messageLogs.sourceId, facts.challengeId),
      eq(messageLogs.toAddress, facts.email), eq(messageLogs.providerStatus, "attempting"),
    )).returning({ id: messageLogs.id });
    if (!logged) return;
    await emitEventWithExecutor(tx, {
      companyId: facts.companyId,
      eventType: "outbound_consent.email_verification_uncertain",
      actorType: "system", entityType: "outbound_consent_email_challenge", entityId: facts.challengeId,
      customerId: facts.customerId, payload: { challengeId: facts.challengeId },
      summary: "Customer email verification delivery requires reconciliation",
    });
  });
}

/** Kept behind the shared feature flag; no caller route currently enqueues this job. */
export async function processCustomerEmailVerificationDeliveryJob(raw: unknown): Promise<"disabled" | "skipped" | "accepted"> {
  if (!featureFlags.customerEmailVerificationDeliveryEnabled) return "disabled";
  const tokenModuleUrl = new URL("../../../api/dist/services/outbound-consent-email-verification.service.js", import.meta.url);
  const emailModuleUrl = new URL("../../../api/dist/lib/outbound-email.js", import.meta.url);
  const [{ buildCustomerEmailChallengeToken }, { deliverTransactionalEmail }] = await Promise.all([
    import(tokenModuleUrl.href) as Promise<{ buildCustomerEmailChallengeToken(companyId: string, challengeId: string): string }>,
    import(emailModuleUrl.href) as Promise<{ deliverTransactionalEmail(input: {
      to: string; subject: string; html: string; text: string;
    }): Promise<SendResult> }>,
  ]);
  return processCustomerEmailVerificationDelivery(raw, {
    enabled: true,
    load: loadCurrent,
    buildToken: buildCustomerEmailChallengeToken,
    send: deliverTransactionalEmail,
    record: recordAccepted,
    markUncertain: recordUncertain,
    appUrl: env.APP_URL,
  });
}
