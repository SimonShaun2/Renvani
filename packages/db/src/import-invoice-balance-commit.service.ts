import { randomUUID } from "node:crypto";

import { and, eq, isNull, ne } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { db } from "./client.js";
import { emitEventWithExecutor } from "./events.js";
import { invoices, payments } from "./schema.js";
import type {
  ImportInvoiceBalanceCommitContext,
  ImportInvoiceBalanceCommitResult,
  ImportInvoiceBalanceCommitRowError,
  ImportInvoiceCommitRow,
  ImportPaymentCommitRow,
} from "@fsm/types";

import {
  deriveImportedInvoiceStatus,
  formatImportMoney,
  parseImportMoney,
  resolveInvoiceOpenBalanceAmounts,
} from "./import-invoice-balance-commit.logic.js";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

export interface ImportInvoiceBalanceEntityResolver {
  resolveCustomerId(params: {
    customerId?: string;
    customerSourceId?: string;
  }): Promise<string | null>;
  resolveJobId?(params: { jobSourceId: string }): Promise<string | null>;
  resolveInvoiceId?(params: { invoiceSourceId: string }): Promise<string | null>;
}

async function findInvoiceByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, companyId),
        eq(invoices.sourceSystem, sourceSystem),
        eq(invoices.sourceId, sourceId),
        isNull(invoices.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function findPaymentByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.companyId, companyId),
        eq(payments.sourceSystem, sourceSystem),
        eq(payments.sourceId, sourceId),
        isNull(payments.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function pushRowError(
  errors: ImportInvoiceBalanceCommitRowError[],
  rowNumber: number,
  field: string,
  message: string,
): void {
  errors.push({ rowNumber, field, message });
}

function aggregatePaymentSourceId(invoiceSourceId: string): string {
  return `${invoiceSourceId}:import-aggregate`;
}

async function upsertImportedAggregatePayment(
  executor: DbExecutor,
  ctx: ImportInvoiceBalanceCommitContext,
  invoiceId: string,
  customerId: string,
  invoiceSourceId: string,
  amountPaid: string,
  paidAt: Date | null,
  now: Date,
): Promise<void> {
  const paidAmount = parseImportMoney(amountPaid);
  if (!paidAmount || paidAmount.lte(0)) {
    return;
  }

  const aggregateSourceId = aggregatePaymentSourceId(invoiceSourceId);

  // Itemized payments already imported for this invoice are authoritative; an aggregate
  // placeholder on top would double-count amount paid.
  const itemized = await executor
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.companyId, ctx.companyId),
        eq(payments.invoiceId, invoiceId),
        eq(payments.sourceSystem, ctx.sourceSystem),
        ne(payments.sourceId, aggregateSourceId),
        isNull(payments.deletedAt),
      ),
    )
    .limit(1);
  if (itemized.length > 0) {
    return;
  }

  const existing = await findPaymentByLineage(
    executor,
    ctx.companyId,
    ctx.sourceSystem,
    aggregateSourceId,
  );

  const paymentValues = {
    amount: formatImportMoney(paidAmount),
    method: "other" as const,
    status: "succeeded" as const,
    paidAt: paidAt ?? now,
    importSessionId: ctx.importSessionId,
    updatedAt: now,
  };

  if (existing) {
    await executor
      .update(payments)
      .set(paymentValues)
      .where(and(eq(payments.companyId, ctx.companyId), eq(payments.id, existing.id)));
    return;
  }

  await executor.insert(payments).values({
    id: randomUUID(),
    companyId: ctx.companyId,
    invoiceId,
    customerId,
    collectedById: ctx.actorId ?? null,
    sourceSystem: ctx.sourceSystem,
    sourceId: aggregateSourceId,
    createdAt: now,
    ...paymentValues,
  });
}

