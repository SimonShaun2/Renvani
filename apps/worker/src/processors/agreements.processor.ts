import type { Job, Processor } from "bullmq";
import pino from "pino";
import { and, eq, isNull } from "drizzle-orm";

import {
  aiRecommendations,
  automationRules,
  companies,
  customers,
  db,
  emitEvent,
  maintenancePlans,
  serviceAgreementTemplates
} from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";
import { LOYALTY_AGREEMENTS_JOB_NAMES } from "@fsm/types";

import { processEvaluateLoyaltyReminderCandidates } from "./loyalty-reminder-candidates.processor.js";

const logger = pino({
  name: "agreements-processor"
});

type MaintenancePlanStatus = (typeof maintenancePlans.$inferSelect)["status"];

interface AgreementPlanContext {
  id: string;
  companyId: string;
  customerId: string;
  propertyId: string | null;
  name: string;
  price: string | null;
  status: MaintenancePlanStatus;
  nextServiceDate: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
  };
  company: {
    name: string;
  };
  template: {
    name: string;
  } | null;
}

interface PendingRecommendationContext {
  id: string;
}

interface CreatedRecommendation {
  id: string;
}

interface AgreementAutomationRule {
  companyId: string;
}

export interface AgreementsDependencies {
  /** Test hook; production loads the API's scanAllPlanReminders from api/dist. */
  scanPlanReminders?: () => Promise<{ companies: number; dispatched: number }>;
  loadPlan(companyId: string, maintenancePlanId: string): Promise<AgreementPlanContext | null>;
  findAutomationRule(
    companyId: string,
    ruleType: (typeof automationRules.$inferSelect)["ruleType"]
  ): Promise<AgreementAutomationRule | null>;
  findPendingMaintenanceDueRecommendation(
    companyId: string,
    customerId: string,
    propertyId: string | null
  ): Promise<PendingRecommendationContext | null>;
  createMaintenanceDueRecommendation(input: {
    companyId: string;
    customerId: string;
    propertyId: string | null;
    headline: string;
    body: string;
    estimatedRevenue: string | null;
    urgencyScore: number;
  }): Promise<CreatedRecommendation>;
  emitRecommendationCreated(input: {
    companyId: string;
    recommendationId: string;
    customerId: string;
    summary: string;
  }): Promise<void>;
  enqueueRenewalReminder(input: { companyId: string; maintenancePlanId: string }): Promise<void>;
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

function calculateDaysUntilDue(nextServiceDate: string): number {
  const dueDate = parseDateOnly(nextServiceDate);
  return Math.floor((dueDate.getTime() - getTodayUtcDate().getTime()) / (24 * 60 * 60 * 1000));
}

function calculateUrgencyScore(daysUntilDue: number): number {
  if (daysUntilDue <= 0) {
    return 90;
  }

  if (daysUntilDue <= 7) {
    return 60;
  }

  return 30;
}

const productionDependencies: AgreementsDependencies = {
  async loadPlan(companyId, maintenancePlanId) {
    const [plan] = await db
      .select()
      .from(maintenancePlans)
      .where(
        and(
          eq(maintenancePlans.companyId, companyId),
          eq(maintenancePlans.id, maintenancePlanId),
          isNull(maintenancePlans.deletedAt)
        )
      )
      .limit(1);

    if (!plan) {
      return null;
    }

    const [customer, company, template] = await Promise.all([
      db
        .select()
        .from(customers)
        .where(and(eq(customers.companyId, companyId), eq(customers.id, plan.customerId), isNull(customers.deletedAt)))
        .limit(1),
      db
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
        .limit(1),
      plan.serviceAgreementTemplateId
        ? db
            .select()
            .from(serviceAgreementTemplates)
            .where(
              and(
                eq(serviceAgreementTemplates.companyId, companyId),
                eq(serviceAgreementTemplates.id, plan.serviceAgreementTemplateId),
                isNull(serviceAgreementTemplates.deletedAt)
              )
            )
            .limit(1)
        : Promise.resolve([])
    ]);

    const customerRecord = customer[0];
    const companyRecord = company[0];
    const templateRecord = template[0] ?? null;

    if (!customerRecord || !companyRecord) {
      return null;
    }

    return {
      id: plan.id,
      companyId,
      customerId: plan.customerId,
      propertyId: plan.propertyId,
      name: plan.name,
      price: plan.price,
      status: plan.status,
      nextServiceDate: plan.nextServiceDate,
      customer: {
        firstName: customerRecord.firstName,
        lastName: customerRecord.lastName,
        email: customerRecord.email
      },
      company: {
        name: companyRecord.name
      },
      template: templateRecord
        ? {
            name: templateRecord.name
          }
        : null
    };
  },
  async findAutomationRule(companyId, ruleType) {
    const [rule] = await db
      .select({
        companyId: automationRules.companyId
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
  async findPendingMaintenanceDueRecommendation(companyId, customerId, propertyId) {
    const [recommendation] = await db
      .select({
        id: aiRecommendations.id
      })
      .from(aiRecommendations)
      .where(
        and(
          eq(aiRecommendations.companyId, companyId),
          eq(aiRecommendations.customerId, customerId),
          eq(aiRecommendations.type, "maintenance_due"),
          eq(aiRecommendations.status, "pending"),
          propertyId ? eq(aiRecommendations.propertyId, propertyId) : isNull(aiRecommendations.propertyId),
          isNull(aiRecommendations.deletedAt)
        )
      )
      .limit(1);

    return recommendation ?? null;
  },
  async createMaintenanceDueRecommendation(input) {
    const insertedRecommendations = await db
      .insert(aiRecommendations)
      .values({
        companyId: input.companyId,
        type: "maintenance_due",
        status: "pending",
        customerId: input.customerId,
        propertyId: input.propertyId,
        estimatedRevenue: input.estimatedRevenue,
        headline: input.headline,
        body: input.body,
        suggestedAction: "schedule_service",
        urgencyScore: input.urgencyScore,
        sourceEventIds: []
      })
      .returning({
        id: aiRecommendations.id
      });

    const recommendation = insertedRecommendations[0];

    if (!recommendation) {
      throw new Error("Failed to create maintenance due recommendation");
    }

    return recommendation;
  },
  async emitRecommendationCreated(input) {
    await emitEvent({
      companyId: input.companyId,
      eventType: "ai.recommendation_created",
      actorType: "ai",
      entityType: "ai_recommendation",
      entityId: input.recommendationId,
      customerId: input.customerId,
      summary: input.summary,
      payload: {}
    });
  },
  async enqueueRenewalReminder(input) {
    await notificationsQueue.add(
      "send-service-agreement-email",
      {
        companyId: input.companyId,
        maintenancePlanId: input.maintenancePlanId,
        emailType: "renewal_reminder"
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        jobId: `service-agreement-renewal-email-${input.maintenancePlanId}`
      }
    );
  }
};

export const PLAN_REMINDER_SCAN_JOB_NAME = "plan-reminder-scan";

async function loadAndScanPlanReminders(): Promise<{ companies: number; dispatched: number }> {
  const moduleUrl = new URL("../../../api/dist/services/plan-reminders/plan-reminder.service.js", import.meta.url);
  const mod = (await import(moduleUrl.href)) as { scanAllPlanReminders(): Promise<{ companies: number; dispatched: number }> };
  return mod.scanAllPlanReminders();
}

export async function handleServiceAgreementRenewalCheck(
  job: Job<Record<string, unknown>>,
  dependencies: AgreementsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const maintenancePlanId = getJobString(job.data, "planId") ?? getJobString(job.data, "maintenancePlanId");

  if (!companyId || !maintenancePlanId) {
    logger.warn({ jobId: job.id ?? null }, "Service agreement renewal job missing required identifiers");
    return;
  }

  const plan = await dependencies.loadPlan(companyId, maintenancePlanId);

  if (!plan || plan.status === "cancelled" || plan.status === "expired" || !plan.nextServiceDate) {
    logger.info({ companyId, maintenancePlanId }, "Service agreement renewal job skipped because plan is not eligible");
    return;
  }

  const daysUntilDue = calculateDaysUntilDue(plan.nextServiceDate);

  if (daysUntilDue > 14) {
    logger.info({ companyId, maintenancePlanId, daysUntilDue }, "Service agreement renewal job skipped because service is not yet due soon");
    return;
  }

  const [maintenanceDueRule, renewalEmailRule] = await Promise.all([
    dependencies.findAutomationRule(companyId, "maintenance_due"),
    dependencies.findAutomationRule(companyId, "service_agreement_renewal")
  ]);

  if (maintenanceDueRule) {
    const existingRecommendation = await dependencies.findPendingMaintenanceDueRecommendation(
      companyId,
      plan.customerId,
      plan.propertyId
    );

    if (!existingRecommendation) {
      const headline = `Service due for ${plan.customer.firstName} ${plan.customer.lastName} - ${plan.template?.name ?? plan.name}`;
      const recommendation = await dependencies.createMaintenanceDueRecommendation({
        companyId,
        customerId: plan.customerId,
        propertyId: plan.propertyId,
        headline,
        body: `${plan.template?.name ?? plan.name} is due within ${Math.max(daysUntilDue, 0)} day(s).`,
        estimatedRevenue: plan.price,
        urgencyScore: calculateUrgencyScore(daysUntilDue)
      });

      await dependencies.emitRecommendationCreated({
        companyId,
        recommendationId: recommendation.id,
        customerId: plan.customerId,
        summary: `AI recommendation created for ${plan.customer.firstName} ${plan.customer.lastName}`
      });
    }
  }

  if (renewalEmailRule) {
    await dependencies.enqueueRenewalReminder({
      companyId,
      maintenancePlanId
    });
  }
}

export function createAgreementsProcessor(
  dependencies: AgreementsDependencies = productionDependencies
): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    if (job.name === LOYALTY_AGREEMENTS_JOB_NAMES.evaluateReminderCandidates) {
      await processEvaluateLoyaltyReminderCandidates(
        job as unknown as import("bullmq").Job<
          import("@fsm/types").EvaluateLoyaltyReminderCandidatesJobData
        >
      );
      return;
    }

    if (job.name === PLAN_REMINDER_SCAN_JOB_NAME) {
      const result = await (dependencies.scanPlanReminders ?? loadAndScanPlanReminders)();
      logger.info(result, "Plan reminder scan finished");
      return;
    }

    if (job.name !== "service-agreement-renewal-check") {
      logger.warn({ jobId: job.id ?? null, jobName: job.name }, "Unknown agreements job received");
      return;
    }

    await handleServiceAgreementRenewalCheck(job, dependencies);
  };
}

export const processAgreements = createAgreementsProcessor();
