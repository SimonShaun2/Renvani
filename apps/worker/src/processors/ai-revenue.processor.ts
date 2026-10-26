import type { Job, Processor } from "bullmq";
import pino from "pino";
import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  generateAgingAssetMessage,
  generateEstimateFollowUpMessage,
  generateInvoiceRecoveryMessage,
  generateReactivationMessage
} from "@fsm/ai";
import {
  REVENUE_SUMMARY_CACHE_TTL_SECONDS,
  aiRecommendations,
  assets,
  automationRules,
  buildRevenueSummaryCacheKey,
  companies,
  computeRevenueSummarySnapshot,
  customers,
  db,
  emitEvent,
  estimates,
  invoices,
  jobs,
  listActiveCompanyIdsForRevenueSummary,
  maintenancePlans,
  serviceAgreementTemplates,
  type RevenueSummaryCacheEntry
} from "@fsm/db";
import { aiQueue, redisConnection } from "@fsm/jobs";
import { AI_QUEUE_JOB_NAMES, type ImportFileLinkJobData } from "@fsm/types";

import { handleImportFileLink } from "./import-file-link.processor.js";

const logger = pino({
  name: "ai-revenue-processor"
});

type AutomationRuleType = (typeof automationRules.$inferSelect)["ruleType"];
type RecommendationType = (typeof aiRecommendations.$inferSelect)["type"];

interface CompanyContext {
  id: string;
  name: string;
}

interface AssetOpportunityContext {
  id: string;
  propertyId: string | null;
  assetType: string;
  brand: string | null;
  installDate: string | null;
}

interface EstimateOpportunityContext {
  id: string;
  jobId: string | null;
  status: (typeof estimates.$inferSelect)["status"];
  total: string;
  sentAt: Date | null;
}

interface MaintenancePlanOpportunityContext {
  id: string;
  propertyId: string | null;
}

interface JobOpportunityContext {
  id: string;
  assetId: string | null;
  type: typeof jobs.$inferSelect.type;
  invoiceTotal: string | null;
  createdAt: Date;
}

interface CustomerOpportunityContext {
  company: CompanyContext;
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  doNotContact: boolean;
  lastServiceDate: string | null;
  activeAssets: AssetOpportunityContext[];
  openEstimates: EstimateOpportunityContext[];
  activeMaintenancePlans: MaintenancePlanOpportunityContext[];
  recentJobs: JobOpportunityContext[];
  companyAverageTicket: string;
  cheapestAnnualPlanPrice: string | null;
  recentReplacementEstimateAssetIds: string[];
}

interface EstimateFollowUpContext {
  company: CompanyContext;
  estimateId: string;
  customerId: string;
  customerFirstName: string;
  status: (typeof estimates.$inferSelect)["status"];
  estimateNumber: string;
  total: string;
  sentAt: Date | null;
}

interface InvoiceRecoveryContext {
  company: CompanyContext;
  invoiceId: string;
  customerId: string;
  customerFirstName: string;
  status: (typeof invoices.$inferSelect)["status"];
  invoiceNumber: string;
  balanceDue: string;
  dueAt: Date | null;
  paymentLinkUrl: string | null;
}

interface RecommendationLookup {
  companyId: string;
  type: RecommendationType;
  customerId?: string;
  propertyId?: string | null;
  assetId?: string;
  estimateId?: string;
  invoiceId?: string;
}

interface RecommendationCreateInput {
  companyId: string;
  type: RecommendationType;
  customerId: string;
  propertyId?: string | null;
  assetId?: string;
  estimateId?: string;
  invoiceId?: string;
  estimatedRevenue: string | null;
  headline: string;
  body: string;
  suggestedAction: string;
  suggestedMessage?: string;
  urgencyScore: number;
}

interface CreatedRecommendation {
  id: string;
}

interface UrgencyContext {
  daysSinceService?: number;
  assetAgeYears?: number;
  hoursElapsed?: number;
  daysOverdue?: number;
  daysToDue?: number;
}

interface RevenueContext {
  annualPlanPrice?: string | null;
  estimateTotal?: string | null;
  balanceDue?: string | null;
}

interface SeasonalContext {
  serviceType: string | null;
  urgencyBonus: number;
}

type Season = "spring" | "summer" | "fall" | "winter";

