import type { FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";

import {
  customers,
  db,
  emitEventWithExecutor,
  messageLogs,
  normalizePhoneE164,
  phoneMatchesE164,
  recordSmsOptOut
} from "@fsm/db";

type TransactionExecutor = Pick<typeof db, "insert" | "update" | "select">;

function buildTwimlResponse(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

function getTwilioParam(params: Record<string, string> | undefined, key: string): string | null {
  const value = params?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Tenant resolution for inbound SMS (H1).
 *
 * Renvani sends every tenant's SMS from ONE shared Twilio number (env.TWILIO_FROM_NUMBER); there is no
 * per-company number, so the inbound `To` cannot identify the tenant. Rules:
 *
 * 1. Consent withdrawal (STOP, same keyword handling as before) is applied PLATFORM-WIDE: every live customer
 *    with that phone, in every tenant, gets doNotContact=true, and the inbound message is logged under each
 *    matching customer's own tenant. Rationale: Twilio blocks the shared number at the carrier level after
 *    STOP, so no tenant can text this phone anyway; recording the withdrawal everywhere keeps our data truthful.
 *    This is the ONLY cross-tenant write, and it only ever withdraws consent; nothing is ever opted in and no
 *    other field is written across tenants.
 * 2. Any other reply is routed by the most recent outbound SMS to that phone (message_logs): that row's company
 *    is the tenant, and the customer is looked up by (companyId, phone). If there is no outbound history, or the
 *    recent outbound rows span more than one company (ambiguous), the message is a safe no-op: no writes,
 *    still 200 + empty TwiML.
 *
 * Later (option 3): per-tenant Twilio numbers would let `To` identify the tenant directly. Legal review of the
 * platform-wide STOP behaviour has been flagged.
 */
const ROUTING_LOOKBACK_ROWS = 5;

/** FS-281: carrier opt-out keywords (case/whitespace-insensitive). START/UNSTOP (opt back in) is FS-270, not handled here. */
const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

export function isConsentWithdrawal(messageBody: string): boolean {
  return STOP_KEYWORDS.has(messageBody.replace(/\s+/gu, "").toUpperCase());
}

type CustomerRow = typeof customers.$inferSelect;

/**
 * Live customers whose stored phone matches `phoneE164` by digits (FS-281: legacy formats such as
 * "(555) 010-0100" or "5550100100" match the Twilio E.164 `From` without a backfill).
 */
async function findLiveCustomersByPhone(phoneE164: string, companyId?: string): Promise<CustomerRow[]> {
  return db
    .select()
    .from(customers)
    .where(
      companyId
        ? and(eq(customers.companyId, companyId), phoneMatchesE164(customers.phone, phoneE164), isNull(customers.deletedAt))
        : and(phoneMatchesE164(customers.phone, phoneE164), isNull(customers.deletedAt))
    )
    .limit(500);
}

/** Company of the most recent outbound SMS to `phone`, or null when none or ambiguous. */
async function resolveRoutedCompanyId(phone: string): Promise<string | null> {
  const recent = await db
    .select({ companyId: messageLogs.companyId })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.channel, "sms"),
        eq(messageLogs.direction, "outbound"),
        eq(messageLogs.toAddress, phone),
        isNull(messageLogs.deletedAt)
      )
    )
    .orderBy(desc(messageLogs.createdAt))
    .limit(ROUTING_LOOKBACK_ROWS);

  const companyIds = new Set(recent.map((row) => row.companyId));
  if (companyIds.size !== 1) {
    return null;
  }
  return [...companyIds][0] ?? null;
}

async function logInbound(
  tx: TransactionExecutor,
  input: {
    companyId: string;
    customerId: string | null;
    fromNumber: string;
    toNumber: string;
    messageBody: string;
    providerMessageId: string | null;
  }
): Promise<void> {
  const insertedMessages = await tx
    .insert(messageLogs)
    .values({
      companyId: input.companyId,
      customerId: input.customerId,
      channel: "sms",
      direction: "inbound",
      fromAddress: input.fromNumber,
      toAddress: input.toNumber,
      body: input.messageBody,
      providerMessageId: input.providerMessageId
    })
    .returning();
  const messageLog = insertedMessages[0];

  if (!messageLog) {
    return;
  }

  await emitEventWithExecutor(tx, {
    companyId: input.companyId,
    eventType: "message.received",
    actorType: "customer",
    entityType: "message_log",
    entityId: messageLog.id,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    payload: {
      channel: "sms",
      direction: "inbound",
      providerMessageId: input.providerMessageId
    },
    summary: "Inbound SMS received"
  });
}

