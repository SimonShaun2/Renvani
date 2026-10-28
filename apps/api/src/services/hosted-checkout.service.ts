import { createHash } from "node:crypto";

import { and, asc, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import pino from "pino";

import { companies, customers, db, invoiceItems, invoices } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { readRenvaniSubscriptionPlan } from "../lib/company-renvani-plan.js";
import {
  createInvoiceCheckoutSession,
  expireInvoiceCheckoutSession,
  retrieveInvoiceCheckoutSession,
  type InvoiceCheckoutLineItem,
  type InvoiceCheckoutSessionSnapshot
} from "../lib/stripe.js";

const logger = pino({ name: "hosted-checkout-service" });

/** Response allowlist for POST /api/v1/public/pay/:token/hosted-checkout (no ids, secrets, or Stripe internals). */
export interface PublicHostedCheckoutResponse {
  mode: "hosted";
  checkoutUrl: string;
  expiresAt: string | null;
  reused: boolean;
}

const PAYABLE_STATUSES = new Set(["sent", "viewed", "partially_paid", "overdue"]);

function stripeAppErrorConflict(message: string): AppError {
  return new AppError(ErrorCode.CONFLICT, message);
}

function sessionBelongsToInvoice(session: InvoiceCheckoutSessionSnapshot, companyId: string, invoiceId: string): boolean {
  return session.invoiceId === invoiceId && session.companyId === companyId;
}

function isOpenHosted(session: InvoiceCheckoutSessionSnapshot): session is InvoiceCheckoutSessionSnapshot & { url: string } {
  return session.uiMode === "hosted" && session.status === "open" && typeof session.url === "string" && session.url.length > 0;
}

function toResponse(session: { url: string; expiresAt: Date | null }, reused: boolean): PublicHostedCheckoutResponse {
  return { mode: "hosted", checkoutUrl: session.url, expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null, reused };
}

async function safeRetrieve(sessionId: string): Promise<InvoiceCheckoutSessionSnapshot | null> {
  try {
    return await retrieveInvoiceCheckoutSession(sessionId);
  } catch (error) {
    logger.warn({ err: error }, "Hosted checkout: previous session could not be retrieved");
    return null;
  }
}

/**
 * Stripe-hosted Checkout fallback for the public pay page (e.g. web has no publishable key, so embedded can't render).
 * - Tenant: invoice resolved by payment token; company/customer/items always filtered by the invoice's companyId,
 *   and a stored session is reused/expired only when its metadata matches this company + invoice.
 * - Same money path as sendInvoice: createInvoiceCheckoutSession (Connect destination, 2% Service Fee as
 *   application fee, Flat pays none, identical PaymentIntent metadata), only forced to hosted mode.
 * - One payable session per invoice: an open hosted session is reused; an open embedded one is expired first; a
 *   completed one refuses (payment in flight). The webhook records by PaymentIntent id, so a payment records once.
 * - Concurrency: Stripe idempotency key per (invoice, previous session, balance, origin) + compare-and-set on
 *   invoices.stripe_payment_link_id; a loser expires its own session and returns the winner's.
 */
export async function createPublicHostedCheckout(
  token: string,
  requestOrigin: string | null = null
): Promise<PublicHostedCheckoutResponse> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.paymentToken, token), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  if (invoice.status === "paid") {
    throw stripeAppErrorConflict("Invoice is already paid");
  }

  if (!PAYABLE_STATUSES.has(invoice.status)) {
    throw stripeAppErrorConflict("Invoice is not payable");
  }

  const balanceDue = new Decimal(invoice.balanceDue ?? "0");
  if (balanceDue.lte(0)) {
    throw stripeAppErrorConflict("Invoice is already paid");
  }

  const companyId = invoice.companyId;
  const [companyRows, customerRows, items] = await Promise.all([
    db.select().from(companies).where(and(eq(companies.id, companyId), isNull(companies.deletedAt))).limit(1),
    db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, invoice.customerId), isNull(customers.deletedAt)))
      .limit(1),
    db
      .select()
      .from(invoiceItems)
      .where(and(eq(invoiceItems.companyId, companyId), eq(invoiceItems.invoiceId, invoice.id), isNull(invoiceItems.deletedAt)))
      .orderBy(asc(invoiceItems.sortOrder))
  ]);
  const company = companyRows[0];
  const customer = customerRows[0];

  if (!company || !customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  if (!company.stripeAccountId) {
    throw stripeAppErrorConflict("Invoice payment link is unavailable");
  }

  const previousSessionId = invoice.stripePaymentLinkId ?? null;
  if (previousSessionId) {
    const previous = await safeRetrieve(previousSessionId);
    if (previous && sessionBelongsToInvoice(previous, companyId, invoice.id)) {
      if (previous.status === "complete") {
        throw stripeAppErrorConflict("A payment for this invoice is already processing");
      }
      if (isOpenHosted(previous)) {
        return toResponse(previous, true);
      }
      if (previous.status === "open") {
        try {
          await expireInvoiceCheckoutSession(previous.id);
        } catch (error) {
          const recheck = await safeRetrieve(previous.id);
          if (recheck?.status === "complete") {
            throw stripeAppErrorConflict("A payment for this invoice is already processing");
          }
          if (recheck?.status !== "expired") {
            throw error;
          }
        }
      }
    }
  }

  // Partially paid: charge only the balance as one line (item totals would overstate it).
  const lineItems: InvoiceCheckoutLineItem[] = new Decimal(invoice.amountPaid ?? "0").gt(0)
    ? [{ name: `Invoice ${invoice.invoiceNumber} balance`, description: null, quantity: "1", total: balanceDue.toFixed(2) }]
    : items.map((item) => ({ name: item.name, description: item.description, quantity: item.quantity, total: item.total }));

  const originHash = createHash("sha256").update(requestOrigin ?? "").digest("hex").slice(0, 16);
  const created = await createInvoiceCheckoutSession({
    companyId,
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    customerEmail: customer.email,
    companyStripeAccountId: company.stripeAccountId,
    companyName: company.name,
    invoiceNumber: invoice.invoiceNumber,
    total: balanceDue.toFixed(2),
    paymentToken: token,
    renvaniPlan: readRenvaniSubscriptionPlan(company),
    items: lineItems,
    forceHosted: true,
    idempotencyKey: `invoice-hosted-checkout:${invoice.id}:${previousSessionId ?? "none"}:${balanceDue.toFixed(2)}:${originHash}`
  });

  if (!created.url) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Stripe did not return a hosted checkout URL");
  }

  const swapped = await db
    .update(invoices)
    .set({ stripePaymentLinkId: created.id, updatedAt: new Date() })
    .where(
      and(
        eq(invoices.companyId, companyId),
        eq(invoices.id, invoice.id),
        previousSessionId ? eq(invoices.stripePaymentLinkId, previousSessionId) : isNull(invoices.stripePaymentLinkId),
        isNull(invoices.deletedAt)
      )
    )
    .returning();

  if (swapped.length === 0) {
    // Lost a race. If the winner stored this same (idempotent) session, it's ours; otherwise expire ours.
    const [current] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoice.id), isNull(invoices.deletedAt)))
      .limit(1);
    if (current?.stripePaymentLinkId === created.id) {
      return toResponse({ url: created.url, expiresAt: null }, true);
    }
    await expireInvoiceCheckoutSession(created.id).catch((error: unknown) => {
      logger.warn({ err: error }, "Hosted checkout: could not expire race-losing session");
    });
    const winner = current?.stripePaymentLinkId ? await safeRetrieve(current.stripePaymentLinkId) : null;
    if (winner && sessionBelongsToInvoice(winner, companyId, invoice.id) && isOpenHosted(winner)) {
      return toResponse(winner, true);
    }
    throw stripeAppErrorConflict("Checkout changed while preparing; please retry");
  }

  const fresh = await safeRetrieve(created.id);
  return toResponse({ url: created.url, expiresAt: fresh?.expiresAt ?? null }, false);
}