export interface AiRevenueDependencies {
  loadCompany(companyId: string): Promise<CompanyContext | null>;
  loadCustomerOpportunityContext(companyId: string, customerId: string): Promise<CustomerOpportunityContext | null>;
  loadEstimateFollowUpContext(companyId: string, estimateId: string): Promise<EstimateFollowUpContext | null>;
  loadInvoiceRecoveryContext(companyId: string, invoiceId: string): Promise<InvoiceRecoveryContext | null>;
  listCompanyIds(offset: number, limit: number): Promise<string[]>;
  listActiveCompanyIdsForRevenueSummary(since: Date, offset: number, limit: number): Promise<string[]>;
  listDormantCustomerIds(companyId: string, thresholdDays: number, offset: number, limit: number): Promise<string[]>;
  findAutomationRule(
    companyId: string,
    ruleType: AutomationRuleType
  ): Promise<{ companyId: string; delayHours: number | null; thresholdDays: number | null } | null>;
  findPendingRecommendation(criteria: RecommendationLookup): Promise<{ id: string } | null>;
  createRecommendation(input: RecommendationCreateInput): Promise<CreatedRecommendation>;
  computeRevenueSummarySnapshot(companyId: string): Promise<RevenueSummaryCacheEntry>;
  cacheRevenueSummary(companyId: string, summary: RevenueSummaryCacheEntry): Promise<void>;
  enqueueRevenueSummary(companyId: string): Promise<void>;
  invalidateRevenueSummaryCache(companyId: string): Promise<void>;
  emitRecommendationCreated(input: {
    companyId: string;
    recommendationId: string;
    customerId: string;
    estimateId?: string;
    invoiceId?: string;
    summary: string;
  }): Promise<void>;
  generateAgingAssetMessage: typeof generateAgingAssetMessage;
  generateEstimateFollowUpMessage: typeof generateEstimateFollowUpMessage;
  generateInvoiceRecoveryMessage: typeof generateInvoiceRecoveryMessage;
  generateReactivationMessage: typeof generateReactivationMessage;
}

function getJobString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function getTodayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function calculateDaysSince(dateValue: string | null): number {
  if (!dateValue) {
    return 365;
  }

  return Math.floor((getTodayUtcDate().getTime() - parseDateOnly(dateValue).getTime()) / (24 * 60 * 60 * 1000));
}

function calculateHoursElapsed(dateValue: Date | null): number {
  if (!dateValue) {
    return 24;
  }

  return Math.max(Math.floor((Date.now() - dateValue.getTime()) / (60 * 60 * 1000)), 0);
}

function calculateAssetAge(installDate: string | null): number {
  if (!installDate) {
    return 0;
  }

  return Math.max(Math.floor(calculateDaysSince(installDate) / 365), 0);
}

function isLikelyHvacContext(context: CustomerOpportunityContext): boolean {
  const hvacKeywords = ["hvac", "ac", "furnace", "heat", "cool", "air"];

  return context.activeAssets.some((asset) =>
    hvacKeywords.some((keyword) => asset.assetType.toLowerCase().includes(keyword))
  );
}

export function getCurrentSeason(currentDate: Date = new Date()): Season {
  const month = currentDate.getMonth();

  if (month >= 2 && month <= 4) {
    return "spring";
  }

  if (month >= 5 && month <= 7) {
    return "summer";
  }

  if (month >= 8 && month <= 10) {
    return "fall";
  }

  return "winter";
}

function getSeasonalServiceType(season: Season): string | null {
  switch (season) {
    case "spring":
      return "cooling tune-up";
    case "fall":
      return "heating tune-up";
    default:
      return null;
  }
}

function resolveSeasonalContext(
  context: CustomerOpportunityContext,
  currentDate: Date = new Date()
): SeasonalContext {
  if (!isLikelyHvacContext(context)) {
    return {
      serviceType: null,
      urgencyBonus: 0
    };
  }

  const serviceType = getSeasonalServiceType(getCurrentSeason(currentDate));

  if (!serviceType) {
    return {
      serviceType: null,
      urgencyBonus: 0
    };
  }

  return {
    serviceType,
    urgencyBonus: 10
  };
}

function applyUrgencyBonus(baseScore: number, bonus: number): number {
  return Math.min(baseScore + bonus, 100);
}

export function computeUrgencyScore(type: RecommendationType, ctx: UrgencyContext): number {
  switch (type) {
    case "reactivation":
      if ((ctx.daysSinceService ?? 0) >= 365) {
        return 90;
      }
      if ((ctx.daysSinceService ?? 0) >= 180) {
        return 55;
      }
      if ((ctx.daysSinceService ?? 0) >= 90) {
        return 30;
      }
      return 0;
    case "aging_asset":
      if ((ctx.assetAgeYears ?? 0) >= 15) {
        return 90;
      }
      if ((ctx.assetAgeYears ?? 0) >= 12) {
        return 70;
      }
      if ((ctx.assetAgeYears ?? 0) >= 10) {
        return 50;
      }
      return 0;
    case "unsold_estimate":
      if ((ctx.hoursElapsed ?? 0) >= 72) {
        return 85;
      }
      if ((ctx.hoursElapsed ?? 0) >= 48) {
        return 75;
      }
      return 60;
    case "unpaid_invoice":
      if ((ctx.daysOverdue ?? 0) >= 15) {
        return 90;
      }
      if ((ctx.daysOverdue ?? 0) >= 8) {
        return 70;
      }
      return 50;
    case "maintenance_plan_offer":
      return 40;
    case "maintenance_due":
      if ((ctx.daysToDue ?? Number.POSITIVE_INFINITY) <= 0) {
        return 90;
      }
      if ((ctx.daysToDue ?? Number.POSITIVE_INFINITY) <= 7) {
        return 70;
      }
      return 40;
    case "seasonal_campaign":
      return 30;
    case "upsell_opportunity":
      return 30;
    default:
      return 30;
  }
}

