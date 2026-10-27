import {
  createOrGetIntegrationOutboxOperation,
  getIntegrationOutboxOperationById,
  listIntegrationOutboxAuditEvents,
  listIntegrationOutboxOperations,
  recordIntegrationOutboxRetryReceipt,
  type CreateIntegrationOutboxOperationInput
} from "@fsm/db";
import type { IntegrationOutboxRetryReceipt } from "@fsm/types";
import { AppError, ErrorCode } from "@fsm/types";

export async function getIntegrationOutboxOperationsForCompany(
  companyId: string,
  query: { correlationId?: string; limit?: number }
) {
  const operations = await listIntegrationOutboxOperations(companyId, query);
  return operations.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

export async function getIntegrationOutboxAuditTrail(
  companyId: string,
  outboxOperationId: string,
  limit?: number
) {
  const operation = await getIntegrationOutboxOperationById(companyId, outboxOperationId);
  if (!operation) {
    throw new AppError(ErrorCode.NOT_FOUND, "Integration outbox operation not found");
  }

  const events = await listIntegrationOutboxAuditEvents(companyId, {
    outboxOperationId,
    ...(limit !== undefined ? { limit } : {})
  });

  return events.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function enqueueIntegrationOutboxOperation(
  companyId: string,
  input: CreateIntegrationOutboxOperationInput
) {
  const result = await createOrGetIntegrationOutboxOperation(companyId, input);
  return {
    created: result.created,
    operation: {
      ...result.operation,
      createdAt: result.operation.createdAt.toISOString(),
      updatedAt: result.operation.updatedAt.toISOString()
    }
  };
}

export async function recordIntegrationOutboxRetry(
  companyId: string,
  outboxOperationId: string,
  receipt: IntegrationOutboxRetryReceipt
) {
  try {
    const result = await recordIntegrationOutboxRetryReceipt(companyId, outboxOperationId, receipt);
    return {
      deduplicated: result.deduplicated,
      auditEvent: {
        ...result.auditEvent,
        createdAt: result.auditEvent.createdAt.toISOString()
      }
    };
  } catch (error) {
    if (error instanceof Error && error.message === "INTEGRATION_OUTBOX_NOT_FOUND") {
      throw new AppError(ErrorCode.NOT_FOUND, "Integration outbox operation not found");
    }
    throw error;
  }
}
