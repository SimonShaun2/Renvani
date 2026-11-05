import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// FS-281: real-SQL check of the phone-level opt-out helpers and digits-based phone matching
// (NEON_CI_DATABASE_URL only; skipped otherwise, never counted as passed).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const enabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

describe.runIf(enabled)("FS-281 sms_opt_outs + phoneMatchesE164 (Postgres)", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const phone = `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const local = phone.slice(2);

  beforeAll(async () => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET = process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
    const { db } = await import("./client.js");
    const { companies, customers } = await import("./schema.js");
    await db.insert(companies).values([
      { id: companyA, name: "FS281 A", slug: `fs281-a-${companyA}` },
      { id: companyB, name: "FS281 B", slug: `fs281-b-${companyB}` }
    ]);
    await db.insert(customers).values([
      { companyId: companyA, firstName: "A", lastName: "One", phone: `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` },
      { companyId: companyB, firstName: "B", lastName: "Two", phone: `1${local}` },
      { companyId: companyB, firstName: "B", lastName: "Three", phone },
      { companyId: companyB, firstName: "B", lastName: "Other", phone: "+15550000001" }
    ]);
  });

  afterAll(async () => {
    const { db } = await import("./client.js");
    const { companies, customers, smsOptOuts } = await import("./schema.js");
    await db.delete(customers).where(inArray(customers.companyId, [companyA, companyB]));
    await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
    await db.delete(smsOptOuts).where(eq(smsOptOuts.phoneE164, phone));
  });

  it("phoneMatchesE164 matches legacy formats across tenants and nothing else", async () => {
    const { db } = await import("./client.js");
    const { customers } = await import("./schema.js");
    const { phoneMatchesE164 } = await import("./sms-opt-out.js");
    const rows = await db
      .select({ lastName: customers.lastName })
      .from(customers)
      .where(and(inArray(customers.companyId, [companyA, companyB]), phoneMatchesE164(customers.phone, phone), isNull(customers.deletedAt)));
    expect(rows.map((r) => r.lastName).sort()).toEqual(["One", "Three", "Two"]);
  });

  it("recordSmsOptOut is idempotent per phone and isPhoneSmsOptedOut reads it", async () => {
    const { db } = await import("./client.js");
    const { smsOptOuts } = await import("./schema.js");
    const { isPhoneSmsOptedOut, recordSmsOptOut } = await import("./sms-opt-out.js");
    expect(await isPhoneSmsOptedOut(phone)).toBe(false);
    await recordSmsOptOut(db, { phoneE164: phone, source: "twilio_stop", providerMessageId: "SM1" });
    await db.transaction(async (tx) => recordSmsOptOut(tx, { phoneE164: phone, source: "twilio_stop", providerMessageId: "SM2" }));
    const rows = await db.select().from(smsOptOuts).where(eq(smsOptOuts.phoneE164, phone));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.providerMessageId).toBe("SM2");
    expect(await isPhoneSmsOptedOut(phone)).toBe(true);
    expect(await isPhoneSmsOptedOut("+15550000001")).toBe(false);
  });

  it("table has no company_id and enforces one row per phone", async () => {
    const { db } = await import("./client.js");
    const { sql } = await import("drizzle-orm");
    const cols = await db.execute(sql`select column_name from information_schema.columns where table_name = 'sms_opt_outs'`);
    const colRows = (Array.isArray(cols) ? cols : (cols as unknown as { rows: unknown[] }).rows) as Array<{ column_name: string }>;
    expect(colRows.map((c) => c.column_name)).not.toContain("company_id");
    await expect(db.execute(sql`insert into sms_opt_outs (phone_e164) values (${phone})`)).rejects.toBeTruthy();
  });
});
