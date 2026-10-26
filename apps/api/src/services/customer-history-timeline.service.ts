import { and, desc, eq, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
  customerNotes,
  customers,
  db,
  estimates,
  invoices,
  jobs,
  messageLogs,
  payments,
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  customerHistoryTimelineItemTypeSchema,
  type CustomerHistoryTimelineItem,
  type CustomerHistoryTimelineItemType,
  type CustomerHistoryTimelineResponse,
  type ListCustomerHistoryTimelineQuery,
} from "@fsm/types";

type TimelineCursor = {
  occurredAt: string;
  type: CustomerHistoryTimelineItemType;
  id: string;
};

function lineageFromImportSession(
  importSessionId: string | null,
): "native" | "imported" {
  return importSessionId ? "imported" : "native";
}

function encodeCursor(cursor: TimelineCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): TimelineCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as TimelineCursor;
    if (
      typeof parsed.occurredAt !== "string" ||
      typeof parsed.type !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("invalid cursor shape");
    }
    customerHistoryTimelineItemTypeSchema.parse(parsed.type);
    return parsed;
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid history timeline cursor",
    );
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareItemsDesc(
  left: CustomerHistoryTimelineItem,
  right: CustomerHistoryTimelineItem,
): number {
  const timeCompare = compareText(right.occurredAt, left.occurredAt);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  const typeCompare = compareText(right.type, left.type);
  if (typeCompare !== 0) {
    return typeCompare;
  }
  return compareText(right.id, left.id);
}

