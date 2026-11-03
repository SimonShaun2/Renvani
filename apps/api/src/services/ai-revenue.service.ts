import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  REVENUE_SUMMARY_CACHE_TTL_SECONDS,
  aiRecommendations,
  assets,
  buildRevenueSummaryCacheKey,
  computeRevenueSummarySnapshot,
  customers,
  db,
  emitEventWithExecutor,
  estimates,
  invoices,
  jobs,
  type RevenueSummaryCacheEntry
} from "@fsm/db";
import { redisConnection } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  type ActionRecommendationInput,
  type AiRecommendation,
  type AiRecommendationAsset,
  type AiRecommendationCustomer,
  type AiRecommendationDetail,
  type AiRecommendationEstimate,
  type AiRecommendationInvoice,
  type AiRecommendationJob,
  type AiRecommendationStatus,
  type ListRecommendationsQuery,
  type PaginatedResult,
  type RevenueSummary,
  isRevenueProposalRecommendationType
} from "@fsm/types";

type AiRecommendationRow = typeof aiRecommendations.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type EstimateRow = typeof estimates.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface RecommendationRelations {
  customerById: Map<string, CustomerRow>;
  assetById: Map<string, AssetRow>;
  jobById: Map<string, JobRow>;
  estimateById: Map<string, EstimateRow>;
  invoiceById: Map<string, InvoiceRow>;
}

function isFutureDate(value: Date, now: Date): boolean {
  return value.getTime() > now.getTime();
}

function deriveRecommendationStatus(
  row: AiRecommendationRow,
  now: Date
): AiRecommendationStatus {
  if (row.status === "pending" && row.snoozedUntil && isFutureDate(row.snoozedUntil, now)) {
    return "snoozed";
  }

  return row.status as AiRecommendationStatus;
}

function toAiRecommendation(row: AiRecommendationRow, now: Date): AiRecommendation {
  return {
    id: row.id,
    companyId: row.companyId,
    type: row.type,
    status: deriveRecommendationStatus(row, now),
    customerId: row.customerId,
    propertyId: row.propertyId,
    assetId: row.assetId,
    jobId: row.jobId,
    estimateId: row.estimateId,
    invoiceId: row.invoiceId,
    estimatedRevenue: row.estimatedRevenue,
    headline: row.headline,
    body: row.body,
    suggestedAction: row.suggestedAction,
    suggestedMessage: row.suggestedMessage,
    urgencyScore: row.urgencyScore,
    confidenceScore: row.confidenceScore,
    actionedAt: row.actionedAt,
    actionedById: row.actionedById,
    dismissedAt: row.dismissedAt,
    snoozedUntil: row.snoozedUntil,
    expiresAt: row.expiresAt,
    sourceEventIds: row.sourceEventIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

function toRecommendationCustomer(row: CustomerRow | undefined): AiRecommendationCustomer | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone
  };
}

function toRecommendationAsset(row: AssetRow | undefined): AiRecommendationAsset | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    assetType: row.assetType,
    installDate: row.installDate
  };
}

function toRecommendationJob(row: JobRow | undefined): AiRecommendationJob | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    jobNumber: row.jobNumber
  };
}

function toRecommendationEstimate(row: EstimateRow | undefined): AiRecommendationEstimate | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    estimateNumber: row.estimateNumber,
    total: row.total
  };
}

function toRecommendationInvoice(row: InvoiceRow | undefined): AiRecommendationInvoice | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    balanceDue: row.balanceDue
  };
}

function toAiRecommendationDetail(
  row: AiRecommendationRow,
  relations: RecommendationRelations,
  now: Date
): AiRecommendationDetail {
  return {
    ...toAiRecommendation(row, now),
    customer: row.customerId ? toRecommendationCustomer(relations.customerById.get(row.customerId)) : null,
    asset: row.assetId ? toRecommendationAsset(relations.assetById.get(row.assetId)) : null,
    job: row.jobId ? toRecommendationJob(relations.jobById.get(row.jobId)) : null,
    estimate: row.estimateId ? toRecommendationEstimate(relations.estimateById.get(row.estimateId)) : null,
    invoice: row.invoiceId ? toRecommendationInvoice(relations.invoiceById.get(row.invoiceId)) : null
  };
}

