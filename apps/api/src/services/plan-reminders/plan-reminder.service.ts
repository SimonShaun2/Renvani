/**
 * Maintenance-plan renewal + tune-up reminders. A daily scan (worker cron `plan-reminder-scan`) finds plans whose
 * renewal / next service date falls inside the rule's window and dispatches `renewal.due` through the
 * event-to-automation registry; the registered automation (requestPlanReminder) applies consent, idempotency and
 * rate limits, then queues one `send-plan-reminder` notification job with a fixed job id. Never throws.
 */
import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { automationRules, companies, customers, db, maintenancePlans } from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";

import {
  evalRateLimitScript,
  hitFixedWindowRateLimit,
  resolveRateLimitRedisClient
} from "../../lib/fixed-window-rate-limit.js";
import { isOutboundSmsLive } from "../../lib/sms.js";
import { dispatchEventAutomation } from "../automation/event-automation.registry.js";
import {
  PLAN_REMINDER_JOB_NAME,
  pickPlanReminderChannel,
  planReminderJobId,
  readPlanReminderSettings,
  selectDueReminders,
  todayInTimezone,
  type DueReminder,
  type PlanReminderKind,
  type PlanReminderSkipReason
} from "./plan-reminder-policy.js";

const logger = pino({ name: "plan-reminders" });
const DAY_MS = 24 * 60 * 60 * 1000;
const ONCE_TTL_MS = 400 * DAY_MS;

export type PlanReminderResult =
  | { status: "queued"; jobId: string; channel: "email" | "sms" }
  | { status: "skipped"; reason: PlanReminderSkipReason | "error" };

const CLAIM_LUA = `
if redis.call('SET', KEYS[1], '1', 'NX', 'PX', ARGV[1]) then
  return 1
end
return 0
`;
const RELEASE_LUA = `return redis.call('DEL', KEYS[1])`;
const memoryClaims = new Map<string, number>();

export function resetPlanReminderStateForTests(): void {
  memoryClaims.clear();
}

async function claimOnce(key: string): Promise<boolean> {
  const client = await resolveRateLimitRedisClient().catch(() => null);
  if (client) {
    try {
      const reply = await evalRateLimitScript(client, CLAIM_LUA, key, ONCE_TTL_MS);
      if (reply === 1 || reply === "1") return true;
      if (reply === 0 || reply === "0") return false;
    } catch {
      // memory fallback
    }
  }
  const now = Date.now();
  const expiresAt = memoryClaims.get(key);
  if (expiresAt && expiresAt > now) return false;
  memoryClaims.set(key, now + ONCE_TTL_MS);
  return true;
}

/** A rate-limited reminder releases its claim so the next daily scan can retry inside the same window. */
async function releaseClaim(key: string): Promise<void> {
  memoryClaims.delete(key);
  const client = await resolveRateLimitRedisClient().catch(() => null);
  if (client) await evalRateLimitScript(client, RELEASE_LUA, key).catch(() => undefined);
}

async function loadRule(companyId: string) {
  const [rule] = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.companyId, companyId),
        eq(automationRules.ruleType, "service_agreement_renewal"),
        isNull(automationRules.deletedAt)
      )
    )
    .limit(1);
  return rule ?? null;
}

function formatDueDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export interface PlanReminderEvent {
  companyId: string;
  maintenancePlanId: string;
  reminderKind: PlanReminderKind;
  dueDate: string;
}