export async function commitImportedInvoiceRows(
  ctx: ImportInvoiceBalanceCommitContext,
  rows: ImportInvoiceCommitRow[],
  resolver: ImportInvoiceBalanceEntityResolver,
  executor: DbExecutor = db,
): Promise<ImportInvoiceBalanceCommitResult> {
  const errors: ImportInvoiceBalanceCommitRowError[] = [];
  let invoicesCommitted = 0;
  const now = new Date();

  for (const row of rows) {
    const amounts = resolveInvoiceOpenBalanceAmounts({
      total: row.total,
      ...(row.balanceDue !== undefined ? { balanceDue: row.balanceDue } : {}),
      ...(row.amountPaid !== undefined ? { amountPaid: row.amountPaid } : {}),
    });

    if (!amounts) {
      pushRowError(errors, row.rowNumber, "total", "Invalid invoice total or balance");
      continue;
    }

    const customerId = await resolver.resolveCustomerId({
      ...(row.customerId !== undefined ? { customerId: row.customerId } : {}),
      ...(row.customerSourceId !== undefined ? { customerSourceId: row.customerSourceId } : {}),
    });

    if (!customerId) {
      pushRowError(errors, row.rowNumber, "customerSourceId", "Customer could not be resolved");
      continue;
    }

    let jobId: string | null = null;
    if (row.jobSourceId) {
      if (!resolver.resolveJobId) {
        pushRowError(errors, row.rowNumber, "jobSourceId", "Job resolver is not configured");
        continue;
      }

      jobId = await resolver.resolveJobId({ jobSourceId: row.jobSourceId });
      if (!jobId) {
        pushRowError(errors, row.rowNumber, "jobSourceId", "Job could not be resolved");
        continue;
      }
    }

    const balanceDue = parseImportMoney(amounts.balanceDue);
    const amountPaid = parseImportMoney(amounts.amountPaid);
    if (!balanceDue || !amountPaid) {
      pushRowError(errors, row.rowNumber, "balanceDue", "Invalid monetary amounts");
      continue;
    }

    const status = deriveImportedInvoiceStatus(balanceDue, amountPaid);
    const paidAt =
      status === "paid"
        ? row.paidAt ?? (balanceDue.lte(0) ? row.issuedAt ?? null : null)
        : row.paidAt ?? null;

    const existing = await findInvoiceByLineage(executor, ctx.companyId, ctx.sourceSystem, row.sourceId);

    if (existing) {
      await executor
        .update(invoices)
        .set({
          invoiceNumber: row.invoiceNumber,
          customerId,
          jobId,
          status,
          subtotal: amounts.total,
          total: amounts.total,
          amountPaid: amounts.amountPaid,
          balanceDue: amounts.balanceDue,
          issuedAt: row.issuedAt ?? existing.issuedAt,
          dueAt: row.dueAt ?? existing.dueAt,
          paidAt,
          title: row.title ?? existing.title,
          importSessionId: ctx.importSessionId,
          updatedAt: now,
        })
        .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, existing.id)));
      await upsertImportedAggregatePayment(
        executor,
        ctx,
        existing.id,
        customerId,
        row.sourceId,
        amounts.amountPaid,
        paidAt,
        now,
      );
      invoicesCommitted += 1;
      continue;
    }

    const invoiceId = randomUUID();
    await executor.insert(invoices).values({
      id: invoiceId,
      companyId: ctx.companyId,
      invoiceNumber: row.invoiceNumber,
      customerId,
      jobId,
      createdById: ctx.actorId ?? null,
      status,
      subtotal: amounts.total,
      taxRate: "0.0000",
      taxAmount: "0.00",
      discountAmount: "0.00",
      total: amounts.total,
      amountPaid: amounts.amountPaid,
      balanceDue: amounts.balanceDue,
      issuedAt: row.issuedAt ?? null,
      dueAt: row.dueAt ?? null,
      paidAt,
      title: row.title ?? null,
      sourceSystem: ctx.sourceSystem,
      sourceId: row.sourceId,
      importSessionId: ctx.importSessionId,
      createdAt: now,
      updatedAt: now,
    });

    await upsertImportedAggregatePayment(
      executor,
      ctx,
      invoiceId,
      customerId,
      row.sourceId,
      amounts.amountPaid,
      paidAt,
      now,
    );

    await emitEventWithExecutor(executor, {
      companyId: ctx.companyId,
      actorId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "system",
      eventType: status === "paid" ? "invoice.paid" : "invoice.created",
      entityType: "invoice",
      entityId: invoiceId,
      customerId,
      invoiceId,
      summary:
        status === "paid"
          ? `Imported invoice ${row.invoiceNumber} marked paid from migration`
          : `Imported invoice ${row.invoiceNumber} with open balance ${amounts.balanceDue}`,
      payload: {
        importSessionId: ctx.importSessionId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        paidAt: paidAt?.toISOString() ?? null,
        balanceDue: amounts.balanceDue,
      },
    });

    invoicesCommitted += 1;
  }

  return {
    invoicesCommitted,
    paymentsCommitted: 0,
    rowsFailed: errors.length,
    errors,
  };
}