function emptyTwiml(reply: FastifyReply): FastifyReply {
  return reply.code(200).type("text/xml").send(buildTwimlResponse());
}

export async function twilioHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const fromNumber = getTwilioParam(request.twilioParams, "From");
  const toNumber = getTwilioParam(request.twilioParams, "To");
  const messageBody = getTwilioParam(request.twilioParams, "Body");
  const providerMessageId = getTwilioParam(request.twilioParams, "MessageSid");

  if (!fromNumber || !toNumber || messageBody === null) {
    request.log.warn(
      {
        hasFrom: !!fromNumber,
        hasTo: !!toNumber,
        hasBody: messageBody !== null
      },
      "Inbound Twilio SMS missing expected fields"
    );

    return reply.code(200).type("text/xml").send(buildTwimlResponse());
  }

  // Twilio sends E.164; normalise defensively so matching and the opt-out key are canonical.
  const fromE164 = normalizePhoneE164(fromNumber) ?? fromNumber;

  if (isConsentWithdrawal(messageBody)) {
    const matches = await findLiveCustomersByPhone(fromE164);

    await db.transaction(async (tx: TransactionExecutor) => {
      // FS-281: phone-level, platform-wide opt-out (no company_id; #295 shared-number ruling). Written on EVERY
      // STOP, including phones with no customer row, so later sends to that phone are denied (fail closed).
      await recordSmsOptOut(tx, { phoneE164: fromE164, source: "twilio_stop", providerMessageId });

      for (const match of matches) {
        await logInbound(tx, {
          companyId: match.companyId,
          customerId: match.id,
          fromNumber,
          toNumber,
          messageBody,
          providerMessageId
        });

        // Consent withdrawal only: scoped to this customer's own tenant row; never sets anything to "allowed".
        const updatedCustomers = await tx
          .update(customers)
          .set({ doNotContact: true, updatedAt: new Date() })
          .where(and(eq(customers.companyId, match.companyId), eq(customers.id, match.id), isNull(customers.deletedAt)))
          .returning();
        const customer = updatedCustomers[0];

        if (customer) {
          await emitEventWithExecutor(tx, {
            companyId: customer.companyId,
            eventType: "customer.updated",
            actorType: "customer",
            entityType: "customer",
            entityId: customer.id,
            customerId: customer.id,
            payload: { doNotContact: true, source: "twilio_stop" },
            summary: "Customer opted out via SMS STOP"
          });
        }
      }
    });

    request.log.info(
      { tenantCount: new Set(matches.map((m) => m.companyId)).size, customerCount: matches.length, phoneOptOutRecorded: true },
      "Inbound SMS STOP applied platform-wide"
    );
    return emptyTwiml(reply);
  }

  const routedCompanyId = await resolveRoutedCompanyId(fromNumber);

  if (!routedCompanyId) {
    request.log.warn(
      { hasKnownCompany: false, hasProviderMessageId: !!providerMessageId },
      "Inbound Twilio SMS could not be routed to a single company (no or ambiguous outbound history); no-op"
    );
    return emptyTwiml(reply);
  }

  const [routedCustomer] = await findLiveCustomersByPhone(fromE164, routedCompanyId);

  await db.transaction(async (tx: TransactionExecutor) => {
    await logInbound(tx, {
      companyId: routedCompanyId,
      customerId: routedCustomer?.id ?? null,
      fromNumber,
      toNumber,
      messageBody,
      providerMessageId
    });
  });

  request.log.info(
    { companyId: routedCompanyId, hasCustomer: !!routedCustomer, hasProviderMessageId: !!providerMessageId },
    "Inbound Twilio SMS logged"
  );

  return emptyTwiml(reply);
}
