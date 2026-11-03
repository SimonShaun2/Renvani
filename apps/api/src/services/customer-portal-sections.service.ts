import { and, eq, isNull } from "drizzle-orm";

import {
  bookingSettings,
  invoices,
  jobs,
  maintenancePlans,
  properties,
  runTransactionWithTenantSession
} from "@fsm/db";
import { env } from "@fsm/config";
import {
  customerPortalHistorySectionSchema,
  customerPortalInvoicesSectionSchema,
  customerPortalMembershipsSectionSchema,
  customerPortalRebookSectionSchema
} from "@fsm/types";

import {
  getPortalSection,
  listPortalSectionKeys,
  registerPortalSection,
  type PortalSectionContext
} from "../lib/customer-portal-sections.registry.js";
import { resolveCustomerPortalSession } from "./customer-portal.service.js";

const MAX_ROWS = 100;
const OPEN_INVOICE_STATUSES = new Set(["sent", "viewed", "partially_paid", "overdue"]);
const PAST_JOB_STATUSES = new Set(["completed", "invoiced", "paid", "closed"]);

const iso = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);
const dateStr = (value: unknown): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
const toCents = (value: unknown): number => Math.round(Number(value ?? 0) * 100);

/** Explicit company AND customer scope on every query, plus a defensive in-memory re-check. */
const owned = <T extends { companyId: string; customerId: string }>(ctx: PortalSectionContext, rows: T[]) =>
  rows.filter((row) => row.companyId === ctx.companyId && row.customerId === ctx.customerId);

async function loadCustomerJobs(ctx: PortalSectionContext) {
  const rows = await ctx.tx
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, ctx.companyId), eq(jobs.customerId, ctx.customerId), isNull(jobs.deletedAt)));
  return owned(ctx, rows);
}

registerPortalSection({
  key: "history",
  schema: customerPortalHistorySectionSchema,
  load: async (ctx) => {
    const rows = (await loadCustomerJobs(ctx))
      .filter((row) => PAST_JOB_STATUSES.has(row.status))
      .sort((a, b) => (b.actualEnd ?? b.scheduledStart ?? b.createdAt).getTime() - (a.actualEnd ?? a.scheduledStart ?? a.createdAt).getTime())
      .slice(0, MAX_ROWS);
    return {
      entries: rows.map((row) => ({
        jobNumber: row.jobNumber,
        title: row.title,
        status: row.status,
        scheduledStart: iso(row.scheduledStart),
        completedAt: iso(row.actualEnd)
      }))
    };
  }
});

registerPortalSection({
  key: "invoices",
  schema: customerPortalInvoicesSectionSchema,
  load: async (ctx) => {
    const rows = owned(
      ctx,
      await ctx.tx
        .select()
        .from(invoices)
        .where(
          and(eq(invoices.companyId, ctx.companyId), eq(invoices.customerId, ctx.customerId), isNull(invoices.deletedAt))
        )
    )
      .filter((row) => OPEN_INVOICE_STATUSES.has(row.status) && toCents(row.balanceDue) > 0)
      .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))
      .slice(0, MAX_ROWS);
    const totalCents = rows.reduce((sum, row) => sum + toCents(row.balanceDue), 0);
    return {
      open: rows.map((row) => ({
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        total: String(row.total),
        balanceDue: String(row.balanceDue),
        dueAt: iso(row.dueAt),
        payUrl: row.paymentToken ? `${ctx.appBaseUrl}/pay/${encodeURIComponent(row.paymentToken)}` : null
      })),
      totalBalanceDue: (totalCents / 100).toFixed(2)
    };
  }
});

registerPortalSection({
  key: "memberships",
  schema: customerPortalMembershipsSectionSchema,
  load: async (ctx) => {
    const rows = owned(
      ctx,
      await ctx.tx
        .select()
        .from(maintenancePlans)
        .where(
          and(
            eq(maintenancePlans.companyId, ctx.companyId),
            eq(maintenancePlans.customerId, ctx.customerId),
            isNull(maintenancePlans.deletedAt)
          )
        )
    ).slice(0, MAX_ROWS);
    return {
      memberships: rows.map((row) => ({
        name: row.name,
        status: row.status,
        frequency: row.frequency,
        billingCycle: row.billingCycle ?? null,
        price: row.price == null ? null : String(row.price),
        includedServices: row.includedServices ?? [],
        startDate: dateStr(row.startDate) ?? "",
        endDate: dateStr(row.endDate),
        nextServiceDate: dateStr(row.nextServiceDate),
        // No agreement-portal manage link: that token embeds companyId:agreementId in plaintext.
        cancelAtPeriodEnd: Boolean(row.stripeCancelAtPeriodEnd)
      }))
    };
  }
});

registerPortalSection({
  key: "rebook",
  schema: customerPortalRebookSectionSchema,
  load: async (ctx) => {
    const [settings] = await ctx.tx
      .select()
      .from(bookingSettings)
      .where(and(eq(bookingSettings.companyId, ctx.companyId), isNull(bookingSettings.deletedAt)))
      .limit(1);
    const slug = settings && settings.companyId === ctx.companyId && settings.isEnabled ? settings.bookingSlug : null;

    const props = owned(
      ctx,
      await ctx.tx
        .select()
        .from(properties)
        .where(
          and(eq(properties.companyId, ctx.companyId), eq(properties.customerId, ctx.customerId), isNull(properties.deletedAt))
        )
    );
    const property = props.find((p) => p.isPrimary) ?? props[0];

    const lastJob = (await loadCustomerJobs(ctx))
      .filter((row) => PAST_JOB_STATUSES.has(row.status))
      .sort((a, b) => (b.actualEnd ?? b.createdAt).getTime() - (a.actualEnd ?? a.createdAt).getTime())[0];

    const bookingUrl = slug ? `${ctx.appBaseUrl}/book/${encodeURIComponent(slug)}?src=portal_rebook` : null;
    return {
      available: bookingUrl !== null,
      bookingUrl,
      prefill: {
        firstName: ctx.customer.firstName,
        lastName: ctx.customer.lastName,
        email: ctx.customer.email,
        phone: ctx.customer.phone,
        zip: property?.zip ?? null,
        lastServiceTitle: lastJob?.title ?? null
      }
    };
  }
});

/** Resolve the portal token (shared FS-168 verification), then load one section tenant-scoped. */
export async function loadCustomerPortalSection(token: string, key: string, now: Date = new Date()) {
  // Verify the token before looking up the key so unauthenticated probes learn nothing.
  const { claims, customer } = await resolveCustomerPortalSession(token);
  const section = getPortalSection(key);
  const data = await runTransactionWithTenantSession(claims.companyId, (tx) =>
    section.load({
      companyId: claims.companyId,
      customerId: claims.customerId,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email ?? null,
        phone: customer.phone ?? null
      },
      tx,
      appBaseUrl: env.APP_URL.replace(/\/$/, ""),
      now
    })
  );
  return { key, data: section.schema.parse(data) };
}

export async function listCustomerPortalSections(token: string) {
  await resolveCustomerPortalSession(token);
  return listPortalSectionKeys();
}
