import { and, eq, isNull } from "drizzle-orm";

import { companies, customers, db, estimates, invoices, jobs } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type CustomerPortalAccount,
  type CustomerPortalEstimate,
  type CustomerPortalInvoice,
  type CustomerPortalLink,
  type CustomerPortalVisit,
  type CustomerPortalVisits
} from "@fsm/types";
import { env } from "@fsm/config";

import {
  generateCustomerPortalToken,
  verifyCustomerPortalToken,
  type CustomerPortalTokenPayload
} from "../lib/customer-portal-token.js";

const MAX_ROWS = 100;
const HIDDEN_ESTIMATE_STATUSES = new Set(["draft", "revised"]);
const HIDDEN_INVOICE_STATUSES = new Set(["draft", "void"]);
const PAST_JOB_STATUSES = new Set(["completed", "invoiced", "paid", "cancelled", "closed"]);

const iso = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);

async function loadScopedCustomer(claims: CustomerPortalTokenPayload) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.companyId, claims.companyId), eq(customers.id, claims.customerId), isNull(customers.deletedAt))
    )
    .limit(1);

  // Fail closed: an otherwise-valid token for a deleted or foreign customer is treated as invalid.
  if (!customer) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired portal link");
  }
  return customer;
}

/** Shared portal token verification + fail-closed customer lookup (also used by portal sections). */
export async function resolveCustomerPortalSession(token: string) {
  const claims = verifyCustomerPortalToken(token);
  const customer = await loadScopedCustomer(claims);
  return { claims, customer };
}

/**
 * Staff-issued magic link. The token is in the URL fragment so it is never sent to servers;
 * the portal frontend reads it and sends it as the x-customer-portal-token header.
 * 404 when the customer is not in this company.
 */
export async function issueCustomerPortalLink(companyId: string, customerId: string): Promise<CustomerPortalLink> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);
  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  const { token, expiresAt } = generateCustomerPortalToken({ companyId, customerId });
  const base = env.APP_URL.replace(/\/$/, "");
  return { token, url: `${base}/portal#token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
}

export async function getCustomerPortalAccount(token: string): Promise<CustomerPortalAccount> {
  const { claims, customer } = await resolveCustomerPortalSession(token);
  const [company] = await db.select().from(companies).where(eq(companies.id, claims.companyId)).limit(1);

  return {
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      displayName: customer.displayName ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null
    },
    company: { name: company?.name ?? "" }
  };
}

export async function listCustomerPortalVisits(token: string, now: Date = new Date()): Promise<CustomerPortalVisits> {
  const { claims } = await resolveCustomerPortalSession(token);
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, claims.companyId), eq(jobs.customerId, claims.customerId), isNull(jobs.deletedAt)));

  const visits = rows
    .filter((row) => row.companyId === claims.companyId && row.customerId === claims.customerId)
    .map(
      (row): CustomerPortalVisit => ({
        id: row.id,
        jobNumber: row.jobNumber,
        title: row.title,
        status: row.status,
        scheduledStart: iso(row.scheduledStart),
        scheduledEnd: iso(row.scheduledEnd),
        completedAt: iso(row.actualEnd)
      })
    );

  const isUpcoming = (v: CustomerPortalVisit) =>
    !PAST_JOB_STATUSES.has(v.status) && v.scheduledStart !== null && new Date(v.scheduledStart) >= now;
  const byStart = (a: CustomerPortalVisit, b: CustomerPortalVisit) =>
    (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? "");

  return {
    upcoming: visits.filter(isUpcoming).sort(byStart).slice(0, MAX_ROWS),
    past: visits
      .filter((v) => !isUpcoming(v))
      .sort((a, b) => byStart(b, a))
      .slice(0, MAX_ROWS)
  };
}

export async function listCustomerPortalEstimates(token: string): Promise<CustomerPortalEstimate[]> {
  const { claims } = await resolveCustomerPortalSession(token);
  const rows = await db
    .select()
    .from(estimates)
    .where(
      and(eq(estimates.companyId, claims.companyId), eq(estimates.customerId, claims.customerId), isNull(estimates.deletedAt))
    );

  return rows
    .filter((row) => row.companyId === claims.companyId && row.customerId === claims.customerId)
    .filter((row) => !HIDDEN_ESTIMATE_STATUSES.has(row.status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_ROWS)
    .map((row) => ({
      id: row.id,
      estimateNumber: row.estimateNumber,
      title: row.title ?? null,
      status: row.status,
      total: String(row.total),
      createdAt: row.createdAt.toISOString(),
      approvalToken: row.approvalToken ?? null
    }));
}

export async function listCustomerPortalInvoices(token: string): Promise<CustomerPortalInvoice[]> {
  const { claims } = await resolveCustomerPortalSession(token);
  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.companyId, claims.companyId), eq(invoices.customerId, claims.customerId), isNull(invoices.deletedAt))
    );

  return rows
    .filter((row) => row.companyId === claims.companyId && row.customerId === claims.customerId)
    .filter((row) => !HIDDEN_INVOICE_STATUSES.has(row.status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_ROWS)
    .map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      total: String(row.total),
      amountPaid: String(row.amountPaid ?? "0"),
      balanceDue: String(row.balanceDue),
      issuedAt: iso(row.issuedAt),
      dueAt: iso(row.dueAt),
      paidAt: iso(row.paidAt),
      paymentToken: row.paymentToken ?? null
    }));
}
