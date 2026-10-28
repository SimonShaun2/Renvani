import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { customers, db, invoices, jobs } from "@fsm/db";
import {
  type DirectDemandSourceSummary,
  type DirectDemandSummary,
  type JobGrowthChannel,
  type JobSourceChannelSummary,
  type JobSourceReportingQuery,
  type JobSourceReportingSummary,
  type JobStatus,
  leadAttributionSourceKey,
  sanitizeLeadAttribution
} from "@fsm/types";

import { assertJobSourceReportingPeriodAllowed, resolveReportingPeriod } from "../lib/reporting-period.js";

type JobRow = typeof jobs.$inferSelect;
type CustomerRow = Pick<typeof customers.$inferSelect, "id" | "leadSource" | "referredBy">;

export const JOB_ACTIVITY_TIMESTAMP = sql`COALESCE(${jobs.scheduledStart}, ${jobs.createdAt})`;

/** Postgres `postgres` driver rejects Date binds beside SQL expressions — use ISO strings. */
function jobActivityOnOrAfter(instant: Date) {
  return gte(JOB_ACTIVITY_TIMESTAMP, instant.toISOString());
}

function jobActivityOnOrBefore(instant: Date) {
  return lte(JOB_ACTIVITY_TIMESTAMP, instant.toISOString());
}

function jobActivityBefore(instant: Date) {
  return lt(JOB_ACTIVITY_TIMESTAMP, instant.toISOString());
}

export const UNKNOWN_ATTRIBUTION_DEFINITION =
  "Booked jobs in the period with no job.leadSource, no customer.leadSource, and no customer.referredBy (importSessionId does not count as unknown).";

export const MAX_JOB_IDS_PER_CHANNEL = 25;

const BOOKED_JOB_STATUS_LIST: JobStatus[] = [
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid"
];

const PRIOR_JOB_STATUS_LIST: JobStatus[] = [
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "closed"
];

const CHANNEL_ORDER: JobGrowthChannel[] = [
  "own_website",
  "booking",
  "referrals",
  "repeat_customers",
  "imported_or_other"
];

const CHANNEL_LABELS: Record<JobGrowthChannel, string> = {
  own_website: "Own website",
  booking: "Online booking",
  referrals: "Referrals",
  repeat_customers: "Repeat customers",
  imported_or_other: "Imported or other"
};

const BOOKING_LEAD_SOURCES = new Set([
  "google",
  "facebook",
  "instagram",
  "yelp",
  "qr_code",
  "booking",
  "online_booking",
  "online"
]);

const OWN_WEBSITE_LEAD_SOURCES = new Set([
  "website",
  "direct",
  "direct_web",
  "gbp",
  "branded_site",
  "web_form"
]);

const REFERRAL_LEAD_SOURCES = new Set(["referral", "referred", "word_of_mouth"]);

function normalizeLeadSource(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getJobRevenue(job: JobRow): Decimal {
  const paid = new Decimal(job.amountPaid ?? "0");
  if (paid.gt(0)) {
    return paid;
  }

  const invoiced = new Decimal(job.invoiceTotal ?? "0");
  if (invoiced.gt(0)) {
    return invoiced;
  }

  return new Decimal(job.estimateTotal ?? "0");
}

function formatMoney(amount: Decimal): string {
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function classifyJobGrowthChannel(input: {
  job: Pick<JobRow, "leadSource" | "importSessionId" | "customerId" | "createdAt" | "status">;
  customer: Pick<CustomerRow, "referredBy" | "leadSource"> | null;
  hasPriorBookedJob: boolean;
}): JobGrowthChannel {
  if (input.job.importSessionId) {
    return "imported_or_other";
  }

  if (input.hasPriorBookedJob) {
    return "repeat_customers";
  }

  const leadSource =
    normalizeLeadSource(input.job.leadSource) ?? normalizeLeadSource(input.customer?.leadSource);

  if (leadSource && REFERRAL_LEAD_SOURCES.has(leadSource)) {
    return "referrals";
  }

  if (input.customer?.referredBy) {
    return "referrals";
  }

  if (leadSource && BOOKING_LEAD_SOURCES.has(leadSource)) {
    return "booking";
  }

  if (leadSource && OWN_WEBSITE_LEAD_SOURCES.has(leadSource)) {
    return "own_website";
  }

  if (leadSource?.includes("booking")) {
    return "booking";
  }

  if (leadSource?.includes("refer")) {
    return "referrals";
  }

  return "imported_or_other";
}

function isUnknownAttribution(
  job: Pick<JobRow, "leadSource" | "importSessionId">,
  customer: CustomerRow | null
): boolean {
  if (job.importSessionId) {
    return false;
  }

  const jobSource = normalizeLeadSource(job.leadSource);
  const customerSource = normalizeLeadSource(customer?.leadSource);

  return !jobSource && !customerSource && !customer?.referredBy;
}

function buildEmptySummary(
  period: ReturnType<typeof resolveReportingPeriod>,
  includeJobIds: boolean
): JobSourceReportingSummary {
  const channels: JobSourceChannelSummary[] = CHANNEL_ORDER.map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel],
    bookedJobCount: 0,
    revenue: "0.00",
    shareOfBookedJobs: 0,
    ...(includeJobIds ? { jobIds: [], jobIdsTruncated: false } : {})
  }));

  return {
    period: {
      startDate: period.start.toISOString(),
      endDate: period.end.toISOString(),
      timeZone: period.timeZone,
      dateInterpretation: period.dateInterpretation
    },
    totals: {
      bookedJobCount: 0,
      revenue: "0.00",
      unknownAttributionCount: 0,
      unknownAttributionDefinition: UNKNOWN_ATTRIBUTION_DEFINITION
    },
    channels
  };
}

