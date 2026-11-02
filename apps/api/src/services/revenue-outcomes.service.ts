import { and, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  activityEvents,
  agentActions,
  bookingRequests,
  customers,
  db,
  estimates,
  jobProducts,
  jobs,
  productCatalog
} from "@fsm/db";
import {
  REVENUE_ASSISTANCE_SEGMENT_REGISTRY,
  REVENUE_CUSTOMER_SEGMENT_REGISTRY,
  REVENUE_FUNNEL_STAGE_REGISTRY,
  type JobStatus,
  type RevenueOutcomeRegistryEntry,
  type RevenueOutcomeSegment,
  type RevenueOutcomesQuery,
  type RevenueOutcomesSummary
} from "@fsm/types";

import { assertJobSourceReportingPeriodAllowed, resolveReportingPeriod } from "../lib/reporting-period.js";
import { UNKNOWN_ATTRIBUTION_DEFINITION } from "./job-source-reporting.service.js";

/**
 * FS-22 revenue outcome instrumentation. Every query is tenant-scoped (companyId + RLS session),
 * read-only and bounded by the validated reporting period (max 366 days) or by id lists derived from it.
 */

const JOB_ACTIVITY_TIMESTAMP = sql`COALESCE(${jobs.scheduledStart}, ${jobs.createdAt})`;

