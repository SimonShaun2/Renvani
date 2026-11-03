import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import type {
  ImportCommunicationCommitRow,
  ImportCommunicationsCommitContext,
  ImportCommunicationsCommitResult,
  ImportCommunicationsCommitRowError,
} from "@fsm/types";

import { db } from "./client.js";
import { emitEventWithExecutor } from "./events.js";
import { customers, jobs, messageLogs } from "./schema.js";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

export interface ImportCommunicationsEntityResolver {
  resolveCustomerId(params: {
    customerId?: string;
    customerSourceId?: string;
  }): Promise<string | null>;
  resolveJobId?(params: { jobSourceId: string }): Promise<string | null>;
}

async function findCustomerByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.companyId, companyId),
        eq(customers.sourceSystem, sourceSystem),
        eq(customers.sourceId, sourceId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

async function findJobByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select({ id: jobs.id, customerId: jobs.customerId })
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

async function findMessageByLineage(
  executor: DbExecutor,
  companyId: string,
  sourceSystem: string,
  sourceId: string,
) {
  const rows = await executor
    .select({ id: messageLogs.id })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.companyId, companyId),
        eq(messageLogs.sourceSystem, sourceSystem),
        eq(messageLogs.sourceId, sourceId),
        isNull(messageLogs.deletedAt),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}

function pushRowError(
  errors: ImportCommunicationsCommitRowError[],
  rowNumber: number,
  field: string,
  message: string,
): void {
  errors.push({ rowNumber, field, message });
}

export async function commitImportedCommunicationRows(
  ctx: ImportCommunicationsCommitContext,
  rows: ImportCommunicationCommitRow[],
  resolver: ImportCommunicationsEntityResolver,
  executor: DbExecutor = db,
): Promise<ImportCommunicationsCommitResult> {
  const errors: ImportCommunicationsCommitRowError[] = [];
  let messagesCommitted = 0;
  const now = new Date();

  for (const row of rows) {
    let customerId: string | null = null;
    if (row.customerId) {
      customerId = row.customerId;
    } else if (row.customerSourceId) {
      customerId = await resolver.resolveCustomerId({
        customerSourceId: row.customerSourceId,
      });
      if (!customerId) {
        customerId = await findCustomerByLineage(
          executor,
          ctx.companyId,
          ctx.sourceSystem,
          row.customerSourceId,
        );
      }
    }

    let jobId: string | null = null;
    if (row.jobSourceId) {
      if (resolver.resolveJobId) {
        jobId = await resolver.resolveJobId({ jobSourceId: row.jobSourceId });
      }
      if (!jobId) {
        const job = await findJobByLineage(executor, ctx.companyId, ctx.sourceSystem, row.jobSourceId);
        jobId = job?.id ?? null;
        if (!customerId && job?.customerId) {
          customerId = job.customerId;
        }
      }
    }

    const sentAt = row.sentAt ?? now;
    const existingId = await findMessageByLineage(executor, ctx.companyId, ctx.sourceSystem, row.sourceId);

    const messageValues = {
      customerId,
      jobId,
      channel: row.channel,
      direction: row.direction,
      toAddress: row.toAddress,
      fromAddress: row.fromAddress ?? null,
      subject: row.subject ?? null,
      body: row.body,
      providerMessageId: row.providerMessageId ?? null,
      providerStatus: row.providerStatus ?? "imported",
      sentAt,
      deliveredAt: row.direction === "outbound" ? sentAt : null,
      importSessionId: ctx.importSessionId,
      updatedAt: now,
    };

    let messageLogId: string;

    if (existingId) {
      messageLogId = existingId;
      await executor
        .update(messageLogs)
        .set(messageValues)
        .where(and(eq(messageLogs.companyId, ctx.companyId), eq(messageLogs.id, existingId)));
    } else {
      messageLogId = randomUUID();
      await executor.insert(messageLogs).values({
        id: messageLogId,
        companyId: ctx.companyId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        createdAt: now,
        ...messageValues,
      });
    }

    const eventType = row.direction === "inbound" ? "message.received" : "message.sent";

    await emitEventWithExecutor(executor, {
      companyId: ctx.companyId,
      actorId: ctx.actorId,
      actorType: ctx.actorId ? "user" : "system",
      eventType,
      entityType: "message_log",
      entityId: messageLogId,
      customerId: customerId ?? undefined,
      jobId: jobId ?? undefined,
      summary:
        row.direction === "inbound"
          ? `Imported inbound ${row.channel} message from migration`
          : `Imported outbound ${row.channel} message from migration`,
      payload: {
        importSessionId: ctx.importSessionId,
        sourceSystem: ctx.sourceSystem,
        sourceId: row.sourceId,
        channel: row.channel,
        sentAt: sentAt.toISOString(),
      },
    });

    messagesCommitted += 1;
  }

  return {
    messagesCommitted,
    rowsFailed: errors.length,
    errors,
  };
}

export function resolveSourceSystemForCommunicationsImport(
  presetId: string | null | undefined,
): string {
  switch (presetId) {
    case "jobber":
      return "jobber";
    case "housecall_pro":
      return "housecall_pro";
    case "service_titan":
      return "servicetitan";
    case "service_fusion":
      return "service_fusion";
    case "quickbooks_invoices":
    case "quickbooks_customers":
      return "qbo";
    case "quickbooks_desktop_customers":
      return "qbd";
    default:
      return "manual_csv";
  }
}