export function estimateRevenue(
  type: RecommendationType,
  ctx: RevenueContext,
  companyAvgTicket: string | null
): string {
  const averageTicket = new Decimal(companyAvgTicket ?? "350");

  switch (type) {
    case "reactivation":
      return averageTicket.toFixed(2);
    case "aging_asset":
      return averageTicket.mul(3).toFixed(2);
    case "maintenance_plan_offer":
      return new Decimal(ctx.annualPlanPrice ?? "299").toFixed(2);
    case "unsold_estimate":
      return new Decimal(ctx.estimateTotal ?? "0").toFixed(2);
    case "unpaid_invoice":
      return new Decimal(ctx.balanceDue ?? "0").toFixed(2);
    case "maintenance_due":
      return averageTicket.mul(0.5).toFixed(2);
    default:
      return averageTicket.toFixed(2);
  }
}

function buildRecommendationSummary(headline: string): string {
  return `AI recommendation created: ${headline}`;
}

const OPEN_ESTIMATE_STATUSES = new Set<(typeof estimates.$inferSelect)["status"]>([
  "draft",
  "sent",
  "viewed",
  "revised"
]);

const productionDependencies: AiRevenueDependencies = {
  async loadCompany(companyId) {
    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name
      })
      .from(companies)
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .limit(1);

    return company ?? null;
  },
  async loadCustomerOpportunityContext(companyId, customerId) {
    const [company, customer, assetRows, estimateRows, planRows, customerJobRows, companyJobRows, templateRows] =
      await Promise.all([
        db
          .select({
            id: companies.id,
            name: companies.name
          })
          .from(companies)
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .limit(1),
        db
          .select({
            id: customers.id,
            firstName: customers.firstName,
            lastName: customers.lastName,
            doNotContact: customers.doNotContact,
            lastServiceDate: customers.lastServiceDate
          })
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
          .limit(1),
        db
          .select({
            id: assets.id,
            propertyId: assets.propertyId,
            assetType: assets.assetType,
            brand: assets.brand,
            installDate: assets.installDate
          })
          .from(assets)
          .where(
            and(
              eq(assets.companyId, companyId),
              eq(assets.customerId, customerId),
              eq(assets.isActive, true),
              isNull(assets.deletedAt)
            )
          ),
        db
          .select({
            id: estimates.id,
            jobId: estimates.jobId,
            status: estimates.status,
            total: estimates.total,
            sentAt: estimates.sentAt
          })
          .from(estimates)
          .where(and(eq(estimates.companyId, companyId), eq(estimates.customerId, customerId), isNull(estimates.deletedAt))),
        db
          .select({
            id: maintenancePlans.id,
            propertyId: maintenancePlans.propertyId
          })
          .from(maintenancePlans)
          .where(
            and(
              eq(maintenancePlans.companyId, companyId),
              eq(maintenancePlans.customerId, customerId),
              eq(maintenancePlans.status, "active"),
              isNull(maintenancePlans.deletedAt)
            )
          ),
        db
          .select({
            id: jobs.id,
            assetId: jobs.assetId,
            type: jobs.type,
            invoiceTotal: jobs.invoiceTotal,
            createdAt: jobs.createdAt
          })
          .from(jobs)
          .where(and(eq(jobs.companyId, companyId), eq(jobs.customerId, customerId), isNull(jobs.deletedAt))),
        db
          .select({
            invoiceTotal: jobs.invoiceTotal
          })
          .from(jobs)
          .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt))),
        db
          .select({
            annualPrice: serviceAgreementTemplates.annualPrice,
            monthlyPrice: serviceAgreementTemplates.monthlyPrice
          })
          .from(serviceAgreementTemplates)
          .where(
            and(
              eq(serviceAgreementTemplates.companyId, companyId),
              eq(serviceAgreementTemplates.isActive, true),
              isNull(serviceAgreementTemplates.deletedAt)
            )
          )
      ]);

    const companyRecord = company[0];
    const customerRecord = customer[0];

    if (!companyRecord || !customerRecord) {
      return null;
    }

    const sortedCustomerJobs = [...customerJobRows].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );
    const recentJobs = sortedCustomerJobs.slice(0, 10);
    const recentEstimateThreshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentReplacementEstimateAssetIds = estimateRows
      .filter(
        (estimateRow) =>
          estimateRow.sentAt !== null &&
          estimateRow.sentAt.getTime() >= recentEstimateThreshold &&
          estimateRow.jobId !== null
      )
      .flatMap((estimateRow) => {
        const relatedJob = customerJobRows.find((jobRow) => jobRow.id === estimateRow.jobId);
        return relatedJob?.assetId ? [relatedJob.assetId] : [];
      });

    const companyAverageTicket = (() => {
      const invoiceTotals = companyJobRows.flatMap((jobRow) => (jobRow.invoiceTotal ? [new Decimal(jobRow.invoiceTotal)] : []));

      if (invoiceTotals.length === 0) {
        return "350.00";
      }

      const total = invoiceTotals.reduce((sum, value) => sum.add(value), new Decimal(0));
      return total.div(invoiceTotals.length).toFixed(2);
    })();

    const cheapestAnnualPlanPrice = templateRows.reduce<Decimal | null>((lowest, templateRow) => {
      const candidate =
        templateRow.annualPrice !== null
          ? new Decimal(templateRow.annualPrice)
          : templateRow.monthlyPrice !== null
            ? new Decimal(templateRow.monthlyPrice).mul(12)
            : null;

      if (!candidate) {
        return lowest;
      }

      if (!lowest || candidate.lessThan(lowest)) {
        return candidate;
      }

      return lowest;
    }, null);

    return {
      company: companyRecord,
      customerId: customerRecord.id,
      customerFirstName: customerRecord.firstName,
      customerLastName: customerRecord.lastName,
      doNotContact: customerRecord.doNotContact ?? false,
      lastServiceDate: customerRecord.lastServiceDate,
      activeAssets: assetRows,
      openEstimates: estimateRows.filter((estimateRow) => OPEN_ESTIMATE_STATUSES.has(estimateRow.status)),
      activeMaintenancePlans: planRows,
      recentJobs,
      companyAverageTicket,
      cheapestAnnualPlanPrice: cheapestAnnualPlanPrice?.toFixed(2) ?? null,
      recentReplacementEstimateAssetIds
    };
  },
  async loadEstimateFollowUpContext(companyId, estimateId) {
    const [estimate] = await db
      .select({
        id: estimates.id,
        companyId: estimates.companyId,
        customerId: estimates.customerId,
        status: estimates.status,
        estimateNumber: estimates.estimateNumber,
        total: estimates.total,
        sentAt: estimates.sentAt
      })
      .from(estimates)
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .limit(1);

    if (!estimate) {
      return null;
    }

    const [company, customer] = await Promise.all([
      db
        .select({
          id: companies.id,
          name: companies.name
        })
        .from(companies)
        .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
        .limit(1),
      db
        .select({
          id: customers.id,
          firstName: customers.firstName
        })
        .from(customers)
        .where(and(eq(customers.companyId, companyId), eq(customers.id, estimate.customerId), isNull(customers.deletedAt)))
        .limit(1)
    ]);

    const companyRecord = company[0];
    const customerRecord = customer[0];

    if (!companyRecord || !customerRecord) {
      return null;
    }

    return {
      company: companyRecord,
      estimateId: estimate.id,
      customerId: estimate.customerId,
      customerFirstName: customerRecord.firstName,
      status: estimate.status,
      estimateNumber: estimate.estimateNumber,
      total: estimate.total,
      sentAt: estimate.sentAt
    };
  },
  async loadInvoiceRecoveryContext(companyId, invoiceId) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
      .limit(1);

    if (!invoice) {
      return null;
    }

    const [company, customer] = await Promise.all([
      db
        .select({
          id: companies.id,
          name: companies.name
        })
        .from(companies)
        .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
        .limit(1),
      db
        .select({
          id: customers.id,
          firstName: customers.firstName
        })
        .from(customers)
        .where(and(eq(customers.companyId, companyId), eq(customers.id, invoice.customerId), isNull(customers.deletedAt)))
        .limit(1)
    ]);

    const companyRecord = company[0];
    const customerRecord = customer[0];

    if (!companyRecord || !customerRecord) {
      return null;
    }

    return {
      company: companyRecord,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      customerFirstName: customerRecord.firstName,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
      balanceDue: invoice.balanceDue,
      dueAt: invoice.dueAt,
      paymentLinkUrl: invoice.stripePaymentLinkUrl
    };
  },
  async listCompanyIds(offset, limit) {
    const companyRows = await db
      .select({
        id: companies.id
      })
      .from(companies)
      .where(isNull(companies.deletedAt));

    return companyRows
      .map((companyRow) => companyRow.id)
      .slice(offset, offset + limit);
  },
  async listActiveCompanyIdsForRevenueSummary(since, offset, limit) {
    return listActiveCompanyIdsForRevenueSummary(since, offset, limit);
  },
  async listDormantCustomerIds(companyId, thresholdDays, offset, limit) {
    const customerRows = await db
      .select({
        id: customers.id,
        lastServiceDate: customers.lastServiceDate,
        doNotContact: customers.doNotContact
      })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)));

    const dormantCustomerIds = customerRows
      .filter((customerRow) => {
        if (customerRow.doNotContact) {
          return false;
        }

        return calculateDaysSince(customerRow.lastServiceDate) >= thresholdDays;
      })
      .map((customerRow) => customerRow.id);

    return dormantCustomerIds.slice(offset, offset + limit);
  },
  async findAutomationRule(companyId, ruleType) {
    const [rule] = await db
      .select({
        companyId: automationRules.companyId,
        delayHours: automationRules.delayHours,
        thresholdDays: automationRules.thresholdDays
      })
      .from(automationRules)
      .where(
        and(
          eq(automationRules.companyId, companyId),
          eq(automationRules.ruleType, ruleType),
          eq(automationRules.isEnabled, true),
          isNull(automationRules.deletedAt)
        )
      )
      .limit(1);

    return rule ?? null;
  },
  async findPendingRecommendation(criteria) {
    const [recommendation] = await db
      .select({
        id: aiRecommendations.id
      })
      .from(aiRecommendations)
      .where(
        and(
          eq(aiRecommendations.companyId, criteria.companyId),
          eq(aiRecommendations.type, criteria.type),
          eq(aiRecommendations.status, "pending"),
          criteria.customerId ? eq(aiRecommendations.customerId, criteria.customerId) : isNull(aiRecommendations.customerId),
          criteria.propertyId !== undefined
            ? criteria.propertyId === null
              ? isNull(aiRecommendations.propertyId)
              : eq(aiRecommendations.propertyId, criteria.propertyId)
            : isNull(aiRecommendations.propertyId),
          criteria.assetId ? eq(aiRecommendations.assetId, criteria.assetId) : isNull(aiRecommendations.assetId),
          criteria.estimateId ? eq(aiRecommendations.estimateId, criteria.estimateId) : isNull(aiRecommendations.estimateId),
          criteria.invoiceId ? eq(aiRecommendations.invoiceId, criteria.invoiceId) : isNull(aiRecommendations.invoiceId),
          isNull(aiRecommendations.deletedAt)
        )
      )
      .limit(1);

    return recommendation ?? null;
  },
  async createRecommendation(input) {
    const insertedRecommendations = await db
      .insert(aiRecommendations)
      .values({
        companyId: input.companyId,
        type: input.type,
        status: "pending",
        customerId: input.customerId,
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.assetId ? { assetId: input.assetId } : {}),
        ...(input.estimateId ? { estimateId: input.estimateId } : {}),
        ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
        estimatedRevenue: input.estimatedRevenue,
        headline: input.headline,
        body: input.body,
        suggestedAction: input.suggestedAction,
        ...(input.suggestedMessage ? { suggestedMessage: input.suggestedMessage } : {}),
        urgencyScore: input.urgencyScore,
        sourceEventIds: []
      })
      .returning({
        id: aiRecommendations.id
      });

    const recommendation = insertedRecommendations[0];

    if (!recommendation) {
      throw new Error("Failed to create AI recommendation");
    }

    return recommendation;
  },
  async computeRevenueSummarySnapshot(companyId) {
    return computeRevenueSummarySnapshot(companyId);
  },
  async cacheRevenueSummary(companyId, summary) {
    await redisConnection.set(
      buildRevenueSummaryCacheKey(companyId),
      JSON.stringify(summary),
      "EX",
      REVENUE_SUMMARY_CACHE_TTL_SECONDS,
      "NX"
    );
  },
  async enqueueRevenueSummary(companyId) {
    await aiQueue.add(
      "compute-revenue-summary",
      {
        companyId
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        jobId: `compute-revenue-summary-${companyId}`
      }
    );
  },
  async invalidateRevenueSummaryCache(companyId) {
    await redisConnection.del(buildRevenueSummaryCacheKey(companyId));
  },
  async emitRecommendationCreated(input) {
    await emitEvent({
      companyId: input.companyId,
      eventType: "ai.recommendation_created",
      actorType: "ai",
      entityType: "ai_recommendation",
      entityId: input.recommendationId,
      customerId: input.customerId,
      ...(input.estimateId ? { estimateId: input.estimateId } : {}),
      ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
      payload: {},
      summary: input.summary
    });
  },
  generateAgingAssetMessage,
  generateEstimateFollowUpMessage,
  generateInvoiceRecoveryMessage,
  generateReactivationMessage
};