/** renewal.due automation. Re-checks everything from the DB, so replays and stale events are safe. */
export async function requestPlanReminder(event: PlanReminderEvent, now: Date = new Date()): Promise<PlanReminderResult> {
  const log = { companyId: event.companyId, maintenancePlanId: event.maintenancePlanId, kind: event.reminderKind, dueDate: event.dueDate };
  try {
    const rule = await loadRule(event.companyId);
    if (!rule?.isEnabled) return { status: "skipped", reason: "rule_disabled" };
    const settings = readPlanReminderSettings(rule);

    const [plan] = await db
      .select()
      .from(maintenancePlans)
      .where(
        and(
          eq(maintenancePlans.companyId, event.companyId),
          eq(maintenancePlans.id, event.maintenancePlanId),
          isNull(maintenancePlans.deletedAt)
        )
      )
      .limit(1);
    const [company] = await db.select().from(companies).where(eq(companies.id, event.companyId)).limit(1);
    if (!plan || !company) return { status: "skipped", reason: "plan_not_eligible" };

    const today = todayInTimezone(now, company.timezone);
    const stillDue = selectDueReminders(plan, today, settings).some(
      (due) => due.kind === event.reminderKind && due.dueDate === event.dueDate
    );
    if (!stillDue) return { status: "skipped", reason: "plan_not_eligible" };

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, event.companyId), eq(customers.id, plan.customerId), isNull(customers.deletedAt)))
      .limit(1);
    if (!customer) return { status: "skipped", reason: "plan_not_eligible" };
    if (customer.doNotContact) return { status: "skipped", reason: "do_not_contact" };
    const channel = pickPlanReminderChannel(customer, isOutboundSmsLive());
    if (!channel) return { status: "skipped", reason: "no_consented_channel" };

    const jobId = planReminderJobId({ planId: plan.id, kind: event.reminderKind, dueDate: event.dueDate });
    const onceKey = `fsm:plan-reminder:once:${jobId}`;
    if (!(await claimOnce(onceKey))) return { status: "skipped", reason: "already_sent" };

    // Company daily cap first, so a cap-held reminder never consumes the customer cooldown.
    const companyHit = await hitFixedWindowRateLimit({
      key: `fsm:plan-reminder:rate:company:${event.companyId}`,
      limit: settings.companyDailyLimit,
      windowMs: DAY_MS
    });
    if (!companyHit.allowed) {
      await releaseClaim(onceKey);
      logger.warn({ ...log, limit: settings.companyDailyLimit }, "Plan reminder folded (company daily limit); retried on a later scan");
      return { status: "skipped", reason: "company_rate_limited" };
    }

    const customerHit = await hitFixedWindowRateLimit({
      key: `fsm:plan-reminder:rate:customer:${customer.id}`,
      limit: 1,
      windowMs: settings.customerCooldownDays * DAY_MS
    });
    if (!customerHit.allowed) {
      await releaseClaim(onceKey);
      logger.info(log, "Plan reminder folded (customer cooldown); retried on a later scan");
      return { status: "skipped", reason: "customer_rate_limited" };
    }
    const dueDateLabel = formatDueDate(event.dueDate);
    const smsBody =
      event.reminderKind === "tune_up"
        ? `${company.name}: your ${plan.name} tune-up is due around ${dueDateLabel}. Reply or call us to book. Reply STOP to opt out.`
        : `${company.name}: your ${plan.name} renews on ${dueDateLabel}. Reply or call us with questions. Reply STOP to opt out.`;

    try {
      await notificationsQueue.add(
      PLAN_REMINDER_JOB_NAME,
      {
        companyId: event.companyId,
        maintenancePlanId: plan.id,
        customerId: customer.id,
        reminderKind: event.reminderKind,
        dueDate: event.dueDate,
        channel,
        customerEmail: channel === "email" ? customer.email : null,
        customerPhone: channel === "sms" ? customer.phone : null,
        firstName: customer.firstName,
        companyName: company.name,
        planName: plan.name,
        dueDateLabel,
        smsBody: smsBody.slice(0, 320)
      },
      { jobId }
      );
    } catch (error) {
      // Release the send-once claim so the next scan in this window can retry instead of losing the reminder.
      await releaseClaim(onceKey);
      logger.error({ ...log, jobId, err: error }, "Plan reminder enqueue failed; claim released");
      return { status: "skipped", reason: "error" };
    }
    logger.info({ ...log, jobId, channel }, "Plan reminder queued");
    return { status: "queued", jobId, channel };
  } catch (error) {
    logger.error({ ...log, err: error }, "Plan reminder failed");
    return { status: "skipped", reason: "error" };
  }
}

/** Daily scan for one company: dispatches renewal.due for each plan reminder inside its window. */
export async function scanPlanRemindersForCompany(companyId: string, now: Date = new Date()): Promise<DueReminder[]> {
  const rule = await loadRule(companyId);
  if (!rule?.isEnabled) return [];
  const settings = readPlanReminderSettings(rule);
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const today = todayInTimezone(now, company?.timezone);
  const plans = await db
    .select()
    .from(maintenancePlans)
    .where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.status, "active"), isNull(maintenancePlans.deletedAt)));
  const due = plans.flatMap((plan) => selectDueReminders(plan, today, settings));
  for (const reminder of due) {
    await dispatchEventAutomation({
      eventType: "renewal.due",
      companyId,
      maintenancePlanId: reminder.planId,
      reminderKind: reminder.kind,
      dueDate: reminder.dueDate
    });
  }
  return due;
}

/** Worker cron entry point: every company with the service_agreement_renewal rule turned on. */
export async function scanAllPlanReminders(now: Date = new Date()): Promise<{ companies: number; dispatched: number }> {
  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.ruleType, "service_agreement_renewal"),
        eq(automationRules.isEnabled, true),
        isNull(automationRules.deletedAt)
      )
    );
  let dispatched = 0;
  for (const rule of rules) {
    try {
      dispatched += (await scanPlanRemindersForCompany(rule.companyId, now)).length;
    } catch (error) {
      logger.error({ err: error, companyId: rule.companyId }, "Plan reminder scan failed for company");
    }
  }
  return { companies: rules.length, dispatched };
}