function sortRecommendations(
  rows: AiRecommendationRow[],
  sortBy: NonNullable<ListRecommendationsQuery["sortBy"]>,
  sortOrder: NonNullable<ListRecommendationsQuery["sortOrder"]>
): AiRecommendationRow[] {
  return [...rows].sort((left, right) => {
    const direction = sortOrder === "asc" ? 1 : -1;

    if (sortBy === "createdAt") {
      const comparison = left.createdAt.getTime() - right.createdAt.getTime();
      return comparison * direction;
    }

    if (sortBy === "estimatedRevenue") {
      const comparison = new Decimal(left.estimatedRevenue ?? "0").cmp(right.estimatedRevenue ?? "0");
      return comparison * direction;
    }

    const leftUrgency = left.urgencyScore ?? -1;
    const rightUrgency = right.urgencyScore ?? -1;

    if (leftUrgency === rightUrgency) {
      return (left.createdAt.getTime() - right.createdAt.getTime()) * direction;
    }

    return (leftUrgency - rightUrgency) * direction;
  });
}

async function loadRecommendationRows(companyId: string): Promise<AiRecommendationRow[]> {
  return db
    .select()
    .from(aiRecommendations)
    .where(and(eq(aiRecommendations.companyId, companyId), isNull(aiRecommendations.deletedAt)));
}

async function loadRecommendationRelations(companyId: string): Promise<RecommendationRelations> {
  const [customerRows, assetRows, jobRows, estimateRows, invoiceRows] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt))),
    db
      .select()
      .from(assets)
      .where(and(eq(assets.companyId, companyId), isNull(assets.deletedAt))),
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt))),
    db
      .select()
      .from(estimates)
      .where(and(eq(estimates.companyId, companyId), isNull(estimates.deletedAt))),
    db
      .select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
  ]);

  return {
    customerById: new Map(customerRows.map((row) => [row.id, row])),
    assetById: new Map(assetRows.map((row) => [row.id, row])),
    jobById: new Map(jobRows.map((row) => [row.id, row])),
    estimateById: new Map(estimateRows.map((row) => [row.id, row])),
    invoiceById: new Map(invoiceRows.map((row) => [row.id, row]))
  };
}

function filterRecommendationRows(
  rows: AiRecommendationRow[],
  query: ListRecommendationsQuery,
  now: Date
): AiRecommendationRow[] {
  const status = query.status ?? "pending";

  return rows.filter((row) => {
    if (query.type && row.type !== query.type) {
      return false;
    }

    if (query.customerId && row.customerId !== query.customerId) {
      return false;
    }

    if (query.assetId && row.assetId !== query.assetId) {
      return false;
    }

    const derivedStatus = deriveRecommendationStatus(row, now);

    if (status !== derivedStatus) {
      return false;
    }

    if (status === "pending" && row.snoozedUntil && isFutureDate(row.snoozedUntil, now)) {
      return false;
    }

    return row.deletedAt === null;
  });
}

async function getRecommendationRowOrThrow(
  companyId: string,
  recommendationId: string
): Promise<AiRecommendationRow> {
  const [recommendation] = await db
    .select()
    .from(aiRecommendations)
    .where(
      and(
        eq(aiRecommendations.companyId, companyId),
        eq(aiRecommendations.id, recommendationId),
        isNull(aiRecommendations.deletedAt)
      )
    )
    .limit(1);

  if (!recommendation) {
    throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
  }

  return recommendation;
}

