import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";

import {
  PAYOUTS_DISPUTES_PAGE_DEFAULT,
  PAYOUTS_DISPUTES_PAGE_MAX,
  isDisputeStatusOpen,
  normalizeDisputeToken,
  type DisputeSummary
} from "@fsm/types";

import { runTransactionWithTenantSession } from "./run-with-tenant-session.js";
import { payments, stripeDisputes } from "./schema.js";

/** Provider-neutral snapshot written by the webhook ingest (FS-199). Amount is in minor units. */
export type StripeDisputeSnapshot = {
  stripeDisputeId: string;
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  reason: string;
  evidenceDueBy: Date | null;
  disputedAt: Date;
  resourceVersion: string;
};

type DisputeRow = typeof stripeDisputes.$inferSelect;

function toMajorUnits(amountMinor: number): string {
  return (Math.trunc(amountMinor) / 100).toFixed(2);
}

function mapDispute(row: DisputeRow, invoiceId: string | null): DisputeSummary {
  return {
    id: row.id,
    stripeDisputeId: row.stripeDisputeId,
    stripeChargeId: row.stripeChargeId,
    stripePaymentIntentId: row.stripePaymentIntentId,
    paymentId: row.paymentId,
    invoiceId,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    open: isDisputeStatusOpen(row.status),
    reason: row.reason,
    evidenceDueBy: row.evidenceDueBy ? row.evidenceDueBy.toISOString() : null,
    disputedAt: row.disputedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

/**
 * Idempotent upsert keyed on (company_id, stripe_dispute_id). The update only applies when the
 * incoming resource_version is strictly newer, so replays and out-of-order deliveries are no-ops.
 */
export async function upsertStripeDisputeFromWebhook(
  companyId: string,
  snapshot: StripeDisputeSnapshot
): Promise<{ applied: boolean; disputeId: string | null }> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    let paymentId: string | null = null;
    if (snapshot.stripePaymentIntentId) {
      const [payment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.companyId, companyId),
            eq(payments.stripePaymentIntentId, snapshot.stripePaymentIntentId),
            isNull(payments.deletedAt)
          )
        )
        .limit(1);
      paymentId = payment?.id ?? null;
    }

    const values = {
      companyId,
      stripeDisputeId: snapshot.stripeDisputeId,
      stripeChargeId: snapshot.stripeChargeId,
      stripePaymentIntentId: snapshot.stripePaymentIntentId,
      paymentId,
      amount: toMajorUnits(snapshot.amountMinor),
      currency: snapshot.currency.toLowerCase().slice(0, 3),
      status: normalizeDisputeToken(snapshot.status),
      reason: normalizeDisputeToken(snapshot.reason, "general"),
      evidenceDueBy: snapshot.evidenceDueBy,
      disputedAt: snapshot.disputedAt,
      resourceVersion: snapshot.resourceVersion
    };

    const rows = await tx
      .insert(stripeDisputes)
      .values(values)
      .onConflictDoUpdate({
        target: [stripeDisputes.companyId, stripeDisputes.stripeDisputeId],
        targetWhere: sql`"deleted_at" IS NULL`,
        set: {
          stripeChargeId: values.stripeChargeId,
          stripePaymentIntentId: values.stripePaymentIntentId,
          paymentId: sql`COALESCE(${stripeDisputes.paymentId}, ${values.paymentId})`,
          amount: values.amount,
          currency: values.currency,
          status: values.status,
          reason: values.reason,
          evidenceDueBy: values.evidenceDueBy,
          resourceVersion: values.resourceVersion,
          updatedAt: new Date()
        },
        setWhere: sql`${stripeDisputes.resourceVersion} < ${values.resourceVersion}`
      })
      .returning({ id: stripeDisputes.id });

    return { applied: rows.length > 0, disputeId: rows[0]?.id ?? null };
  });
}

export type ListStripeDisputesQuery = {
  status?: string;
  limit?: number;
  /** Opaque keyset cursor returned as `nextCursor`. */
  cursor?: string;
};

function encodeCursor(row: DisputeRow): string {
  return Buffer.from(`${row.disputedAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { disputedAt: Date; id: string } | null {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const disputedAt = at ? new Date(at) : null;
  if (!disputedAt || Number.isNaN(disputedAt.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { disputedAt, id };
}

export async function listStripeDisputes(
  companyId: string,
  query: ListStripeDisputesQuery
): Promise<{ data: DisputeSummary[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(query.limit ?? PAYOUTS_DISPUTES_PAGE_DEFAULT, 1), PAYOUTS_DISPUTES_PAGE_MAX);
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (query.cursor && !cursor) throw new Error("STRIPE_DISPUTE_INVALID_CURSOR");

  return runTransactionWithTenantSession(companyId, async (tx) => {
    const conditions = [eq(stripeDisputes.companyId, companyId), isNull(stripeDisputes.deletedAt)];
    if (query.status) conditions.push(eq(stripeDisputes.status, query.status));
    if (cursor) {
      conditions.push(
        or(
          lt(stripeDisputes.disputedAt, cursor.disputedAt),
          and(eq(stripeDisputes.disputedAt, cursor.disputedAt), lt(stripeDisputes.id, cursor.id))
        )!
      );
    }
    const rows = await tx
      .select({ dispute: stripeDisputes, invoiceId: payments.invoiceId })
      .from(stripeDisputes)
      .leftJoin(payments, eq(payments.id, stripeDisputes.paymentId))
      .where(and(...conditions))
      .orderBy(desc(stripeDisputes.disputedAt), desc(stripeDisputes.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: page.map((r) => mapDispute(r.dispute, r.invoiceId ?? null)),
      nextCursor: rows.length > limit && last ? encodeCursor(last.dispute) : null
    };
  });
}

export async function getStripeDisputeById(companyId: string, disputeId: string): Promise<DisputeSummary | null> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const [row] = await tx
      .select({ dispute: stripeDisputes, invoiceId: payments.invoiceId })
      .from(stripeDisputes)
      .leftJoin(payments, eq(payments.id, stripeDisputes.paymentId))
      .where(
        and(eq(stripeDisputes.companyId, companyId), eq(stripeDisputes.id, disputeId), isNull(stripeDisputes.deletedAt))
      )
      .limit(1);
    return row ? mapDispute(row.dispute, row.invoiceId ?? null) : null;
  });
}