async function createRecommendationIfMissing(
  dependencies: AiRevenueDependencies,
  lookup: RecommendationLookup,
  input: RecommendationCreateInput
): Promise<CreatedRecommendation | null> {
  const existingRecommendation = await dependencies.findPendingRecommendation(lookup);

  if (existingRecommendation) {
    return null;
  }

  const createdRecommendation = await dependencies.createRecommendation(input);
  await dependencies.invalidateRevenueSummaryCache(input.companyId);
  return createdRecommendation;
}

export async function handleEvaluateRevenueOpportunities(
  job: Job<Record<string, unknown>>,
  dependencies: AiRevenueDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const customerId = getJobString(job.data, "customerId");

  if (!companyId || !customerId) {
    logger.warn({ jobId: job.id ?? null }, "Revenue evaluation job missing required identifiers");
    return;
  }

  const context = await dependencies.loadCustomerOpportunityContext(companyId, customerId);

  if (!context) {
    logger.warn({ companyId, customerId }, "Revenue evaluation skipped because customer context was not found");
    return;
  }

  const seasonalContext = resolveSeasonalContext(context);

  for (const asset of context.activeAssets) {
    const assetAge = calculateAssetAge(asset.installDate);

    if (assetAge < 10) {
      continue;
    }

    if (context.recentReplacementEstimateAssetIds.includes(asset.id)) {
      continue;
    }

    const message = await dependencies.generateAgingAssetMessage({
      customerFirstName: context.customerFirstName,
      assetType: asset.assetType,
      assetAge,
      brand: asset.brand,
      companyName: context.company.name
    });
    const headline = `${asset.assetType} unit is ${assetAge} years old - replacement opportunity`;
    const recommendation = await createRecommendationIfMissing(
      dependencies,
      {
        companyId,
        type: "aging_asset",
        customerId,
        propertyId: asset.propertyId,
        assetId: asset.id
      },
      {
        companyId,
        type: "aging_asset",
        customerId,
        propertyId: asset.propertyId,
        assetId: asset.id,
        estimatedRevenue: estimateRevenue("aging_asset", {}, context.companyAverageTicket),
        headline: headline.slice(0, 255),
        body: message,
        suggestedAction: "send_sms",
        suggestedMessage: message,
        urgencyScore: computeUrgencyScore("aging_asset", { assetAgeYears: assetAge })
      }
    );

    if (!recommendation) {
      continue;
    }

    await dependencies.emitRecommendationCreated({
      companyId,
      recommendationId: recommendation.id,
      customerId,
      summary: buildRecommendationSummary(headline)
    });
  }

  if (context.activeAssets.length > 0 && context.activeMaintenancePlans.length === 0 && context.cheapestAnnualPlanPrice) {
    const headline = `Customer has ${context.activeAssets.length} assets with no maintenance plan`;
    const recommendation = await createRecommendationIfMissing(
      dependencies,
      {
        companyId,
        type: "maintenance_plan_offer",
        customerId
      },
      {
        companyId,
        type: "maintenance_plan_offer",
        customerId,
        estimatedRevenue: estimateRevenue(
          "maintenance_plan_offer",
          { annualPlanPrice: context.cheapestAnnualPlanPrice },
          context.companyAverageTicket
        ),
        headline,
        body: "Customer has active equipment without an active maintenance plan.",
        suggestedAction: "call_customer",
        urgencyScore: computeUrgencyScore("maintenance_plan_offer", {})
      }
    );

    if (recommendation) {
      await dependencies.emitRecommendationCreated({
        companyId,
        recommendationId: recommendation.id,
        customerId,
        summary: buildRecommendationSummary(headline)
      });
    }
  }

  const dormantRule = await dependencies.findAutomationRule(companyId, "dormant_customer");
  const daysSinceLastService = calculateDaysSince(context.lastServiceDate);

  if (!context.doNotContact && dormantRule && daysSinceLastService >= (dormantRule.thresholdDays ?? 90)) {
    const customerTicketTotals = context.recentJobs.flatMap((jobRow) =>
      jobRow.invoiceTotal ? [new Decimal(jobRow.invoiceTotal)] : []
    );
    const averageTicket =
      customerTicketTotals.length === 0
        ? context.companyAverageTicket
        : customerTicketTotals
            .reduce((sum, value) => sum.add(value), new Decimal(0))
            .div(customerTicketTotals.length)
            .toFixed(2);
    const message = await dependencies.generateReactivationMessage({
      customerFirstName: context.customerFirstName,
      daysSinceLastService,
      companyName: context.company.name,
      ...(seasonalContext.serviceType ? { serviceType: seasonalContext.serviceType } : {})
    });
    const headline = `Customer hasn't booked in ${daysSinceLastService} days`;
    const recommendation = await createRecommendationIfMissing(
      dependencies,
      {
        companyId,
        type: "reactivation",
        customerId
      },
      {
        companyId,
        type: "reactivation",
        customerId,
        estimatedRevenue: estimateRevenue("reactivation", {}, averageTicket),
        headline,
        body: message,
        suggestedAction: "send_sms",
        suggestedMessage: message,
        urgencyScore: applyUrgencyBonus(
          computeUrgencyScore("reactivation", { daysSinceService: daysSinceLastService }),
          seasonalContext.urgencyBonus
        )
      }
    );

    if (recommendation) {
      await dependencies.emitRecommendationCreated({
        companyId,
        recommendationId: recommendation.id,
        customerId,
        summary: buildRecommendationSummary(headline)
      });
    }
  }
}