function toRevenueSummary(entry: RevenueSummaryCacheEntry, fromCache: boolean): RevenueSummary {
  return {
    dormantCustomers: entry.dormantCustomers,
    unsoldEstimates: entry.unsoldEstimates,
    unpaidInvoices: entry.unpaidInvoices,
    agingAssets: entry.agingAssets,
    maintenancePlanOpportunities: entry.maintenancePlanOpportunities,
    totalOpportunityValue: entry.totalOpportunityValue,
    generatedAt: entry.generatedAt,
    fromCache
  };
}

export async function invalidateRevenueSummaryCache(companyId: string): Promise<void> {
  await redisConnection.del(buildRevenueSummaryCacheKey(companyId));
}

export async function getRevenueSummary(companyId: string): Promise<RevenueSummary> {
  const cacheKey = buildRevenueSummaryCacheKey(companyId);
  const cachedValue = await redisConnection.get(cacheKey);

  if (cachedValue) {
    try {
      return toRevenueSummary(JSON.parse(cachedValue) as RevenueSummaryCacheEntry, true);
    } catch {
      await redisConnection.del(cacheKey);
    }
  }

  const summary = await computeRevenueSummarySnapshot(companyId);
  await redisConnection.set(
    cacheKey,
    JSON.stringify(summary),
    "EX",
    REVENUE_SUMMARY_CACHE_TTL_SECONDS,
    "NX"
  );

  return toRevenueSummary(summary, false);
}

export async function listRecommendations(
  companyId: string,
  query: ListRecommendationsQuery
): Promise<PaginatedResult<AiRecommendationDetail>> {
  const now = new Date();
  const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const sortBy = query.sortBy ?? "urgencyScore";
  const sortOrder = query.sortOrder ?? "desc";

  const [rows, relations] = await Promise.all([
    loadRecommendationRows(companyId),
    loadRecommendationRelations(companyId)
  ]);

  const filteredRows = filterRecommendationRows(rows, query, now);
  const sortedRows = sortRecommendations(filteredRows, sortBy, sortOrder);
  const total = sortedRows.length;
  const startIndex = (page - 1) * limit;
  const pageRows = sortedRows.slice(startIndex, startIndex + limit);

  return {
    data: pageRows.map((row) => toAiRecommendationDetail(row, relations, now)),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit)
  };
}

export async function getRecommendation(
  companyId: string,
  recommendationId: string
): Promise<AiRecommendationDetail> {
  const now = new Date();
  const [row, relations] = await Promise.all([
    getRecommendationRowOrThrow(companyId, recommendationId),
    loadRecommendationRelations(companyId)
  ]);

  return toAiRecommendationDetail(row, relations, now);
}

export async function actionRecommendation(
  companyId: string,
  actorId: string,
  recommendationId: string,
  input: ActionRecommendationInput
): Promise<AiRecommendation> {
  const now = new Date();
  const recommendation = await getRecommendationRowOrThrow(companyId, recommendationId);

  if (isRevenueProposalRecommendationType(recommendation.type)) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "This recommendation requires a Revenue Agent proposal and operator approval"
    );
  }

  if (recommendation.status !== "pending") {
    throw new AppError(ErrorCode.CONFLICT, "Recommendation has already been actioned");
  }

  const updatedRecommendation = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(aiRecommendations)
      .set({
        status: "actioned",
        suggestedAction: input.actionTaken,
        actionedAt: now,
        actionedById: actorId,
        snoozedUntil: null,
        updatedAt: now
      })
      .where(
        and(
          eq(aiRecommendations.companyId, companyId),
          eq(aiRecommendations.id, recommendationId),
          isNull(aiRecommendations.deletedAt)
        )
      )
      .returning();
    const updatedRow = updatedRows[0];

    if (!updatedRow) {
      throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "ai.recommendation_actioned",
      actorId,
      actorType: "user",
      entityType: "ai_recommendation",
      entityId: updatedRow.id,
      customerId: updatedRow.customerId ?? undefined,
      jobId: updatedRow.jobId ?? undefined,
      estimateId: updatedRow.estimateId ?? undefined,
      invoiceId: updatedRow.invoiceId ?? undefined,
      payload: {
        actionTaken: input.actionTaken,
        notes: input.notes ?? null
      },
      summary: `AI recommendation actioned: ${updatedRow.headline}`
    });

    return updatedRow;
  });

  await invalidateRevenueSummaryCache(companyId);

  return toAiRecommendation(updatedRecommendation, now);
}

