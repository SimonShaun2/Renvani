import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  deriveM8ReactivationSignalsFromJobHistory,
  type M8JobHistoryChunkReadInput,
  type M8ReactivationSignal
} from "@fsm/types";

import { db } from "./client.js";
import { jobs } from "./schema.js";

const COMPLETED_JOB_STATUSES = ["completed", "invoiced", "paid", "closed"] as const;

function resolveServiceCompletedAt(actualEnd: Date | null, scheduledStart: Date | null): Date | null {
  if (actualEnd) {
    return actualEnd;
  }
  return scheduledStart;
}

/** FS-MIGRATE-M8 — tenant-scoped read of imported job history for reactivation signals. */
export async function listM8ReactivationSignalsFromImportedJobHistory(
  companyId: string,
  input: M8JobHistoryChunkReadInput
): Promise<M8ReactivationSignal[]> {
  const rows = await db
    .select({
      customerId: jobs.customerId,
      jobId: jobs.id,
      actualEnd: jobs.actualEnd,
      scheduledStart: jobs.scheduledStart
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        eq(jobs.importSessionId, input.importSessionId),
        inArray(jobs.status, [...COMPLETED_JOB_STATUSES]),
        isNull(jobs.deletedAt)
      )
    );

  return deriveM8ReactivationSignalsFromJobHistory(
    rows.map((row) => ({
      customerId: row.customerId,
      jobId: row.jobId,
      serviceCompletedAt: resolveServiceCompletedAt(row.actualEnd, row.scheduledStart)
    })),
    input
  );
}
