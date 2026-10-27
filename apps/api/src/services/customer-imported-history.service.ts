import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { customers, db, estimates, jobs } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type CustomerImportedHistoryResponse
} from "@fsm/types";

function jobOccurredAt(job: {
  actualEnd: Date | null;
  scheduledStart: Date | null;
  createdAt: Date;
}): Date {
  return job.actualEnd ?? job.scheduledStart ?? job.createdAt;
}

function estimateOccurredAt(estimate: {
  approvedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}): Date {
  return estimate.approvedAt ?? estimate.sentAt ?? estimate.createdAt;
}

export async function getCustomerImportedHistory(
  companyId: string,
  customerId: string
): Promise<CustomerImportedHistoryResponse> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt))
    )
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  const jobRows = await db
    .select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      title: jobs.title,
      status: jobs.status,
      actualEnd: jobs.actualEnd,
      scheduledStart: jobs.scheduledStart,
      createdAt: jobs.createdAt,
      sourceSystem: jobs.sourceSystem,
      sourceId: jobs.sourceId,
      importSessionId: jobs.importSessionId
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        eq(jobs.customerId, customerId),
        isNotNull(jobs.importSessionId),
        isNull(jobs.deletedAt)
      )
    )
    .orderBy(desc(jobs.actualEnd), desc(jobs.scheduledStart), desc(jobs.createdAt))
    .limit(100);

  const estimateRows = await db
    .select({
      id: estimates.id,
      estimateNumber: estimates.estimateNumber,
      title: estimates.title,
      status: estimates.status,
      total: estimates.total,
      approvedAt: estimates.approvedAt,
      sentAt: estimates.sentAt,
      createdAt: estimates.createdAt,
      sourceSystem: estimates.sourceSystem,
      sourceId: estimates.sourceId,
      importSessionId: estimates.importSessionId
    })
    .from(estimates)
    .where(
      and(
        eq(estimates.companyId, companyId),
        eq(estimates.customerId, customerId),
        isNotNull(estimates.importSessionId),
        isNull(estimates.deletedAt)
      )
    )
    .orderBy(desc(estimates.approvedAt), desc(estimates.sentAt), desc(estimates.createdAt))
    .limit(100);

  return {
    customerId,
    jobs: jobRows.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      title: job.title,
      status: job.status,
      occurredAt: jobOccurredAt(job).toISOString(),
      sourceSystem: job.sourceSystem,
      sourceId: job.sourceId,
      importSessionId: job.importSessionId
    })),
    estimates: estimateRows.map((estimate) => ({
      id: estimate.id,
      estimateNumber: estimate.estimateNumber,
      title: estimate.title,
      status: estimate.status,
      total: estimate.total,
      occurredAt: estimateOccurredAt(estimate).toISOString(),
      sourceSystem: estimate.sourceSystem,
      sourceId: estimate.sourceId,
      importSessionId: estimate.importSessionId
    }))
  };
}
