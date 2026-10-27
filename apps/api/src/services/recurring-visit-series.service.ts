import { and, eq, isNull } from "drizzle-orm";

import {
  companies,
  db,
  maintenancePlans,
  maintenanceVisits,
  recurringVisitOccurrences,
  recurringVisitSeries
} from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import {
  localDateTimeToUtc,
  planOccurrenceLocalDates,
  todayLocalDate
} from "./recurring-visit-occurrence.schedule.js";

type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type MaintenancePlanRow = typeof maintenancePlans.$inferSelect;
type MaintenanceVisitRow = typeof maintenanceVisits.$inferSelect;
type RecurringVisitSeriesRow = typeof recurringVisitSeries.$inferSelect;

export const DEFAULT_RECURRING_OCCURRENCE_HORIZON = 6;

export async function resolveCompanyTimeZone(
  companyId: string,
  executor: TransactionExecutor
): Promise<string> {
  const [company] = await executor
    .select({ timezone: companies.timezone })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  return company?.timezone?.trim() || "America/Chicago";
}

export async function getRecurringVisitSeriesForCompany(
  companyId: string,
  seriesId: string,
  executor: TransactionExecutor = db
): Promise<RecurringVisitSeriesRow | null> {
  const [series] = await executor
    .select()
    .from(recurringVisitSeries)
    .where(
      and(
        eq(recurringVisitSeries.companyId, companyId),
        eq(recurringVisitSeries.id, seriesId),
        isNull(recurringVisitSeries.deletedAt)
      )
    )
    .limit(1);

  return series ?? null;
}

type SavepointCapable = TransactionExecutor & {
  transaction?: <T>(fn: (tx: TransactionExecutor) => Promise<T>) => Promise<T>;
};

async function withSavepoint<T>(
  executor: TransactionExecutor,
  fn: (tx: TransactionExecutor) => Promise<T>
): Promise<T> {
  const capable = executor as SavepointCapable;
  return typeof capable.transaction === "function" ? capable.transaction(fn) : fn(executor);
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    if ((current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function findActiveSeriesForPlan(
  companyId: string,
  planId: string,
  executor: TransactionExecutor
): Promise<RecurringVisitSeriesRow | null> {
  const [row] = await executor
    .select()
    .from(recurringVisitSeries)
    .where(
      and(
        eq(recurringVisitSeries.companyId, companyId),
        eq(recurringVisitSeries.maintenancePlanId, planId),
        eq(recurringVisitSeries.status, "active"),
        isNull(recurringVisitSeries.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function ensureRecurringVisitSeriesForMaintenancePlan(
  companyId: string,
  plan: MaintenancePlanRow,
  anchorVisit: MaintenanceVisitRow,
  executor: TransactionExecutor
): Promise<RecurringVisitSeriesRow> {
  const existing = await findActiveSeriesForPlan(companyId, plan.id, executor);
  if (existing) {
    return existing;
  }

  const timeZone = await resolveCompanyTimeZone(companyId, executor);
  // Fallback anchor is "today" in the company's time zone, not UTC.
  const anchorLocalDate = anchorVisit.scheduledDate ?? todayLocalDate(timeZone);

  const values = {
    companyId,
    customerId: plan.customerId,
    propertyId: plan.propertyId,
    maintenancePlanId: plan.id,
    anchorMaintenanceVisitId: anchorVisit.id,
    timeZone,
    frequency: plan.frequency,
    anchorLocalDate,
    status: "active" as const,
    externalSchedulerAuthoritative: false,
    notes: `Series from maintenance plan ${plan.id}`
  };

  let inserted: RecurringVisitSeriesRow[];
  try {
    // Savepoint (when available) so a unique violation does not abort the caller's transaction.
    inserted = await withSavepoint(executor, (tx) => tx.insert(recurringVisitSeries).values(values).returning());
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    // Lost the race: recurring_visit_series_active_plan_uidx (0048) — return the winner's series.
    const winner = await findActiveSeriesForPlan(companyId, plan.id, executor);
    if (winner) {
      return winner;
    }
    throw new AppError(ErrorCode.CONFLICT, "Active recurring visit series already exists for this plan");
  }

  const series = inserted[0];
  if (!series) {
    throw new Error("Failed to create recurring visit series");
  }

  return series;
}

export type GenerateOccurrencesResult = {
  requested: number;
  inserted: number;
  totalActive: number;
};

export async function generateRecurringVisitOccurrences(
  companyId: string,
  seriesId: string,
  count: number,
  executor: TransactionExecutor = db
): Promise<GenerateOccurrencesResult> {
  if (count < 1) {
    return { requested: 0, inserted: 0, totalActive: 0 };
  }

  const series = await getRecurringVisitSeriesForCompany(companyId, seriesId, executor);
  if (!series) {
    throw new Error("Recurring visit series not found for tenant");
  }

  if (series.externalSchedulerAuthoritative) {
    return { requested: count, inserted: 0, totalActive: 0 };
  }

  const localDates = planOccurrenceLocalDates(series.anchorLocalDate, series.frequency, count);
  let inserted = 0;

  for (let occurrenceIndex = 0; occurrenceIndex < localDates.length; occurrenceIndex++) {
    const scheduledLocalDate = localDates[occurrenceIndex];
    if (!scheduledLocalDate) {
      continue;
    }

    const scheduledAtUtc = localDateTimeToUtc(
      scheduledLocalDate,
      series.localTime,
      series.timeZone
    );

    const [existing] = await executor
      .select({ id: recurringVisitOccurrences.id })
      .from(recurringVisitOccurrences)
      .where(
        and(
          eq(recurringVisitOccurrences.companyId, companyId),
          eq(recurringVisitOccurrences.seriesId, series.id),
          eq(recurringVisitOccurrences.occurrenceIndex, occurrenceIndex),
          isNull(recurringVisitOccurrences.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      continue;
    }

    const rows = await executor
      .insert(recurringVisitOccurrences)
      .values({
        companyId,
        seriesId: series.id,
        occurrenceIndex,
        scheduledLocalDate,
        scheduledAtUtc,
        status: "scheduled",
        maintenanceVisitId: occurrenceIndex === 0 ? series.anchorMaintenanceVisitId : null
      })
      .returning({ id: recurringVisitOccurrences.id });

    if (rows.length > 0) {
      inserted += 1;
    }
  }

  const activeRows = await executor
    .select({ id: recurringVisitOccurrences.id })
    .from(recurringVisitOccurrences)
    .where(
      and(
        eq(recurringVisitOccurrences.companyId, companyId),
        eq(recurringVisitOccurrences.seriesId, seriesId),
        isNull(recurringVisitOccurrences.deletedAt)
      )
    );

  return {
    requested: count,
    inserted,
    totalActive: activeRows.length
  };
}
