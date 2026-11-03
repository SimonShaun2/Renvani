import { z } from "zod";

const UuidSchema = z.string().uuid();

/** FS-MIGRATE-M8 — read path for reactivation after `import-chunk-commit` on entity `jobs`. */
export const IMPORT_CHUNK_ENTITY_JOBS = "jobs" as const;

export const M8JobHistoryChunkReadInputSchema = z
  .object({
    importSessionId: UuidSchema,
    lapsedDays: z.number().int().min(1).max(730).default(90),
    asOf: z.coerce.date().optional()
  })
  .strict();

export type M8JobHistoryChunkReadInput = z.infer<typeof M8JobHistoryChunkReadInputSchema>;

export interface M8ImportedJobHistoryRow {
  customerId: string;
  jobId: string;
  serviceCompletedAt: Date | null;
}

export interface M8ReactivationSignal {
  customerId: string;
  lastJobId: string;
  lastServiceCompletedAt: string;
  daysSinceLastService: number;
  ruleFamily: "lapsed_reactivation";
  importSessionId: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenUtc(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Pure read-model for migrated job-history chunks — used by FS-72 reactivation evaluation.
 */
export function deriveM8ReactivationSignalsFromJobHistory(
  rows: M8ImportedJobHistoryRow[],
  input: M8JobHistoryChunkReadInput
): M8ReactivationSignal[] {
  const parsed = M8JobHistoryChunkReadInputSchema.parse(input);
  const asOf = startOfUtcDay(parsed.asOf ?? new Date());
  const importSessionId = parsed.importSessionId;

  const lastByCustomer = new Map<string, { jobId: string; serviceCompletedAt: Date }>();

  for (const row of rows) {
    if (!row.serviceCompletedAt) {
      continue;
    }

    const completedAt = row.serviceCompletedAt;
    const existing = lastByCustomer.get(row.customerId);
    if (!existing || completedAt.getTime() > existing.serviceCompletedAt.getTime()) {
      lastByCustomer.set(row.customerId, { jobId: row.jobId, serviceCompletedAt: completedAt });
    }
  }

  const signals: M8ReactivationSignal[] = [];

  for (const [customerId, last] of lastByCustomer.entries()) {
    const lastDay = startOfUtcDay(last.serviceCompletedAt);
    const daysSinceLastService = daysBetweenUtc(lastDay, asOf);
    if (daysSinceLastService < parsed.lapsedDays) {
      continue;
    }

    signals.push({
      customerId,
      lastJobId: last.jobId,
      lastServiceCompletedAt: lastDay.toISOString(),
      daysSinceLastService,
      ruleFamily: "lapsed_reactivation",
      importSessionId
    });
  }

  signals.sort((left, right) => right.daysSinceLastService - left.daysSinceLastService);
  return signals;
}
