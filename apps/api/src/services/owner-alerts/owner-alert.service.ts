import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { env } from "@fsm/config";
import { featureFlags } from "@fsm/config/feature-flags";
import { bookingSettings, companies, db, users } from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";

import {
  evalRateLimitScript,
  hitFixedWindowRateLimit,
  resolveRateLimitRedisClient
} from "../../lib/fixed-window-rate-limit.js";

const logger = pino({ name: "owner-alerts" });

/**
 * Shared owner-alert helper (Growth + Retention). One alert per (kind, entityId), per-company hourly cap shared
 * across instances (FS-66 Redis limiter), email via the Resend template, SMS only through the outbound-SMS
 * policy (disabled stub today => no SMS job is queued, nothing external is called). Never throws.
 */
export type OwnerAlertKind = "new_inquiry" | "low_rating";

export const OWNER_ALERT_COMPANY_HOURLY_LIMIT = 20;
export const OWNER_ALERT_RATE_WINDOW_MS = 60 * 60 * 1000;
export const OWNER_ALERT_ONCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OWNER_ALERT_JOB_NAME = "send-owner-alert";

export interface OwnerAlertInput {
  companyId: string;
  kind: OwnerAlertKind;
  /** Stable id of the thing being alerted on (booking request id, review request id). */
  entityId: string;
  /** Caller-resolved off switch (existing settings storage). */
  enabled: boolean;
  headline: string;
  /** Short, inbox-level summary. Never the customer's full message, phone or email. */
  summary: string;
  actionPath: string;
  actionLabel: string;
  /** Also text owners/admins when outbound SMS is live. */
  sms?: boolean;
}

export type OwnerAlertOutcome =
  | { status: "queued"; jobId: string; channels: Array<"email" | "sms"> }
  | {
      status: "skipped";
      reason: "disabled" | "duplicate" | "rate_limited" | "no_recipient" | "error";
    };

export function ownerAlertJobId(kind: OwnerAlertKind, entityId: string): string {
  return `owner-alert-${kind}-${entityId}`;
}

const CLAIM_ONCE_LUA = `
if redis.call('SET', KEYS[1], '1', 'NX', 'PX', ARGV[1]) then
  return 1
end
return 0
`;

const memoryClaims = new Map<string, number>();

export function resetOwnerAlertStateForTests(): void {
  memoryClaims.clear();
}

/** First caller for a key wins (Redis SET NX, shared across instances; per-process memory if Redis is down). */
async function claimOnce(key: string, ttlMs: number): Promise<boolean> {
  const client = await resolveRateLimitRedisClient().catch(() => null);
  if (client) {
    try {
      const reply = await evalRateLimitScript(client, CLAIM_ONCE_LUA, key, ttlMs);
      if (reply === 1 || reply === "1") return true;
      if (reply === 0 || reply === "0") return false;
    } catch {
      // fall through to memory
    }
  }
  const now = Date.now();
  const expiresAt = memoryClaims.get(key);
  if (expiresAt && expiresAt > now) return false;
  memoryClaims.set(key, now + ttlMs);
  return true;
}

async function loadRecipients(companyId: string, wantSms: boolean) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const [settings] = await db
    .select()
    .from(bookingSettings)
    .where(and(eq(bookingSettings.companyId, companyId), isNull(bookingSettings.deletedAt)))
    .limit(1);
  const email = settings?.notificationEmail?.trim() || company?.email?.trim() || null;

  let phones: string[] = [];
  if (wantSms) {
    const companyUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.companyId, companyId), isNull(users.deletedAt)));
    phones = Array.from(
      new Set(
        companyUsers
          .filter((user) => user.role === "owner" || user.role === "admin")
          .map((user) => user.phone?.trim() ?? "")
          .filter((phone) => phone.length > 0)
      )
    );
  }
  return { companyName: company?.name ?? "your shop", email, phones };
}

export async function queueOwnerAlert(input: OwnerAlertInput): Promise<OwnerAlertOutcome> {
  const log = { companyId: input.companyId, kind: input.kind, entityId: input.entityId };
  try {
    if (!input.enabled) {
      logger.info(log, "Owner alert skipped (turned off)");
      return { status: "skipped", reason: "disabled" };
    }

    const claimed = await claimOnce(`fsm:owner-alert:once:${input.kind}:${input.entityId}`, OWNER_ALERT_ONCE_TTL_MS);
    if (!claimed) {
      logger.info(log, "Owner alert skipped (already sent for this entity)");
      return { status: "skipped", reason: "duplicate" };
    }

    const rate = await hitFixedWindowRateLimit({
      key: `fsm:owner-alert:rate:company:${input.companyId}`,
      limit: OWNER_ALERT_COMPANY_HOURLY_LIMIT,
      windowMs: OWNER_ALERT_RATE_WINDOW_MS
    });
    if (!rate.allowed) {
      // Excess alerts are folded: nothing is sent, the item is still in the inbox and this log line records it.
      logger.warn({ ...log, count: rate.count, limit: rate.limit }, "Owner alert folded (company hourly limit)");
      return { status: "skipped", reason: "rate_limited" };
    }

    const smsLive = Boolean(input.sms) && featureFlags.outboundSmsEnabled;
    const recipients = await loadRecipients(input.companyId, smsLive);
    const channels: Array<"email" | "sms"> = [];
    if (recipients.email) channels.push("email");
    if (recipients.phones.length > 0) channels.push("sms");
    if (channels.length === 0) {
      logger.info(log, "Owner alert skipped (no owner email or live SMS recipient)");
      return { status: "skipped", reason: "no_recipient" };
    }

    const jobId = ownerAlertJobId(input.kind, input.entityId);
    const actionUrl = `${env.APP_URL.replace(/\/+$/u, "")}${input.actionPath}`;
    await notificationsQueue.add(
      OWNER_ALERT_JOB_NAME,
      {
        companyId: input.companyId,
        kind: input.kind,
        entityId: input.entityId,
        companyName: recipients.companyName,
        headline: input.headline,
        summary: input.summary,
        actionUrl,
        actionLabel: input.actionLabel,
        toEmail: recipients.email,
        toPhones: recipients.phones,
        smsBody: `${input.headline}: ${input.summary} ${actionUrl}`.slice(0, 320)
      },
      { jobId }
    );
    logger.info({ ...log, channels }, "Owner alert queued");
    return { status: "queued", jobId, channels };
  } catch (error) {
    logger.error({ ...log, err: error }, "Owner alert failed to queue");
    return { status: "skipped", reason: "error" };
  }
}

/** "Dana Smith" -> "Dana S." (alerts never carry full names, phones, emails or messages). */
export function shortCustomerName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = (firstName ?? "").trim() || "A customer";
  const initial = (lastName ?? "").trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}