const CONFIRMED_JOB_STATUSES: JobStatus[] = [
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
const COMPLETED_JOB_STATUSES = new Set<string>(["completed", "invoiced", "paid", "closed"]);

/** Agent action state -> guardrail bucket. Extend by adding entries. */
const AGENT_STATE_BUCKETS: Record<string, "accepted" | "rejected" | "escalated" | "failed"> = {
  approved: "accepted",
  executing: "accepted",
  succeeded: "accepted",
  cancelled: "rejected",
  reversed: "rejected",
  escalated: "escalated",
  failed: "failed"
};

const QUALIFIED_EVENT_TYPE = "revenue.inquiry_qualified";
const EDITED_EVENT_TYPE = "agent.proposal_edited";

type JobRow = {
  id: string;
  customerId: string;
  status: string;
  leadSource: string | null;
  importSessionId: string | null;
  estimateTotal: string | null;
  invoiceTotal: string | null;
  amountPaid: string | null;
  scheduledStart: Date | null;
  createdAt: Date;
};

function activityTime(job: JobRow): number {
  return (job.scheduledStart ?? job.createdAt).getTime();
}

function jobRevenue(job: JobRow): Decimal {
  const paid = new Decimal(job.amountPaid ?? "0");
  if (paid.gt(0)) return paid;
  const invoiced = new Decimal(job.invoiceTotal ?? "0");
  if (invoiced.gt(0)) return invoiced;
  return new Decimal(job.estimateTotal ?? "0");
}

function money(amount: Decimal): string {
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return new Decimal(numerator).div(denominator).mul(100).toDecimalPlaces(2).toNumber();
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function readTarget(target: unknown): { entityType: string | null; entityId: string | null } {
  if (!target || typeof target !== "object") return { entityType: null, entityId: null };
  const record = target as Record<string, unknown>;
  return {
    entityType: typeof record.entityType === "string" ? record.entityType : null,
    entityId: typeof record.entityId === "string" ? record.entityId : null
  };
}

function inPeriod(column: Parameters<typeof gte>[0], start: Date, end: Date) {
  return and(gte(column, start), lte(column, end));
}

type SegmentAccumulator = { confirmedJobs: number; completedJobs: number; completedRevenue: Decimal };

function emptyAccumulator(): SegmentAccumulator {
  return { confirmedJobs: 0, completedJobs: 0, completedRevenue: new Decimal(0) };
}

function toSegments(
  registry: readonly RevenueOutcomeRegistryEntry[],
  buckets: Map<string, SegmentAccumulator>
): RevenueOutcomeSegment[] {
  return registry.map((entry) => {
    const bucket = buckets.get(entry.key) ?? emptyAccumulator();
    return {
      segment: entry.key,
      label: entry.label,
      confirmedJobs: bucket.confirmedJobs,
      completedJobs: bucket.completedJobs,
      completedRevenue: money(bucket.completedRevenue)
    };
  });
}

export const REVENUE_OUTCOME_DEFINITIONS: RevenueOutcomeRegistryEntry[] = [
  ...REVENUE_FUNNEL_STAGE_REGISTRY,
  ...REVENUE_CUSTOMER_SEGMENT_REGISTRY.map((entry) => ({ ...entry, key: `customer_${entry.key}` })),
  ...REVENUE_ASSISTANCE_SEGMENT_REGISTRY.map((entry) => ({ ...entry, key: `assistance_${entry.key}` })),
  {
    key: "completed_revenue",
    label: "Completed revenue",
    definition: "Per completed job: amount paid, else invoice total, else estimate total."
  },
  {
    key: "contribution_profit",
    label: "Contribution profit",
    definition:
      "Completed revenue minus material cost (job products quantity x catalog cost). Labor and overhead are not included."
  },
  {
    key: "guardrails",
    label: "Agent guardrails",
    definition:
      "Agent proposals created in the period by state: accepted (approved/executing/succeeded), rejected (cancelled/reversed), escalated, failed; edited = agent.proposal_edited events. Override rate = (rejected + edited) / decided; error rate = failed / decided."
  },
  { key: "unknown_source", label: "Unknown source", definition: UNKNOWN_ATTRIBUTION_DEFINITION },
  {
    key: "cohort_caveat",
    label: "Cohort caveat",
    definition:
      "Counts are period activity, not validated cohorts; they do not by themselves demonstrate marketing or agent lift."
  }
];

export async function getRevenueOutcomesSummary(
  companyId: string,
  timeZone: string,
  query: RevenueOutcomesQuery
): Promise<RevenueOutcomesSummary> {
  const period = resolveReportingPeriod(query.startDate, query.endDate, timeZone);
  assertJobSourceReportingPeriodAllowed(period);
  const { start, end } = period;

  const [inquiryRows, qualifiedEventRows, estimateRows, agentRows, editedRows, jobRows] = await Promise.all([
    db
      .select({ id: bookingRequests.id, createdAt: bookingRequests.createdAt, confirmedAt: bookingRequests.confirmedAt })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.companyId, companyId),
          isNull(bookingRequests.deletedAt),
          or(inPeriod(bookingRequests.createdAt, start, end), inPeriod(bookingRequests.confirmedAt, start, end))
        )
      ),
    db
      .select({ entityId: activityEvents.entityId })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.companyId, companyId),
          eq(activityEvents.eventType, QUALIFIED_EVENT_TYPE),
          inPeriod(activityEvents.occurredAt, start, end)
        )
      ),
    db
      .select({ id: estimates.id, sentAt: estimates.sentAt, approvedAt: estimates.approvedAt })
      .from(estimates)
      .where(
        and(
          eq(estimates.companyId, companyId),
          isNull(estimates.deletedAt),
          or(inPeriod(estimates.sentAt, start, end), inPeriod(estimates.approvedAt, start, end))
        )
      ),
    db
      .select({ id: agentActions.id, state: agentActions.state, target: agentActions.target })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.companyId, companyId),
          isNull(agentActions.deletedAt),
          inPeriod(agentActions.createdAt, start, end)
        )
      ),
    db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.companyId, companyId),
          eq(activityEvents.eventType, EDITED_EVENT_TYPE),
          inPeriod(activityEvents.occurredAt, start, end)
        )
      ),
    db
      .select({
        id: jobs.id,
        customerId: jobs.customerId,
        status: jobs.status,
        leadSource: jobs.leadSource,
        importSessionId: jobs.importSessionId,
        estimateTotal: jobs.estimateTotal,
        invoiceTotal: jobs.invoiceTotal,
        amountPaid: jobs.amountPaid,
        scheduledStart: jobs.scheduledStart,
        createdAt: jobs.createdAt
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          isNull(jobs.deletedAt),
          inArray(jobs.status, CONFIRMED_JOB_STATUSES),
          gte(JOB_ACTIVITY_TIMESTAMP, start.toISOString()),
          lte(JOB_ACTIVITY_TIMESTAMP, end.toISOString())
        )
      )
  ]);

  const within = (value: Date | null | undefined) =>
    value instanceof Date && value.getTime() >= start.getTime() && value.getTime() <= end.getTime();

  const inquiries = inquiryRows.filter((row) => within(row.createdAt)).length;
  const qualifiedIds = new Set<string>();
  for (const row of qualifiedEventRows) if (row.entityId) qualifiedIds.add(row.entityId);
  for (const row of inquiryRows) if (within(row.confirmedAt)) qualifiedIds.add(row.id);
  const estimatesSent = estimateRows.filter((row) => within(row.sentAt)).length;
  const estimatesApproved = estimateRows.filter((row) => within(row.approvedAt)).length;

  // Guardrails.
  const guardrailCounts = { accepted: 0, rejected: 0, escalated: 0, failed: 0 };
  const assistedTargets = new Set<string>();
  for (const row of agentRows) {
    const bucket = AGENT_STATE_BUCKETS[row.state];
    if (bucket) guardrailCounts[bucket] += 1;
    if (bucket === "accepted") {
      const target = readTarget(row.target);
      if (target.entityId) assistedTargets.add(`${target.entityType ?? ""}:${target.entityId}`);
    }
  }
  const edited = editedRows.length;
  const decided =
    guardrailCounts.accepted + guardrailCounts.rejected + guardrailCounts.escalated + guardrailCounts.failed;

  const typedJobs = jobRows as JobRow[];
  const jobIds = typedJobs.map((job) => job.id);
  const customerIds = [...new Set(typedJobs.map((job) => job.customerId))];

  const [priorRows, customerRows, bookingLinkRows] =
    jobIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          db
            .select({ customerId: jobs.customerId })
            .from(jobs)
            .where(
              and(
                eq(jobs.companyId, companyId),
                isNull(jobs.deletedAt),
                inArray(jobs.customerId, customerIds),
                inArray(jobs.status, CONFIRMED_JOB_STATUSES),
                lt(JOB_ACTIVITY_TIMESTAMP, start.toISOString())
              )
            ),
          db
            .select({ id: customers.id, leadSource: customers.leadSource, referredBy: customers.referredBy })
            .from(customers)
            .where(and(eq(customers.companyId, companyId), inArray(customers.id, customerIds))),
          db
            .select({ id: bookingRequests.id, jobId: bookingRequests.jobId })
            .from(bookingRequests)
            .where(and(eq(bookingRequests.companyId, companyId), inArray(bookingRequests.jobId, jobIds)))
        ]);

  const priorCustomers = new Set(priorRows.map((row) => row.customerId));
  const customerById = new Map(customerRows.map((row) => [row.id, row]));
  const bookingIdsByJob = new Map<string, string[]>();
  for (const row of bookingLinkRows) {
    if (!row.jobId) continue;
    bookingIdsByJob.set(row.jobId, [...(bookingIdsByJob.get(row.jobId) ?? []), row.id]);
  }

  const firstJobIdByCustomer = new Map<string, JobRow>();
  for (const job of typedJobs) {
    const current = firstJobIdByCustomer.get(job.customerId);
    if (!current || activityTime(job) < activityTime(current)) {
      firstJobIdByCustomer.set(job.customerId, job);
    }
  }

  const customerBuckets = new Map<string, SegmentAccumulator>();
  const assistanceBuckets = new Map<string, SegmentAccumulator>();
  let completedRevenue = new Decimal(0);
  let repeatJobs = 0;
  let completedJobs = 0;
  let unknownSourceJobCount = 0;
  const completedJobIds: string[] = [];

  for (const job of typedJobs) {
    const isRepeat = priorCustomers.has(job.customerId) || firstJobIdByCustomer.get(job.customerId)?.id !== job.id;
    const isAssisted =
      assistedTargets.has(`job:${job.id}`) ||
      (bookingIdsByJob.get(job.id) ?? []).some((id) => assistedTargets.has(`booking_request:${id}`));
    const isCompleted = COMPLETED_JOB_STATUSES.has(job.status);
    const revenue = isCompleted ? jobRevenue(job) : new Decimal(0);

    if (isRepeat) repeatJobs += 1;
    if (isCompleted) {
      completedJobs += 1;
      completedRevenue = completedRevenue.plus(revenue);
      completedJobIds.push(job.id);
    }

    for (const [buckets, key] of [
      [customerBuckets, isRepeat ? "repeat" : "new"],
      [assistanceBuckets, isAssisted ? "agent_assisted" : "manual"]
    ] as const) {
      const bucket = buckets.get(key) ?? emptyAccumulator();
      bucket.confirmedJobs += 1;
      if (isCompleted) {
        bucket.completedJobs += 1;
        bucket.completedRevenue = bucket.completedRevenue.plus(revenue);
      }
      buckets.set(key, bucket);
    }

    const customer = customerById.get(job.customerId);
    if (!job.importSessionId && !normalize(job.leadSource) && !normalize(customer?.leadSource) && !customer?.referredBy) {
      unknownSourceJobCount += 1;
    }
  }

  // Material cost for completed jobs (bounded by completed job ids).
  let materialCost = new Decimal(0);
  const incompleteCostJobs = new Set<string>();
  if (completedJobIds.length > 0) {
    const productRows = await db
      .select({
        jobId: jobProducts.jobId,
        productCatalogId: jobProducts.productCatalogId,
        quantity: jobProducts.quantity
      })
      .from(jobProducts)
      .where(
        and(
          eq(jobProducts.companyId, companyId),
          isNull(jobProducts.deletedAt),
          inArray(jobProducts.jobId, completedJobIds)
        )
      );
    const catalogIds = [
      ...new Set(productRows.map((row) => row.productCatalogId).filter((id): id is string => Boolean(id)))
    ];
    const catalogRows =
      catalogIds.length === 0
        ? []
        : await db
            .select({ id: productCatalog.id, cost: productCatalog.cost })
            .from(productCatalog)
            .where(and(eq(productCatalog.companyId, companyId), inArray(productCatalog.id, catalogIds)));
    const costById = new Map(catalogRows.map((row) => [row.id, row.cost]));
    for (const row of productRows) {
      const cost = row.productCatalogId ? costById.get(row.productCatalogId) : null;
      if (cost === null || cost === undefined) {
        incompleteCostJobs.add(row.jobId);
        continue;
      }
      materialCost = materialCost.plus(new Decimal(cost).mul(new Decimal(row.quantity ?? "1")));
    }
  }

  const contributionProfit = completedRevenue.minus(materialCost);
  const newRevenue = customerBuckets.get("new")?.completedRevenue ?? new Decimal(0);
  const repeatRevenue = customerBuckets.get("repeat")?.completedRevenue ?? new Decimal(0);

  const stageCounts: Record<string, number> = {
    inquiries,
    qualified: qualifiedIds.size,
    estimates_sent: estimatesSent,
    estimates_approved: estimatesApproved,
    jobs_confirmed: typedJobs.length,
    jobs_completed: completedJobs,
    repeat_jobs: repeatJobs
  };

  return {
    period: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      timeZone: period.timeZone,
      dateInterpretation: period.dateInterpretation
    },
    funnel: REVENUE_FUNNEL_STAGE_REGISTRY.map((entry) => ({
      stage: entry.key,
      label: entry.label,
      count: stageCounts[entry.key] ?? 0
    })),
    revenue: {
      completedRevenue: money(completedRevenue),
      newCustomerRevenue: money(newRevenue),
      repeatCustomerRevenue: money(repeatRevenue),
      repeatRevenueSharePercent: completedRevenue.gt(0)
        ? repeatRevenue.div(completedRevenue).mul(100).toDecimalPlaces(2).toNumber()
        : 0
    },
    segments: {
      customerType: toSegments(REVENUE_CUSTOMER_SEGMENT_REGISTRY, customerBuckets),
      agentAssistance: toSegments(REVENUE_ASSISTANCE_SEGMENT_REGISTRY, assistanceBuckets)
    },
    profit: {
      costBasis: "materials_only",
      completedJobCount: completedJobs,
      completedRevenue: money(completedRevenue),
      materialCost: money(materialCost),
      contributionProfit: money(contributionProfit),
      contributionProfitPerCompletedJob:
        completedJobs > 0 ? money(contributionProfit.div(completedJobs)) : null,
      jobsWithIncompleteCostData: incompleteCostJobs.size
    },
    guardrails: {
      agentProposals: agentRows.length,
      ...guardrailCounts,
      edited,
      acceptanceRatePercent: percent(guardrailCounts.accepted, decided),
      overrideRatePercent: percent(guardrailCounts.rejected + edited, decided),
      errorRatePercent: percent(guardrailCounts.failed, decided)
    },
    attribution: {
      unknownSourceJobCount,
      unknownSourceDefinition: UNKNOWN_ATTRIBUTION_DEFINITION
    },
    definitions: REVENUE_OUTCOME_DEFINITIONS
  };
}