export async function getJobSourceReportingSummary(
  companyId: string,
  timeZone: string,
  query: JobSourceReportingQuery
): Promise<JobSourceReportingSummary> {
  const period = resolveReportingPeriod(query.startDate, query.endDate, timeZone);
  const includeJobIds = query.includeJobIds === true;

  assertJobSourceReportingPeriodAllowed(period);

  const periodJobRows = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        isNull(jobs.deletedAt),
        inArray(jobs.status, BOOKED_JOB_STATUS_LIST),
        jobActivityOnOrAfter(period.start),
        jobActivityOnOrBefore(period.end)
      )
    );

  if (periodJobRows.length === 0) {
    return buildEmptySummary(period, includeJobIds);
  }

  const priorCustomerRows = await db
    .select({ customerId: jobs.customerId })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        isNull(jobs.deletedAt),
        inArray(jobs.status, PRIOR_JOB_STATUS_LIST),
        jobActivityBefore(period.start)
      )
    );

  const priorCustomerIds = new Set(priorCustomerRows.map((row) => row.customerId));

  const customerIds = [...new Set(periodJobRows.map((job) => job.customerId))];

  const customerRows = await db
    .select({
      id: customers.id,
      leadSource: customers.leadSource,
      referredBy: customers.referredBy
    })
    .from(customers)
    .where(
      and(
        eq(customers.companyId, companyId),
        isNull(customers.deletedAt),
        inArray(customers.id, customerIds)
      )
    );

  const customerById = new Map(customerRows.map((customer) => [customer.id, customer]));

  const bookedJobsByCustomer = new Map<string, JobRow[]>();

  for (const job of periodJobRows) {
    const existing = bookedJobsByCustomer.get(job.customerId) ?? [];
    existing.push(job);
    bookedJobsByCustomer.set(job.customerId, existing);
  }

  for (const customerJobs of bookedJobsByCustomer.values()) {
    customerJobs.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  const channelBuckets = new Map<
    JobGrowthChannel,
    { count: number; revenue: Decimal; jobIds: string[] }
  >(CHANNEL_ORDER.map((channel) => [channel, { count: 0, revenue: new Decimal(0), jobIds: [] }]));

  let bookedJobCount = 0;
  let totalRevenue = new Decimal(0);
  let unknownAttributionCount = 0;

  for (const job of periodJobRows) {
    const customer = customerById.get(job.customerId) ?? null;
    const customerJobs = bookedJobsByCustomer.get(job.customerId) ?? [];
    const jobIndex = customerJobs.findIndex((candidate) => candidate.id === job.id);
    const hasPriorBookedJob = priorCustomerIds.has(job.customerId) || jobIndex > 0;

    const channel = classifyJobGrowthChannel({
      job,
      customer,
      hasPriorBookedJob
    });

    const revenue = getJobRevenue(job);
    const bucket = channelBuckets.get(channel);

    if (!bucket) {
      continue;
    }

    bucket.count += 1;
    bucket.revenue = bucket.revenue.plus(revenue);
    bucket.jobIds.push(job.id);

    bookedJobCount += 1;
    totalRevenue = totalRevenue.plus(revenue);

    if (isUnknownAttribution(job, customer)) {
      unknownAttributionCount += 1;
    }
  }

  const channels: JobSourceChannelSummary[] = CHANNEL_ORDER.map((channel) => {
    const bucket = channelBuckets.get(channel) ?? { count: 0, revenue: new Decimal(0), jobIds: [] };
    const shareOfBookedJobs =
      bookedJobCount > 0 ? Math.round((bucket.count / bookedJobCount) * 10_000) / 100 : 0;

    const jobIdsTruncated = bucket.jobIds.length > MAX_JOB_IDS_PER_CHANNEL;
    const visibleJobIds = includeJobIds ? bucket.jobIds.slice(0, MAX_JOB_IDS_PER_CHANNEL) : undefined;

    return {
      channel,
      label: CHANNEL_LABELS[channel],
      bookedJobCount: bucket.count,
      revenue: formatMoney(bucket.revenue),
      shareOfBookedJobs,
      ...(includeJobIds
        ? {
            jobIds: visibleJobIds ?? [],
            jobIdsTruncated
          }
        : {})
    };
  });

  return {
    period: {
      startDate: period.start.toISOString(),
      endDate: period.end.toISOString(),
      timeZone: period.timeZone,
      dateInterpretation: period.dateInterpretation
    },
    totals: {
      bookedJobCount,
      revenue: formatMoney(totalRevenue),
      unknownAttributionCount,
      unknownAttributionDefinition: UNKNOWN_ATTRIBUTION_DEFINITION
    },
    channels
  };
}