export async function handleEstimateFollowUpCheck(
  job: Job<Record<string, unknown>>,
  dependencies: AiRevenueDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const estimateId = getJobString(job.data, "estimateId");
  const customerId = getJobString(job.data, "customerId");

  if (!companyId || !estimateId || !customerId) {
    logger.warn({ jobId: job.id ?? null }, "Estimate follow-up job missing required identifiers");
    return;
  }

  const rule = await dependencies.findAutomationRule(companyId, "estimate_follow_up");

  if (!rule) {
    logger.info({ companyId, estimateId, customerId }, "Estimate follow-up skipped because automation is disabled");
    return;
  }

  const context = await dependencies.loadEstimateFollowUpContext(companyId, estimateId);

  if (!context || context.customerId !== customerId) {
    logger.warn({ companyId, estimateId, customerId }, "Estimate follow-up skipped because estimate context was not found");
    return;
  }

  if (context.status === "approved" || context.status === "declined") {
    return;
  }

  if (context.status !== "sent" && context.status !== "viewed") {
    return;
  }

  const hoursElapsed = calculateHoursElapsed(context.sentAt);
  const message = await dependencies.generateEstimateFollowUpMessage({
    customerFirstName: context.customerFirstName,
    estimateNumber: context.estimateNumber,
    estimateTotal: context.total,
    companyName: context.company.name
  });
  const headline = `Estimate #${context.estimateNumber} has no response after 24 hours`;
  const recommendation = await createRecommendationIfMissing(
    dependencies,
    {
      companyId,
      type: "unsold_estimate",
      customerId,
      estimateId
    },
    {
      companyId,
      type: "unsold_estimate",
      customerId,
      estimateId,
      estimatedRevenue: estimateRevenue(
        "unsold_estimate",
        { estimateTotal: context.total },
        null
      ),
      headline,
      body: message,
      suggestedAction: "send_sms",
      suggestedMessage: message,
      urgencyScore: computeUrgencyScore("unsold_estimate", { hoursElapsed })
    }
  );

  if (!recommendation) {
    return;
  }

  await dependencies.emitRecommendationCreated({
    companyId,
    recommendationId: recommendation.id,
    customerId,
    estimateId,
    summary: buildRecommendationSummary(headline)
  });
}

