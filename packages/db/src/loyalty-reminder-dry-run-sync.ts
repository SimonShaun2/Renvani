import { and, eq, isNull } from "drizzle-orm";

import type { LoyaltyReminderCandidateV1 } from "@fsm/types";

import { db } from "./client.js";
import { emitEvent } from "./events.js";
import { aiRecommendations } from "./schema.js";

function recommendationTypeForCandidate(
  candidate: LoyaltyReminderCandidateV1
): "maintenance_due" | "reactivation" {
  return candidate.ruleFamily === "plan_cadence" ? "maintenance_due" : "reactivation";
}

function headlineForCandidate(candidate: LoyaltyReminderCandidateV1): string {
  if (candidate.ruleFamily === "plan_cadence" && candidate.planName) {
    return `Maintenance reminder: ${candidate.planName}`;
  }

  if (candidate.daysSinceLastService !== null) {
    return `Reactivation: ${candidate.daysSinceLastService} days since last service`;
  }

  return "Loyalty reminder candidate";
}

function bodyForCandidate(candidate: LoyaltyReminderCandidateV1): string {
  if (candidate.ruleFamily === "plan_cadence" && candidate.nextServiceDate) {
    return `Plan visit due on ${candidate.nextServiceDate} (${candidate.daysUntilDue ?? 0} day(s) horizon).`;
  }

  if (candidate.lastServiceDate) {
    return `Last completed service on ${candidate.lastServiceDate}.`;
  }

  return "Eligible for operator-reviewed loyalty reminder (dry-run).";
}

export interface SyncLoyaltyDryRunRecommendationsResult {
  createdCount: number;
  skippedExistingCount: number;
}

/**
 * Idempotent dry-run persistence — surfaces candidates as pending AI recommendations (no outbound send).
 */
export async function syncLoyaltyReminderDryRunRecommendations(
  companyId: string,
  candidates: LoyaltyReminderCandidateV1[]
): Promise<SyncLoyaltyDryRunRecommendationsResult> {
  let createdCount = 0;
  let skippedExistingCount = 0;

  for (const candidate of candidates) {
    const type = recommendationTypeForCandidate(candidate);

    const [existing] = await db
      .select({ id: aiRecommendations.id })
      .from(aiRecommendations)
      .where(
        and(
          eq(aiRecommendations.companyId, companyId),
          eq(aiRecommendations.customerId, candidate.customerId),
          eq(aiRecommendations.type, type),
          eq(aiRecommendations.status, "pending"),
          isNull(aiRecommendations.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      skippedExistingCount += 1;
      continue;
    }

    const inserted = await db
      .insert(aiRecommendations)
      .values({
        companyId,
        type,
        status: "pending",
        customerId: candidate.customerId,
        jobId: candidate.evidenceJobId,
        headline: headlineForCandidate(candidate),
        body: bodyForCandidate(candidate),
        suggestedAction: "schedule_service",
        urgencyScore: candidate.daysUntilDue !== null && candidate.daysUntilDue <= 7 ? 70 : 40,
        sourceEventIds: []
      })
      .returning({ id: aiRecommendations.id });

    const recommendation = inserted[0];
    if (!recommendation) {
      continue;
    }

    createdCount += 1;

    await emitEvent({
      companyId,
      eventType: "ai.recommendation_created",
      actorType: "system",
      entityType: "ai_recommendation",
      entityId: recommendation.id,
      customerId: candidate.customerId,
      summary: headlineForCandidate(candidate),
      payload: {
        loyaltyReminder: {
          ruleFamily: candidate.ruleFamily,
          dryRun: candidate.dryRun,
          maintenancePlanId: candidate.maintenancePlanId,
          evidenceJobId: candidate.evidenceJobId,
          importSessionId: candidate.importSessionId
        }
      }
    });
  }

  return { createdCount, skippedExistingCount };
}
