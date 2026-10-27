import { and, eq, isNull } from "drizzle-orm";

import {
  buildPlanCadenceLoyaltyCandidates,
  mapM8ReactivationSignalsToLoyaltyCandidates,
  mergeLoyaltyReminderCandidates,
  type LoyaltyReminderCandidateV1
} from "@fsm/types";

import { db } from "./client.js";
import { listM8ReactivationSignalsFromImportedJobHistory } from "./m8-job-history-reactivation-read.js";
import { customers, maintenancePlans } from "./schema.js";

export interface EvaluateLoyaltyReminderCandidatesInput {
  horizonDays: number;
  importSessionId?: string | null;
  lapsedDays?: number;
  dryRun: boolean;
  customerId?: string | null;
}

export async function evaluateLoyaltyReminderCandidatesForCompany(
  companyId: string,
  input: EvaluateLoyaltyReminderCandidatesInput
): Promise<LoyaltyReminderCandidateV1[]> {
  const horizonDays = Math.min(Math.max(input.horizonDays, 1), 90);
  const lapsedDays = input.lapsedDays ?? 90;

  const [planRows, customerRows] = await Promise.all([
    db
      .select({
        id: maintenancePlans.id,
        customerId: maintenancePlans.customerId,
        propertyId: maintenancePlans.propertyId,
        name: maintenancePlans.name,
        price: maintenancePlans.price,
        nextServiceDate: maintenancePlans.nextServiceDate,
        lastServiceDate: maintenancePlans.lastServiceDate
      })
      .from(maintenancePlans)
      .where(
        and(
          eq(maintenancePlans.companyId, companyId),
          eq(maintenancePlans.status, "active"),
          isNull(maintenancePlans.deletedAt)
        )
      ),
    db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName
      })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
  ]);

  const customerNameById = new Map(
    customerRows.map((row) => [row.id, `${row.firstName} ${row.lastName}`.trim()])
  );

  const planCadence = buildPlanCadenceLoyaltyCandidates(planRows, customerNameById, {
    horizonDays,
    dryRun: input.dryRun
  });

  let merged = planCadence;

  if (input.importSessionId) {
    const m8Signals = await listM8ReactivationSignalsFromImportedJobHistory(companyId, {
      importSessionId: input.importSessionId,
      lapsedDays
    });

    const m8Candidates = mapM8ReactivationSignalsToLoyaltyCandidates(
      m8Signals,
      customerNameById,
      input.dryRun
    );

    merged = mergeLoyaltyReminderCandidates(planCadence, m8Candidates);
  }

  if (input.customerId) {
    return merged.filter((candidate) => candidate.customerId === input.customerId);
  }

  return merged;
}
