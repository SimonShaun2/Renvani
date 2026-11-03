import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import type {
  ImportEstimateCommitRow,
  ImportHistoryChunkCommitContext,
  ImportHistoryChunkCommitResult,
  ImportHistoryChunkCommitRowError,
  ImportJobCommitRow,
} from "@fsm/types";

import { db } from "./client.js";
import { emitEventWithExecutor } from "./events.js";
import {
  normalizeImportedEstimateStatus,
  normalizeImportedJobPriority,
  normalizeImportedJobStatus,
  normalizeImportedJobType,
  normalizeOptionalImportMoney,
  resolveImportedJobCompletionTime,
} from "./import-history-chunk.logic.js";
import { customers, estimates, jobs, properties } from "./schema.js";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

export interface ImportHistoryChunkEntityResolver {
  resolveCustomerId(params: {
    customerId?: string;
    customerSourceId?: string;
  }): Promise<string | null>;
  resolveJobId?(params: { jobSourceId: string }): Promise<string | null>;
  resolvePropertyId?(params: { propertySourceId: string }): Promise<string | null>;
}

function pushRowError(
  errors: ImportHistoryChunkCommitRowError[],
  rowNumber: number,
  field: string,
  message: string,
): void {
  errors.push({ rowNumber, field, message });
}