export async function handleInvoiceRecoveryCheck(
  job: Job<Record<string, unknown>>,
  dependencies: AiRevenueDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const invoiceId = getJobString(job.data, "invoiceId");
  const customerId = getJobString(job.data, "customerId");

  if (!companyId || !invoiceId || !customerId) {
    logger.warn({ jobId: job.id ?? null }, "Invoice recovery job missing required identifiers");
    return;
  }

  const rule = await dependencies.findAutomationRule(companyId, "invoice_overdue");

  if (!rule) {
    logger.info({ companyId, invoiceId, customerId }, "Invoice recovery skipped because automation is disabled");
    return;
  }

  const context = await dependencies.loadInvoiceRecoveryContext(companyId, invoiceId);

  if (!context || context.customerId !== customerId) {
    logger.warn({ companyId, invoiceId, customerId }, "Invoice recovery skipped because invoice context was not found");
    return;
  }

  if (context.status !== "overdue" || !context.paymentLinkUrl) {
    return;
  }

  const daysOverdue = context.dueAt
    ? Math.max(Math.floor((Date.now() - context.dueAt.getTime()) / (24 * 60 * 60 * 1000)), 0)
    : 1;
  const message = await dependencies.generateInvoiceRecoveryMessage({
    customerFirstName: context.customerFirstName,
    invoiceNumber: context.invoiceNumber,
    balanceDue: context.balanceDue,
    daysOverdue,
    paymentLinkUrl: context.paymentLinkUrl,
    companyName: context.company.name
  });
  const headline = `Invoice #${context.invoiceNumber} is ${daysOverdue} day(s) overdue - $${context.balanceDue} outstanding`;
  const recommendation = await createRecommendationIfMissing(
    dependencies,
    {
      companyId,
      type: "unpaid_invoice",
      customerId,
      invoiceId
    },
    {
      companyId,
      type: "unpaid_invoice",
      customerId,
      invoiceId,
      estimatedRevenue: estimateRevenue(
        "unpaid_invoice",
        { balanceDue: context.balanceDue },
        null
      ),
      headline,
      body: message,
      suggestedAction: "send_sms",
      suggestedMessage: message,
      urgencyScore: computeUrgencyScore("unpaid_invoice", { daysOverdue })
    }
  );

  if (!recommendation) {
    return;
  }

  await dependencies.emitRecommendationCreated({
    companyId,
    recommendationId: recommendation.id,
    customerId,
    invoiceId,
    summary: buildRecommendationSummary(headline)
  });
}