function parseTypeFilter(
  types: string | undefined,
): Set<CustomerHistoryTimelineItemType> | null {
  if (!types) {
    return null;
  }

  const parsed = types
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const result = customerHistoryTimelineItemTypeSchema.safeParse(entry);
      if (!result.success) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Invalid history timeline type: ${entry}`,
        );
      }
      return result.data;
    });

  return new Set(parsed);
}

function jobOccurredAt(job: {
  actualEnd: Date | null;
  scheduledStart: Date | null;
  createdAt: Date;
}): Date {
  return job.actualEnd ?? job.scheduledStart ?? job.createdAt;
}

function estimateOccurredAt(estimate: {
  approvedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}): Date {
  return estimate.approvedAt ?? estimate.sentAt ?? estimate.createdAt;
}

function invoiceOccurredAt(invoice: {
  paidAt: Date | null;
  issuedAt: Date | null;
  createdAt: Date;
}): Date {
  return invoice.paidAt ?? invoice.issuedAt ?? invoice.createdAt;
}

/** Millisecond-truncated COALESCE so SQL ordering/cursor matches the ISO cursor value. */
function occurredAtExpr(first: AnyPgColumn, second: AnyPgColumn, third?: AnyPgColumn): SQL {
  return third
    ? sql`date_trunc('milliseconds', coalesce(${first}, ${second}, ${third}))`
    : sql`date_trunc('milliseconds', coalesce(${first}, ${second}))`;
}

/**
 * Keyset predicate for one source: rows strictly after the cursor in
 * (occurredAt DESC, type DESC, id DESC) order. Type is constant per source.
 */
function cursorPredicate(
  type: CustomerHistoryTimelineItemType,
  occurredAt: SQL,
  idColumn: AnyPgColumn,
  cursor: TimelineCursor | null,
): SQL | undefined {
  if (!cursor) {
    return undefined;
  }
  const at = sql`${cursor.occurredAt}::timestamptz`;
  if (type < cursor.type) {
    return lte(occurredAt, at);
  }
  if (type > cursor.type) {
    return lt(occurredAt, at);
  }
  return or(
    lt(occurredAt, at),
    and(eq(occurredAt, at), lt(idColumn, cursor.id)),
  );
}

async function assertCustomerInTenant(
  companyId: string,
  customerId: string,
): Promise<void> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.companyId, companyId),
        eq(customers.id, customerId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }
}

export async function listCustomerHistoryTimeline(
  companyId: string,
  customerId: string,
  query: ListCustomerHistoryTimelineQuery,
): Promise<CustomerHistoryTimelineResponse> {
  await assertCustomerInTenant(companyId, customerId);

  const typeFilter = parseTypeFilter(query.types);
  const limit = query.limit;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  // Each source fetches at most limit + 1 rows past the cursor, in timeline order.
  const perSource = limit + 1;
  const items: CustomerHistoryTimelineItem[] = [];

  if (!typeFilter || typeFilter.has("job")) {
    const occurredAt = occurredAtExpr(
      jobs.actualEnd,
      jobs.scheduledStart,
      jobs.createdAt,
    );
    const jobRows = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.customerId, customerId),
          isNull(jobs.deletedAt),
          cursorPredicate("job", occurredAt, jobs.id, cursor),
        ),
      )
      .orderBy(desc(occurredAt), desc(jobs.id))
      .limit(perSource);

    for (const job of jobRows) {
      items.push({
        id: job.id,
        type: "job",
        occurredAt: jobOccurredAt(job).toISOString(),
        title: `${job.jobNumber} · ${job.title}`,
        subtitle: job.status,
        status: job.status,
        amount: job.invoiceTotal,
        lineage: lineageFromImportSession(job.importSessionId),
        sourceSystem: job.sourceSystem,
        sourceId: job.sourceId,
        importSessionId: job.importSessionId,
        href: `/jobs/${job.id}`,
      });
    }
  }

  if (!typeFilter || typeFilter.has("estimate")) {
    const occurredAt = occurredAtExpr(
      estimates.approvedAt,
      estimates.sentAt,
      estimates.createdAt,
    );
    const estimateRows = await db
      .select()
      .from(estimates)
      .where(
        and(
          eq(estimates.companyId, companyId),
          eq(estimates.customerId, customerId),
          isNull(estimates.deletedAt),
          cursorPredicate("estimate", occurredAt, estimates.id, cursor),
        ),
      )
      .orderBy(desc(occurredAt), desc(estimates.id))
      .limit(perSource);

    for (const estimate of estimateRows) {
      items.push({
        id: estimate.id,
        type: "estimate",
        occurredAt: estimateOccurredAt(estimate).toISOString(),
        title: estimate.title
          ? `${estimate.estimateNumber} · ${estimate.title}`
          : estimate.estimateNumber,
        subtitle: estimate.status,
        status: estimate.status,
        amount: estimate.total,
        lineage: lineageFromImportSession(estimate.importSessionId),
        sourceSystem: estimate.sourceSystem,
        sourceId: estimate.sourceId,
        importSessionId: estimate.importSessionId,
        href: `/estimates/${estimate.id}`,
      });
    }
  }

  if (!typeFilter || typeFilter.has("invoice")) {
    const occurredAt = occurredAtExpr(
      invoices.paidAt,
      invoices.issuedAt,
      invoices.createdAt,
    );
    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          eq(invoices.customerId, customerId),
          isNull(invoices.deletedAt),
          cursorPredicate("invoice", occurredAt, invoices.id, cursor),
        ),
      )
      .orderBy(desc(occurredAt), desc(invoices.id))
      .limit(perSource);

    for (const invoice of invoiceRows) {
      items.push({
        id: invoice.id,
        type: "invoice",
        occurredAt: invoiceOccurredAt(invoice).toISOString(),
        title: invoice.title
          ? `${invoice.invoiceNumber} · ${invoice.title}`
          : invoice.invoiceNumber,
        subtitle: invoice.status,
        status: invoice.status,
        amount: invoice.total,
        lineage: lineageFromImportSession(invoice.importSessionId),
        sourceSystem: invoice.sourceSystem,
        sourceId: invoice.sourceId,
        importSessionId: invoice.importSessionId,
        href: `/invoices/${invoice.id}`,
      });
    }
  }

  if (!typeFilter || typeFilter.has("payment")) {
    const occurredAt = occurredAtExpr(payments.paidAt, payments.createdAt);
    const paymentRows = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.companyId, companyId),
          eq(payments.customerId, customerId),
          isNull(payments.deletedAt),
          cursorPredicate("payment", occurredAt, payments.id, cursor),
        ),
      )
      .orderBy(desc(occurredAt), desc(payments.id))
      .limit(perSource);

    for (const payment of paymentRows) {
      items.push({
        id: payment.id,
        type: "payment",
        occurredAt: (payment.paidAt ?? payment.createdAt).toISOString(),
        title: `Payment · ${payment.method}`,
        subtitle: payment.status,
        status: payment.status,
        amount: payment.amount,
        lineage: lineageFromImportSession(payment.importSessionId),
        sourceSystem: payment.sourceSystem,
        sourceId: payment.sourceId,
        importSessionId: payment.importSessionId,
        href: payment.invoiceId ? `/invoices/${payment.invoiceId}` : null,
      });
    }
  }

  if (!typeFilter || typeFilter.has("note")) {
    const occurredAt = occurredAtExpr(
      customerNotes.notedAt,
      customerNotes.createdAt,
    );
    const noteRows = await db
      .select()
      .from(customerNotes)
      .where(
        and(
          eq(customerNotes.companyId, companyId),
          eq(customerNotes.customerId, customerId),
          isNull(customerNotes.deletedAt),
          cursorPredicate("note", occurredAt, customerNotes.id, cursor),
        ),
      )
      .orderBy(desc(occurredAt), desc(customerNotes.id))
      .limit(perSource);

    for (const note of noteRows) {
      const preview =
        note.content.length > 120
          ? `${note.content.slice(0, 117)}...`
          : note.content;
      items.push({
        id: note.id,
        type: "note",
        occurredAt: (note.notedAt ?? note.createdAt).toISOString(),
        title: preview,
        subtitle: note.isInternal ? "Internal note" : "Customer note",
        status: null,
        amount: null,
        lineage: lineageFromImportSession(note.importSessionId),
        sourceSystem: note.sourceSystem,
        sourceId: note.sourceId,
        importSessionId: note.importSessionId,
        href: null,
      });
    }
  }

  if (!typeFilter || typeFilter.has("communication")) {
    const occurredAt = occurredAtExpr(
      messageLogs.sentAt,
      messageLogs.createdAt,
    );
    const messageRows = await db
      .select()
      .from(messageLogs)
      .where(
        and(
          eq(messageLogs.companyId, companyId),
          eq(messageLogs.customerId, customerId),
          isNull(messageLogs.deletedAt),
          cursorPredicate("communication", occurredAt, messageLogs.id, cursor),
        ),
      )
      .orderBy(desc(occurredAt), desc(messageLogs.id))
      .limit(perSource);

    for (const message of messageRows) {
      const preview =
        message.body.length > 120
          ? `${message.body.slice(0, 117)}...`
          : message.body;
      items.push({
        id: message.id,
        type: "communication",
        occurredAt: (message.sentAt ?? message.createdAt).toISOString(),
        title:
          message.subject?.trim() || `${message.channel} ${message.direction}`,
        subtitle: preview,
        status: message.providerStatus,
        amount: null,
        lineage: lineageFromImportSession(message.importSessionId),
        sourceSystem: message.sourceSystem,
        sourceId: message.sourceId,
        importSessionId: message.importSessionId,
        href: message.jobId ? `/jobs/${message.jobId}` : null,
      });
    }
  }

  const sorted = items.sort(compareItemsDesc);
  const page = sorted.slice(0, limit);
  const hasMore = sorted.length > limit;
  const lastItem = page.at(-1);
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor({
          occurredAt: lastItem.occurredAt,
          type: lastItem.type,
          id: lastItem.id,
        })
      : null;

  return {
    customerId,
    items: page,
    nextCursor,
  };
}