async function findJobByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        eq(jobs.sourceSystem, sourceSystem),
        eq(jobs.sourceId, sourceId),
        isNull(jobs.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function findEstimateByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select()
    .from(estimates)
    .where(
      and(
        eq(estimates.companyId, companyId),
        eq(estimates.sourceSystem, sourceSystem),
        eq(estimates.sourceId, sourceId),
        isNull(estimates.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function commitImportedJobRows(
  ctx: ImportHistoryChunkCommitContext,
  rows: ImportJobCommitRow[],
  resolver: ImportHistoryChunkEntityResolver,
  executor: DbExecutor = db,
): Promise<ImportHistoryChunkCommitResult> {
  const errors: ImportHistoryChunkCommitRowError[] = [];
  let rowsCommitted = 0;
  const now = new Date();

  for (const row of rows) {
    const customerId = await resolver.resolveCustomerId({
      ...(row.customerId !== undefined ? { customerId: row.customerId } : {}),
      ...(row.customerSourceId !== undefined ? { customerSourceId: row.customerSourceId } : {}),
    });

    if (!customerId) {
      pushRowError(errors, row.rowNumber, "customerSourceId", "Customer could not be resolved");
      continue;
    }

    let propertyId: string | null = null;
    if (row.propertySourceId) {
      if (!resolver.resolvePropertyId) {
        const propertyRows = await executor
          .select({ id: properties.id })
          .from(properties)
          .where(
            and(
              eq(properties.companyId, ctx.companyId),
              eq(properties.sourceSystem, ctx.sourceSystem),
              eq(properties.sourceId, row.propertySourceId),
              isNull(properties.deletedAt),
            ),
          )
          .limit(1);
        propertyId = propertyRows[0]?.id ?? null;
      } else {
        propertyId = await resolver.resolvePropertyId({ propertySourceId: row.propertySourceId });
      }

      if (!propertyId) {
        pushRowError(errors, row.rowNumber, "propertySourceId", "Property could not be resolved");
        continue;
      }
    }

    const status = normalizeImportedJobStatus(row.status);
    const type = normalizeImportedJobType(row.type);
    const priority = normalizeImportedJobPriority(row.priority);
    const completionTime = resolveImportedJobCompletionTime({
      actualEnd: row.actualEnd ?? null,
      scheduledEnd: row.scheduledEnd ?? null,
      scheduledStart: row.scheduledStart ?? null,
    });

    const sharedValues = {
      jobNumber: row.jobNumber,
      customerId,
      propertyId,
      type,
      priority,
      status,
      leadSource: row.leadSource ?? null,
      title: row.title,
      description: row.description ?? null,
      scheduledStart: row.scheduledStart ?? null,
      scheduledEnd: row.scheduledEnd ?? null,
      actualStart: row.actualStart ?? null,
      actualEnd: row.actualEnd ?? completionTime,
      estimateTotal: normalizeOptionalImportMoney(row.estimateTotal),
      invoiceTotal: normalizeOptionalImportMoney(row.invoiceTotal),
      amountPaid: normalizeOptionalImportMoney(row.amountPaid),
      sourceSystem: ctx.sourceSystem,
      sourceId: row.sourceId,
      importSessionId: ctx.importSessionId,
      updatedAt: now,
    };

    const existing = await findJobByLineage(executor, ctx.companyId, ctx.sourceSystem, row.sourceId);

    if (existing) {
      await executor
        .update(jobs)
        .set(sharedValues)
        .where(and(eq(jobs.companyId, ctx.companyId), eq(jobs.id, existing.id)));
      rowsCommitted += 1;
      continue;
    }

    const jobId = randomUUID();
    await executor.insert(jobs).values({
      id: jobId,
      companyId: ctx.companyId,
      ...sharedValues,
      createdAt: now,
    });

    await emitEventWithExecutor(executor, {
      companyId: ctx.companyId,
      actorId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "system",
      eventType: status === "completed" || status === "closed" || status === "paid" ? "job.completed" : "job.created",
      entityType: "job",
      entityId: jobId,
      customerId,
      jobId,
      occurredAt: completionTime ?? undefined,
      summary:
        status === "completed" || status === "closed" || status === "paid"
          ? `Imported historical job ${row.jobNumber} marked completed`
          : `Imported historical job ${row.jobNumber}`,
      payload: {
        importSessionId: ctx.importSessionId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        scheduledStart: row.scheduledStart?.toISOString() ?? null,
        actualEnd: sharedValues.actualEnd?.toISOString() ?? null,
      },
    });

    rowsCommitted += 1;
  }

  return {
    rowsCommitted,
    rowsFailed: errors.length,
    errors,
  };
}

export async function commitImportedEstimateRows(
  ctx: ImportHistoryChunkCommitContext,
  rows: ImportEstimateCommitRow[],
  resolver: ImportHistoryChunkEntityResolver,
  executor: DbExecutor = db,
): Promise<ImportHistoryChunkCommitResult> {
  const errors: ImportHistoryChunkCommitRowError[] = [];
  let rowsCommitted = 0;
  const now = new Date();

  for (const row of rows) {
    const customerId = await resolver.resolveCustomerId({
      ...(row.customerId !== undefined ? { customerId: row.customerId } : {}),
      ...(row.customerSourceId !== undefined ? { customerSourceId: row.customerSourceId } : {}),
    });

    if (!customerId) {
      pushRowError(errors, row.rowNumber, "customerSourceId", "Customer could not be resolved");
      continue;
    }

    let jobId: string | null = null;
    if (row.jobSourceId) {
      if (!resolver.resolveJobId) {
        const jobRows = await executor
          .select({ id: jobs.id })
          .from(jobs)
          .where(
            and(
              eq(jobs.companyId, ctx.companyId),
              eq(jobs.sourceSystem, ctx.sourceSystem),
              eq(jobs.sourceId, row.jobSourceId),
              isNull(jobs.deletedAt),
            ),
          )
          .limit(1);
        jobId = jobRows[0]?.id ?? null;
      } else {
        jobId = await resolver.resolveJobId({ jobSourceId: row.jobSourceId });
      }

      if (!jobId) {
        pushRowError(errors, row.rowNumber, "jobSourceId", "Job could not be resolved");
        continue;
      }
    }

    const status = normalizeImportedEstimateStatus(row.status);
    const subtotal = normalizeOptionalImportMoney(row.subtotal) ?? normalizeOptionalImportMoney(row.total);
    const total = normalizeOptionalImportMoney(row.total);

    if (!total) {
      pushRowError(errors, row.rowNumber, "total", "Invalid estimate total");
      continue;
    }

    const sharedValues = {
      estimateNumber: row.estimateNumber,
      customerId,
      jobId,
      status,
      title: row.title ?? null,
      subtotal: subtotal ?? total,
      total,
      taxRate: "0.0000",
      taxAmount: "0.00",
      discountAmount: "0.00",
      sentAt: row.sentAt ?? null,
      approvedAt: row.approvedAt ?? null,
      declinedAt: row.declinedAt ?? null,
      expiresAt: row.expiresAt ?? null,
      approvedByName: row.approvedByName ?? null,
      sourceSystem: ctx.sourceSystem,
      sourceId: row.sourceId,
      importSessionId: ctx.importSessionId,
      updatedAt: now,
    };

    const existing = await findEstimateByLineage(
      executor,
      ctx.companyId,
      ctx.sourceSystem,
      row.sourceId,
    );

    if (existing) {
      await executor
        .update(estimates)
        .set(sharedValues)
        .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.id, existing.id)));
      rowsCommitted += 1;
      continue;
    }

    const estimateId = randomUUID();
    await executor.insert(estimates).values({
      id: estimateId,
      companyId: ctx.companyId,
      ...sharedValues,
      createdAt: now,
    });

    const estimateEventType =
      status === "approved"
        ? "estimate.approved"
        : status === "declined"
          ? "estimate.declined"
          : status === "sent" || status === "viewed"
            ? "estimate.sent"
            : "estimate.created";

    await emitEventWithExecutor(executor, {
      companyId: ctx.companyId,
      actorId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "system",
      eventType: estimateEventType,
      entityType: "estimate",
      entityId: estimateId,
      customerId,
      jobId: jobId ?? undefined,
      estimateId,
      occurredAt: row.approvedAt ?? row.sentAt ?? undefined,
      summary: `Imported historical estimate ${row.estimateNumber}`,
      payload: {
        importSessionId: ctx.importSessionId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        sentAt: row.sentAt?.toISOString() ?? null,
        approvedAt: row.approvedAt?.toISOString() ?? null,
      },
    });

    rowsCommitted += 1;
  }

  return {
    rowsCommitted,
    rowsFailed: errors.length,
    errors,
  };
}

export async function createDbHistoryChunkResolver(
  companyId: string,
  sourceSystem: string,
  executor: DbExecutor = db,
): Promise<ImportHistoryChunkEntityResolver> {
  return {
    async resolveCustomerId({ customerId, customerSourceId }) {
      if (customerId) {
        return customerId;
      }

      if (!customerSourceId) {
        return null;
      }

      const rows = await executor
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, companyId),
            eq(customers.sourceSystem, sourceSystem),
            eq(customers.sourceId, customerSourceId),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);

      return rows[0]?.id ?? null;
    },
    async resolveJobId({ jobSourceId }) {
      const rows = await executor
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.companyId, companyId),
            eq(jobs.sourceSystem, sourceSystem),
            eq(jobs.sourceId, jobSourceId),
            isNull(jobs.deletedAt),
          ),
        )
        .limit(1);

      return rows[0]?.id ?? null;
    },
    async resolvePropertyId({ propertySourceId }) {
      const rows = await executor
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.companyId, companyId),
            eq(properties.sourceSystem, sourceSystem),
            eq(properties.sourceId, propertySourceId),
            isNull(properties.deletedAt),
          ),
        )
        .limit(1);

      return rows[0]?.id ?? null;
    },
  };
}