export async function handleComputeRevenueSummary(
  job: Job<Record<string, unknown>>,
  dependencies: AiRevenueDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");

  if (!companyId) {
    logger.warn({ jobId: job.id ?? null }, "Revenue summary job missing companyId");
    return;
  }

  const summary = await dependencies.computeRevenueSummarySnapshot(companyId);
  await dependencies.cacheRevenueSummary(companyId, summary);
  logger.info({ companyId }, "Revenue summary cache refreshed");
}

export async function handleComputeRevenueSummaryBatch(
  _job: Job<Record<string, unknown>>,
  dependencies: AiRevenueDependencies
): Promise<void> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const batchSize = 20;
  let offset = 0;
  let companiesQueued = 0;

  while (true) {
    const companyIds = await dependencies.listActiveCompanyIdsForRevenueSummary(since, offset, batchSize);

    if (companyIds.length === 0) {
      break;
    }

    for (const companyId of companyIds) {
      await dependencies.enqueueRevenueSummary(companyId);
      companiesQueued += 1;
    }

    offset += batchSize;
  }

  logger.info({ companiesQueued }, "Revenue summary batch pre-warm completed");
}

export async function handleDormantCustomerScan(
  _job: Job<Record<string, unknown>>,
  dependencies: AiRevenueDependencies
): Promise<void> {
  let companyOffset = 0;
  const companyBatchSize = 50;
  let companiesScanned = 0;
  let customersFound = 0;
  let recommendationsCreated = 0;

  while (true) {
    const companyIds = await dependencies.listCompanyIds(companyOffset, companyBatchSize);

    if (companyIds.length === 0) {
      break;
    }

    for (const companyId of companyIds) {
      companiesScanned += 1;
      const rule = await dependencies.findAutomationRule(companyId, "dormant_customer");

      if (!rule) {
        continue;
      }

      const thresholdDays = rule.thresholdDays ?? 90;
      let customerOffset = 0;
      const customerBatchSize = 100;

      while (true) {
        const dormantCustomerIds = await dependencies.listDormantCustomerIds(
          companyId,
          thresholdDays,
          customerOffset,
          customerBatchSize
        );

        if (dormantCustomerIds.length === 0) {
          break;
        }

        for (const customerId of dormantCustomerIds) {
          customersFound += 1;
          const context = await dependencies.loadCustomerOpportunityContext(companyId, customerId);

          if (!context || context.doNotContact) {
            continue;
          }

          const daysSinceLastService = calculateDaysSince(context.lastServiceDate);
          const seasonalContext = resolveSeasonalContext(context);
          const message = await dependencies.generateReactivationMessage({
            customerFirstName: context.customerFirstName,
            daysSinceLastService,
            companyName: context.company.name,
            ...(seasonalContext.serviceType ? { serviceType: seasonalContext.serviceType } : {})
          });
          const headline = `Customer hasn't booked in ${daysSinceLastService} days`;
          const customerTicketTotals = context.recentJobs.flatMap((jobRow) =>
            jobRow.invoiceTotal ? [new Decimal(jobRow.invoiceTotal)] : []
          );
          const averageTicket =
            customerTicketTotals.length === 0
              ? context.companyAverageTicket
              : customerTicketTotals
                  .reduce((sum, value) => sum.add(value), new Decimal(0))
                  .div(customerTicketTotals.length)
                  .toFixed(2);
          const recommendation = await createRecommendationIfMissing(
            dependencies,
            {
              companyId,
              type: "reactivation",
              customerId
            },
            {
              companyId,
              type: "reactivation",
              customerId,
              estimatedRevenue: estimateRevenue("reactivation", {}, averageTicket),
              headline,
              body: message,
              suggestedAction: "send_sms",
              suggestedMessage: message,
              urgencyScore: applyUrgencyBonus(
                computeUrgencyScore("reactivation", { daysSinceService: daysSinceLastService }),
                seasonalContext.urgencyBonus
              )
            }
          );

          if (!recommendation) {
            continue;
          }

          recommendationsCreated += 1;
          await dependencies.emitRecommendationCreated({
            companyId,
            recommendationId: recommendation.id,
            customerId,
            summary: buildRecommendationSummary(headline)
          });
        }

        customerOffset += customerBatchSize;
      }
    }

    companyOffset += companyBatchSize;
  }

  logger.info(
    {
      companiesScanned,
      customersFound,
      recommendationsCreated
    },
    "Dormant customer scan completed"
  );
}

export function createAiRevenueProcessor(
  dependencies: AiRevenueDependencies = productionDependencies
): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    switch (job.name) {
      case "evaluate-revenue-opportunities":
        await handleEvaluateRevenueOpportunities(job, dependencies);
        return;
      case "estimate-follow-up-check":
        await handleEstimateFollowUpCheck(job, dependencies);
        return;
      case "invoice-recovery-check":
        await handleInvoiceRecoveryCheck(job, dependencies);
        return;
      case "compute-revenue-summary":
        await handleComputeRevenueSummary(job, dependencies);
        return;
      case "compute-revenue-summary-batch":
        await handleComputeRevenueSummaryBatch(job, dependencies);
        return;
      case "dormant-customer-scan":
        await handleDormantCustomerScan(job, dependencies);
        return;
      case AI_QUEUE_JOB_NAMES.importFileLink:
        await handleImportFileLink(job as Job<ImportFileLinkJobData>);
        return;
      default:
        logger.warn({ jobId: job.id ?? null, jobName: job.name }, "Unknown AI revenue job received");
    }
  };
}

export const processAiRevenue = createAiRevenueProcessor();