/**
 * Growth (source tracking) "Direct demand": booked jobs in the period that carry captured lead attribution,
 * grouped by attribution source (utm_source, else referrer host), with paid invoice revenue via invoices.job_id.
 * Surfaced as a Command Center card.
 */
export async function getDirectDemandSummary(
  companyId: string,
  timeZone: string,
  query: Pick<JobSourceReportingQuery, "startDate" | "endDate">
): Promise<DirectDemandSummary> {
  const period = resolveReportingPeriod(query.startDate, query.endDate, timeZone);
  assertJobSourceReportingPeriodAllowed(period);

  const periodJobRows = await db
    .select({ id: jobs.id, leadAttribution: jobs.leadAttribution })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        isNull(jobs.deletedAt),
        inArray(jobs.status, BOOKED_JOB_STATUS_LIST),
        jobActivityOnOrAfter(period.start),
        jobActivityOnOrBefore(period.end)
      )
    );

  const sourceByJobId = new Map<string, string>();
  for (const job of periodJobRows) {
    // Re-sanitize on read: never trust stored jsonb shape.
    const attribution = sanitizeLeadAttribution(job.leadAttribution);
    if (attribution) {
      sourceByJobId.set(job.id, leadAttributionSourceKey(attribution));
    }
  }

  const buckets = new Map<string, { jobCount: number; paidRevenue: Decimal }>();
  for (const source of sourceByJobId.values()) {
    const bucket = buckets.get(source) ?? { jobCount: 0, paidRevenue: new Decimal(0) };
    bucket.jobCount += 1;
    buckets.set(source, bucket);
  }

  if (sourceByJobId.size > 0) {
    const paidInvoiceRows = await db
      .select({ jobId: invoices.jobId, total: invoices.total })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          isNull(invoices.deletedAt),
          eq(invoices.status, "paid"),
          inArray(invoices.jobId, [...sourceByJobId.keys()])
        )
      );

    for (const invoice of paidInvoiceRows) {
      const source = invoice.jobId ? sourceByJobId.get(invoice.jobId) : undefined;
      const bucket = source ? buckets.get(source) : undefined;
      if (bucket) {
        bucket.paidRevenue = bucket.paidRevenue.plus(new Decimal(invoice.total ?? "0"));
      }
    }
  }

  const sources: DirectDemandSourceSummary[] = [...buckets.entries()]
    .map(([source, bucket]) => ({ source, jobCount: bucket.jobCount, paidRevenue: formatMoney(bucket.paidRevenue) }))
    .sort((left, right) => right.jobCount - left.jobCount || left.source.localeCompare(right.source));

  const totalPaid = [...buckets.values()].reduce((sum, bucket) => sum.plus(bucket.paidRevenue), new Decimal(0));

  return {
    period: { startDate: period.start.toISOString(), endDate: period.end.toISOString(), timeZone: period.timeZone },
    totals: { jobCount: sourceByJobId.size, paidRevenue: formatMoney(totalPaid) },
    sources
  };
}
