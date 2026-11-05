/**
 * FS-281 — phone-level SMS opt-out helpers (platform-level table, see `smsOptOuts` in schema.ts).
 *
 * Tenant isolation: `sms_opt_outs` has no company_id by design. Renvani sends all SMS from one shared
 * Twilio number (#295 ruling), so a STOP is a carrier-level, platform-wide consent withdrawal. Writes only
 * ever withdraw consent; reads return a boolean for a single E.164 phone and expose no other row data.
 */
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "./client.js";
import { smsOptOuts } from "./schema.js";

type Executor = Pick<typeof db, "insert" | "select">;

/** Digits-only match of a stored phone column against an E.164 phone (legacy formats match without backfill). */
export function phoneMatchesE164(column: AnyPgColumn, phoneE164: string): SQL {
  const digits = phoneE164.replace(/\D/gu, "");
  const candidates = digits.length === 11 && digits.startsWith("1") ? [digits, digits.slice(1)] : [digits];
  return sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g') in (${sql.join(
    candidates.map((candidate) => sql`${candidate}`),
    sql`, `
  )})`;
}

export async function recordSmsOptOut(
  executor: Executor,
  input: { phoneE164: string; source: string; providerMessageId: string | null }
): Promise<void> {
  const now = new Date();
  await executor
    .insert(smsOptOuts)
    .values({ phoneE164: input.phoneE164, source: input.source, providerMessageId: input.providerMessageId })
    .onConflictDoUpdate({
      target: smsOptOuts.phoneE164,
      set: { source: input.source, providerMessageId: input.providerMessageId, deletedAt: null, updatedAt: now }
    });
}

/** True when the phone has an active platform-wide opt-out. Throws on lookup failure (callers fail closed). */
export async function isPhoneSmsOptedOut(phoneE164: string, executor: Pick<typeof db, "select"> = db): Promise<boolean> {
  const rows = await executor
    .select({ id: smsOptOuts.id })
    .from(smsOptOuts)
    .where(and(eq(smsOptOuts.phoneE164, phoneE164), isNull(smsOptOuts.deletedAt)))
    .limit(1);
  return rows.length > 0;
}