export async function dismissRecommendation(
  companyId: string,
  actorId: string,
  recommendationId: string,
  reason?: string
): Promise<AiRecommendation> {
  const now = new Date();
  const recommendation = await getRecommendationRowOrThrow(companyId, recommendationId);

  if (recommendation.status !== "pending") {
    throw new AppError(ErrorCode.CONFLICT, "Recommendation has already been actioned");
  }

  const updatedRecommendation = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(aiRecommendations)
      .set({
        status: "dismissed",
        dismissedAt: now,
        snoozedUntil: null,
        updatedAt: now
      })
      .where(
        and(
          eq(aiRecommendations.companyId, companyId),
          eq(aiRecommendations.id, recommendationId),
          isNull(aiRecommendations.deletedAt)
        )
      )
      .returning();
    const updatedRow = updatedRows[0];

    if (!updatedRow) {
      throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "ai.recommendation_dismissed",
      actorId,
      actorType: "user",
      entityType: "ai_recommendation",
      entityId: updatedRow.id,
      customerId: updatedRow.customerId ?? undefined,
      jobId: updatedRow.jobId ?? undefined,
      estimateId: updatedRow.estimateId ?? undefined,
      invoiceId: updatedRow.invoiceId ?? undefined,
      payload: {
        reason: reason ?? null
      },
      summary: `AI recommendation dismissed: ${updatedRow.headline}`
    });

    return updatedRow;
  });

  await invalidateRevenueSummaryCache(companyId);

  return toAiRecommendation(updatedRecommendation, now);
}

export async function snoozeRecommendation(
  companyId: string,
  actorId: string,
  recommendationId: string,
  snoozedUntil: string
): Promise<AiRecommendation> {
  const now = new Date();
  const snoozedUntilDate = new Date(snoozedUntil);

  if (!isFutureDate(snoozedUntilDate, now)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "snoozedUntil must be in the future", {
      snoozedUntil: "Must be a future ISO datetime"
    });
  }

  const recommendation = await getRecommendationRowOrThrow(companyId, recommendationId);

  if (recommendation.status !== "pending") {
    throw new AppError(ErrorCode.CONFLICT, "Recommendation has already been actioned");
  }

  const updatedRecommendation = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(aiRecommendations)
      .set({
        snoozedUntil: snoozedUntilDate,
        updatedAt: now
      })
      .where(
        and(
          eq(aiRecommendations.companyId, companyId),
          eq(aiRecommendations.id, recommendationId),
          isNull(aiRecommendations.deletedAt)
        )
      )
      .returning();
    const updatedRow = updatedRows[0];

    if (!updatedRow) {
      throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "ai.recommendation_snoozed",
      actorId,
      actorType: "user",
      entityType: "ai_recommendation",
      entityId: updatedRow.id,
      customerId: updatedRow.customerId ?? undefined,
      jobId: updatedRow.jobId ?? undefined,
      estimateId: updatedRow.estimateId ?? undefined,
      invoiceId: updatedRow.invoiceId ?? undefined,
      payload: {
        snoozedUntil: snoozedUntilDate.toISOString()
      },
      summary: `AI recommendation snoozed: ${updatedRow.headline}`
    });

    return updatedRow;
  });

  await invalidateRevenueSummaryCache(companyId);

  return toAiRecommendation(updatedRecommendation, now);
}