export async function commitImportedPaymentRows(
  ctx: ImportInvoiceBalanceCommitContext,
  rows: ImportPaymentCommitRow[],
  resolver: ImportInvoiceBalanceEntityResolver,
  executor: DbExecutor = db,
): Promise<ImportInvoiceBalanceCommitResult> {
  const errors: ImportInvoiceBalanceCommitRowError[] = [];
  let paymentsCommitted = 0;
  const now = new Date();

  for (const row of rows) {
    const amount = parseImportMoney(row.amount);
    if (!amount || amount.lte(0)) {
      pushRowError(errors, row.rowNumber, "amount", "Invalid payment amount");
      continue;
    }

    let invoiceId: string | null = null;
    if (resolver.resolveInvoiceId) {
      invoiceId = await resolver.resolveInvoiceId({ invoiceSourceId: row.invoiceSourceId });
    }
    if (!invoiceId) {
      const invoice = await findInvoiceByLineage(
        executor,
        ctx.companyId,
        ctx.sourceSystem,
        row.invoiceSourceId,
      );
      invoiceId = invoice?.id ?? null;
    }

    if (!invoiceId) {
      pushRowError(errors, row.rowNumber, "invoiceSourceId", "Invoice could not be resolved");
      continue;
    }

    const invoiceRows = await executor
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)),
      )
      .limit(1);
    const invoice = invoiceRows[0];

    if (!invoice) {
      pushRowError(errors, row.rowNumber, "invoiceSourceId", "Invoice not found");
      continue;
    }

    const existingPayment = await findPaymentByLineage(
      executor,
      ctx.companyId,
      ctx.sourceSystem,
      row.sourceId,
    );

    const paymentValues = {
      amount: formatImportMoney(amount),
      method: row.method,
      status: "succeeded" as const,
      paidAt: row.paidAt,
      referenceNumber: row.referenceNumber ?? null,
      notes: row.notes ?? null,
      importSessionId: ctx.importSessionId,
      updatedAt: now,
    };

    let paymentId: string;

    if (existingPayment) {
      paymentId = existingPayment.id;
      await executor
        .update(payments)
        .set(paymentValues)
        .where(and(eq(payments.companyId, ctx.companyId), eq(payments.id, existingPayment.id)));
    } else {
      paymentId = randomUUID();
      await executor.insert(payments).values({
        id: paymentId,
        companyId: ctx.companyId,
        invoiceId,
        customerId: invoice.customerId,
        collectedById: ctx.actorId ?? null,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        createdAt: now,
        ...paymentValues,
      });
    }

    // The invoice import may have recorded an aggregate placeholder payment (total - balance).
    // Once itemized payments arrive they replace it, otherwise amount paid is double-counted.
    if (invoice.sourceId && row.sourceId !== aggregatePaymentSourceId(invoice.sourceId)) {
      await executor
        .update(payments)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(payments.companyId, ctx.companyId),
            eq(payments.invoiceId, invoiceId),
            eq(payments.sourceSystem, ctx.sourceSystem),
            eq(payments.sourceId, aggregatePaymentSourceId(invoice.sourceId)),
            isNull(payments.deletedAt),
          ),
        );
    }

    const paymentRows = await executor
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.companyId, ctx.companyId),
          eq(payments.invoiceId, invoiceId),
          isNull(payments.deletedAt),
          eq(payments.status, "succeeded"),
        ),
      );

    const totalPaid = paymentRows.reduce(
      (sum, paymentRow) => sum.plus(new Decimal(paymentRow.amount)),
      new Decimal(0),
    );
    const invoiceTotal = new Decimal(invoice.total);
    const balanceDue = Decimal.max(invoiceTotal.minus(totalPaid), new Decimal(0));
    const nextStatus = deriveImportedInvoiceStatus(balanceDue, totalPaid);
    const latestPaidAt = paymentRows.reduce<Date | null>((latest, paymentRow) => {
      if (!paymentRow.paidAt) {
        return latest;
      }
      if (!latest || paymentRow.paidAt.getTime() > latest.getTime()) {
        return paymentRow.paidAt;
      }
      return latest;
    }, null);

    await executor
      .update(invoices)
      .set({
        amountPaid: formatImportMoney(totalPaid),
        balanceDue: formatImportMoney(balanceDue),
        status: nextStatus,
        paidAt: balanceDue.lte(0) ? latestPaidAt ?? row.paidAt : invoice.paidAt,
        updatedAt: now,
      })
      .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, invoiceId)));

    await emitEventWithExecutor(executor, {
      companyId: ctx.companyId,
      actorId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "system",
      eventType: totalPaid.lt(invoiceTotal) ? "payment.partial" : "payment.received",
      entityType: "payment",
      entityId: paymentId,
      customerId: invoice.customerId,
      invoiceId,
      summary: `Imported payment applied to invoice ${invoice.invoiceNumber}`,
      payload: {
        importSessionId: ctx.importSessionId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        paidAt: row.paidAt.toISOString(),
        amount: formatImportMoney(amount),
      },
    });

    paymentsCommitted += 1;
  }

  return {
    invoicesCommitted: 0,
    paymentsCommitted,
    rowsFailed: errors.length,
    errors,
  };
}
