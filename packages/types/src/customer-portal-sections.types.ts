import { z } from "zod";

/**
 * Customer portal sections (history, open invoices, memberships, rebook).
 * Explicit allowlist schemas: every object is `.strict()` and section loaders are parsed through
 * these before leaving the API, so internal ids, notes, cost/margin and tech notes can never leak.
 * References use customer-facing numbers (jobNumber / invoiceNumber), not database UUIDs.
 */

const isoOrNull = z.string().nullable();

export const customerPortalHistoryEntrySchema = z
  .object({
    jobNumber: z.string(),
    title: z.string(),
    status: z.string(),
    scheduledStart: isoOrNull,
    completedAt: isoOrNull
  })
  .strict();

export const customerPortalHistorySectionSchema = z
  .object({ entries: z.array(customerPortalHistoryEntrySchema) })
  .strict();

export const customerPortalOpenInvoiceSchema = z
  .object({
    invoiceNumber: z.string(),
    status: z.string(),
    total: z.string(),
    balanceDue: z.string(),
    dueAt: isoOrNull,
    /** Reuses the existing public pay-by-token page (/pay/:token). */
    payUrl: z.string().nullable()
  })
  .strict();

export const customerPortalInvoicesSectionSchema = z
  .object({ open: z.array(customerPortalOpenInvoiceSchema), totalBalanceDue: z.string() })
  .strict();

export const customerPortalMembershipSchema = z
  .object({
    name: z.string(),
    status: z.string(),
    frequency: z.string(),
    billingCycle: z.string().nullable(),
    price: z.string().nullable(),
    includedServices: z.array(z.string()),
    startDate: z.string(),
    endDate: z.string().nullable(),
    nextServiceDate: z.string().nullable(),
    cancelAtPeriodEnd: z.boolean()
  })
  .strict();

export const customerPortalMembershipsSectionSchema = z
  .object({ memberships: z.array(customerPortalMembershipSchema) })
  .strict();

export const customerPortalRebookSectionSchema = z
  .object({
    available: z.boolean(),
    /** Existing public booking flow (/book/:slug), tagged src=portal_rebook. Null when booking is disabled. */
    bookingUrl: z.string().nullable(),
    prefill: z
      .object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        zip: z.string().nullable(),
        lastServiceTitle: z.string().nullable()
      })
      .strict()
  })
  .strict();

export const customerPortalSectionEnvelopeSchema = z
  .object({ key: z.string(), data: z.unknown() })
  .strict();

export type CustomerPortalHistorySection = z.infer<typeof customerPortalHistorySectionSchema>;
export type CustomerPortalInvoicesSection = z.infer<typeof customerPortalInvoicesSectionSchema>;
export type CustomerPortalMembership = z.infer<typeof customerPortalMembershipSchema>;
export type CustomerPortalMembershipsSection = z.infer<typeof customerPortalMembershipsSectionSchema>;
export type CustomerPortalRebookSection = z.infer<typeof customerPortalRebookSectionSchema>;
