import { and, eq, inArray, isNull } from "drizzle-orm";

import { estimates, invoices, payments, type db } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

type Tx = Pick<typeof db, "select" | "update">;

/** Invoice statuses that mean money moved; never rolled back. */
const PAID_INVOICE_STATUSES = new Set(["paid", "partially_paid"]);
/** Estimate statuses the customer acted on; never rolled back. */
const ACCEPTED_ESTIMATE_STATUSES = new Set(["approved", "converted"]);
/** Already closed invoice statuses: leave as-is. */
const CLOSED_INVOICE_STATUSES = new Set(["void", "written_off"]);
const ID_LIST_LIMIT = 20;

function idList(ids: string[]): string {
  return ids.length > ID_LIST_LIMIT
    ? `${ids.slice(0, ID_LIST_LIMIT).join(", ")} (+${ids.length - ID_LIST_LIMIT} more)`
    : ids.join(", ");
}

/**
 * Rolls back invoices/estimates tagged with an import session. Refuses (CONFLICT, counts + ids,
 * no writes) when any imported invoice has payments or a paid status, or any imported estimate was
 * approved/converted. Otherwise: drafts are soft-deleted, sent invoices are voided, sent estimates
 * are expired (no void status). Payments are never touched.
 */
export async function rollbackImportedBilling(
  tx: Tx,
  companyId: string,
  importSessionId: string,
  now: Date
): Promise<{ invoicesDeleted: number; invoicesVoided: number; estimatesDeleted: number; estimatesExpired: number }> {
  const importedInvoices = await tx
    .select({ id: invoices.id, status: invoices.status, amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(and(eq(invoices.companyId, companyId), eq(invoices.importSessionId, importSessionId), isNull(invoices.deletedAt)));
  const importedEstimates = await tx
    .select({ id: estimates.id, status: estimates.status })
    .from(estimates)
    .where(and(eq(estimates.companyId, companyId), eq(estimates.importSessionId, importSessionId), isNull(estimates.deletedAt)));

  const invoiceIds = importedInvoices.map((row) => row.id);
  const paidInvoiceIds = new Set(
    invoiceIds.length === 0
      ? []
      : (
          await tx
            .select({ invoiceId: payments.invoiceId })
            .from(payments)
            .where(and(eq(payments.companyId, companyId), inArray(payments.invoiceId, invoiceIds)))
        ).map((row) => row.invoiceId)
  );

  const blockedInvoices = importedInvoices
    .filter((row) => paidInvoiceIds.has(row.id) || PAID_INVOICE_STATUSES.has(row.status) || Number(row.amountPaid ?? 0) > 0)
    .map((row) => row.id);
  const blockedEstimates = importedEstimates.filter((row) => ACCEPTED_ESTIMATE_STATUSES.has(row.status)).map((row) => row.id);

  if (blockedInvoices.length > 0 || blockedEstimates.length > 0) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Import cannot be rolled back: ${blockedInvoices.length} invoice(s) with payments and ${blockedEstimates.length} accepted/converted estimate(s)`,
      {
        ...(blockedInvoices.length > 0 ? { invoiceIds: idList(blockedInvoices) } : {}),
        ...(blockedEstimates.length > 0 ? { estimateIds: idList(blockedEstimates) } : {})
      }
    );
  }

  const draftInvoiceIds = importedInvoices.filter((row) => row.status === "draft").map((row) => row.id);
  const sentInvoiceIds = importedInvoices
    .filter((row) => row.status !== "draft" && !CLOSED_INVOICE_STATUSES.has(row.status))
    .map((row) => row.id);
  const draftEstimateIds = importedEstimates.filter((row) => row.status === "draft").map((row) => row.id);
  const sentEstimateIds = importedEstimates
    .filter((row) => row.status === "sent" || row.status === "viewed")
    .map((row) => row.id);

  if (draftInvoiceIds.length > 0) {
    await tx
      .update(invoices)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(invoices.companyId, companyId), inArray(invoices.id, draftInvoiceIds)));
  }
  if (sentInvoiceIds.length > 0) {
    await tx
      .update(invoices)
      .set({ status: "void", balanceDue: "0.00", updatedAt: now })
      .where(and(eq(invoices.companyId, companyId), inArray(invoices.id, sentInvoiceIds)));
  }
  if (draftEstimateIds.length > 0) {
    await tx
      .update(estimates)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(estimates.companyId, companyId), inArray(estimates.id, draftEstimateIds)));
  }
  if (sentEstimateIds.length > 0) {
    await tx
      .update(estimates)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(estimates.companyId, companyId), inArray(estimates.id, sentEstimateIds)));
  }

  return {
    invoicesDeleted: draftInvoiceIds.length,
    invoicesVoided: sentInvoiceIds.length,
    estimatesDeleted: draftEstimateIds.length,
    estimatesExpired: sentEstimateIds.length
  };
}
