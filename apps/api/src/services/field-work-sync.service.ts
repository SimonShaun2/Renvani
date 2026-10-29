import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  db,
  emitEventWithExecutor,
  fieldSyncBatches,
  fileAttachments,
  fieldSyncOperations,
  jobs,
  jobTasks,
  technicians
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  FIELD_WORK_SYNC_CONTRACT_VERSION,
  type FieldWorkSyncOperationInput,
  type FieldWorkSyncOperationOutcome,
  type SubmitFieldWorkSyncBatchBody,
  type SubmitFieldWorkSyncBatchResponse,
  buildFieldWorkSyncVersionConflict,
  buildRecordVersionV1,
  isStaleRecordVersion,
  resolveFieldWorkSyncClientOperationReplay,
  validateJobTaskBaseRecordVersion,
  type UserRole
} from "@fsm/types";

import {
  isJobSignatureObjectRef,
  resolveTenantAttachmentObjectKey,
  toJobSignatureObjectRef
} from "../lib/job-signature-ref.js";

import { addNote, addPhoto, transitionStatus } from "./job.service.js";
import { updateTask } from "./job-tasks.service.js";

type BatchRow = typeof fieldSyncBatches.$inferSelect;
type OperationRow = typeof fieldSyncOperations.$inferSelect;

export interface FieldWorkSyncActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

export const SIGNATURE_ATTACHMENT_INVALID = "SIGNATURE_ATTACHMENT_INVALID";
const SIGNATURE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Signatures are small line drawings; anything larger is not a signature pad export. */
const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;

type SignatureCapturePayload = {
  attachmentId?: string | undefined;
  signatureUrl?: string | undefined;
  signedByName: string;
};

async function resolveSignatureCaptureValue(
  companyId: string,
  jobId: string,
  payload: SignatureCapturePayload
): Promise<{ ok: true; value: string } | { ok: false; message: string }> {
  if (!payload.attachmentId) {
    return payload.signatureUrl
      ? { ok: true, value: payload.signatureUrl }
      : { ok: false, message: "Provide exactly one of attachmentId or signatureUrl" };
  }

  // Same generic message for missing / other job / other tenant: no existence leak.
  const notUsable = { ok: false as const, message: "Signature attachment not found on this job" };
  const [attachment] = await db
    .select()
    .from(fileAttachments)
    .where(
      and(
        eq(fileAttachments.companyId, companyId),
        eq(fileAttachments.id, payload.attachmentId),
        isNull(fileAttachments.deletedAt)
      )
    )
    .limit(1);

  if (!attachment || attachment.companyId !== companyId) {
    return notUsable;
  }
  const onJob = attachment.jobId === jobId || (attachment.entityType === "job" && attachment.entityId === jobId);
  if (!onJob) {
    return notUsable;
  }
  if (!attachment.mimeType || !SIGNATURE_IMAGE_MIME_TYPES.has(attachment.mimeType)) {
    return { ok: false, message: "Signature attachment must be a PNG, JPEG, or WebP image" };
  }
  if (!attachment.fileSizeBytes || attachment.fileSizeBytes <= 0 || attachment.fileSizeBytes > MAX_SIGNATURE_BYTES) {
    return { ok: false, message: "Signature attachment size is invalid" };
  }
  const objectKey = resolveTenantAttachmentObjectKey(companyId, attachment.fileUrl);
  if (!objectKey) {
    return notUsable;
  }
  return { ok: true, value: toJobSignatureObjectRef(objectKey) };
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toOperationResult(row: OperationRow) {
  const resultPayload = row.resultPayload as Record<string, unknown>;
  return {
    clientOperationId: row.clientOperationId,
    sequence: row.sequence,
    outcome: row.outcome as FieldWorkSyncOperationOutcome,
    serverOperationId: row.id,
    recordVersion: typeof resultPayload.recordVersion === "string" ? resultPayload.recordVersion : undefined,
    entityId: typeof resultPayload.entityId === "string" ? resultPayload.entityId : undefined,
    message: typeof resultPayload.message === "string" ? resultPayload.message : undefined,
    code: typeof resultPayload.code === "string" ? resultPayload.code : undefined,
    conflict:
      resultPayload.conflict && typeof resultPayload.conflict === "object"
        ? (resultPayload.conflict as { liveRecordVersion: string; reason: string })
        : undefined
  };
}

async function assertJobFieldAccess(
  companyId: string,
  userId: string,
  role: UserRole,
  jobId: string
): Promise<void> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  if (role === "owner" || role === "admin" || role === "dispatcher") {
    return;
  }

  if (role === "technician") {
    const [technician] = await db
      .select()
      .from(technicians)
      .where(
        and(eq(technicians.companyId, companyId), eq(technicians.userId, userId), isNull(technicians.deletedAt))
      )
      .limit(1);

    if (!technician || job.technicianId !== technician.id) {
      throw new AppError(ErrorCode.FORBIDDEN, "You are not authorized to sync work for this job");
    }

    return;
  }

  throw new AppError(ErrorCode.FORBIDDEN, "You are not authorized to sync field work");
}

async function findExistingOperation(
  companyId: string,
  clientOperationId: string
): Promise<OperationRow | null> {
  const [row] = await db
    .select()
    .from(fieldSyncOperations)
    .where(
      and(
        eq(fieldSyncOperations.companyId, companyId),
        eq(fieldSyncOperations.clientOperationId, clientOperationId),
        isNull(fieldSyncOperations.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

async function resolveBatch(
  actor: FieldWorkSyncActor,
  input: SubmitFieldWorkSyncBatchBody
): Promise<BatchRow> {
  if (input.resumeBatchId) {
    const [resumed] = await db
      .select()
      .from(fieldSyncBatches)
      .where(
        and(
          eq(fieldSyncBatches.id, input.resumeBatchId),
          eq(fieldSyncBatches.companyId, actor.companyId),
          eq(fieldSyncBatches.userId, actor.userId),
          eq(fieldSyncBatches.deviceId, input.deviceId),
          isNull(fieldSyncBatches.deletedAt)
        )
      )
      .limit(1);

    if (!resumed) {
      throw new AppError(ErrorCode.NOT_FOUND, "Sync batch not found for resume");
    }

    if (resumed.batchClientId !== input.batchClientId) {
      throw new AppError(ErrorCode.CONFLICT, "batchClientId does not match resumed batch");
    }

    return resumed;
  }

  const [existing] = await db
    .select()
    .from(fieldSyncBatches)
    .where(
      and(
        eq(fieldSyncBatches.companyId, actor.companyId),
        eq(fieldSyncBatches.deviceId, input.deviceId),
        eq(fieldSyncBatches.batchClientId, input.batchClientId),
        isNull(fieldSyncBatches.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const inserted = await db
    .insert(fieldSyncBatches)
    .values({
      companyId: actor.companyId,
      userId: actor.userId,
      deviceId: input.deviceId,
      batchClientId: input.batchClientId,
      status: "open",
      lastAcknowledgedSequence: 0
    })
    .returning();

  const batch = inserted[0];
  if (!batch) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create sync batch");
  }

  return batch;
}

async function applyOperation(
  actor: FieldWorkSyncActor,
  operation: FieldWorkSyncOperationInput
): Promise<{
  outcome: FieldWorkSyncOperationOutcome;
  resultPayload: Record<string, unknown>;
}> {
  await assertJobFieldAccess(actor.companyId, actor.userId, actor.role, operation.jobId);

  switch (operation.type) {
    case "job.note.append": {
      const note = await addNote(actor.companyId, actor.userId, operation.jobId, {
        content: operation.payload.content,
        isInternal: operation.payload.isInternal ?? true
      });

      return {
        outcome: "applied",
        resultPayload: {
          entityId: note.id,
          message: "Note recorded"
        }
      };
    }
    case "job.status.update": {
      const [job] = await db
        .select()
        .from(jobs)
        .where(
          and(eq(jobs.companyId, actor.companyId), eq(jobs.id, operation.jobId), isNull(jobs.deletedAt))
        )
        .limit(1);

      if (!job) {
        return { outcome: "rejected", resultPayload: { message: "Job not found" } };
      }

      const liveVersion = buildRecordVersionV1("job", job.id, job.updatedAt);
      if (isStaleRecordVersion(operation.baseRecordVersion, liveVersion)) {
        return buildFieldWorkSyncVersionConflict(liveVersion, "Job recordVersion is stale");
      }

      const updated = await transitionStatus(
        actor.companyId,
        actor.userId,
        operation.jobId,
        operation.payload.toStatus,
        operation.payload.reason
      );

      return {
        outcome: "applied",
        resultPayload: {
          entityId: updated.id,
          recordVersion: buildRecordVersionV1("job", updated.id, updated.updatedAt)
        }
      };
    }
    case "job.task.update": {
      const versionCheck = validateJobTaskBaseRecordVersion(
        operation.baseRecordVersion,
        operation.payload.taskId
      );
      if (!versionCheck.ok) {
        return { outcome: "rejected", resultPayload: { message: versionCheck.message } };
      }

      const [task] = await db
        .select()
        .from(jobTasks)
        .where(
          and(
            eq(jobTasks.companyId, actor.companyId),
            eq(jobTasks.jobId, operation.jobId),
            eq(jobTasks.id, operation.payload.taskId),
            isNull(jobTasks.deletedAt)
          )
        )
        .limit(1);

      if (!task) {
        return { outcome: "rejected", resultPayload: { message: "Task not found" } };
      }

      const liveVersion = buildRecordVersionV1("job_task", task.id, task.updatedAt);
      if (isStaleRecordVersion(operation.baseRecordVersion, liveVersion)) {
        return buildFieldWorkSyncVersionConflict(liveVersion, "Task recordVersion is stale");
      }

      const taskUpdateInput = {
        ...(operation.payload.status !== undefined ? { status: operation.payload.status } : {}),
        ...(operation.payload.notes !== undefined ? { notes: operation.payload.notes } : {})
      };
      const updated = await updateTask(actor.companyId, operation.jobId, operation.payload.taskId, taskUpdateInput);

      return {
        outcome: "applied",
        resultPayload: {
          entityId: updated.id,
          recordVersion: buildRecordVersionV1("job_task", updated.id, updated.updatedAt)
        }
      };
    }
    case "job.signature.capture": {
      const [job] = await db
        .select()
        .from(jobs)
        .where(
          and(eq(jobs.companyId, actor.companyId), eq(jobs.id, operation.jobId), isNull(jobs.deletedAt))
        )
        .limit(1);

      if (!job) {
        return { outcome: "rejected", resultPayload: { message: "Job not found" } };
      }

      const liveVersion = buildRecordVersionV1("job", job.id, job.updatedAt);
      if (isStaleRecordVersion(operation.baseRecordVersion, liveVersion)) {
        return buildFieldWorkSyncVersionConflict(liveVersion, "Job recordVersion is stale");
      }

      const resolvedSignature = await resolveSignatureCaptureValue(actor.companyId, operation.jobId, operation.payload);
      if (!resolvedSignature.ok) {
        return {
          outcome: "rejected",
          resultPayload: { code: SIGNATURE_ATTACHMENT_INVALID, message: resolvedSignature.message }
        };
      }
      const signatureValue = resolvedSignature.value;

      if (job.signatureUrl && job.signatureUrl !== signatureValue) {
        return buildFieldWorkSyncVersionConflict(
          liveVersion,
          "Job already has a different signature on file"
        );
      }

      if (job.signatureUrl === signatureValue) {
        return {
          outcome: "applied",
          resultPayload: {
            entityId: job.id,
            recordVersion: liveVersion,
            message: "Signature already captured"
          }
        };
      }

      const signedAt = new Date();
      const updated = await db.transaction(async (tx) => {
        const [captured] = await tx
          .update(jobs)
          .set({
            signatureUrl: signatureValue,
            signedByName: operation.payload.signedByName.trim(),
            signedAt,
            updatedAt: signedAt
          })
          .where(
            and(
              eq(jobs.companyId, actor.companyId),
              eq(jobs.id, operation.jobId),
              isNull(jobs.deletedAt),
              isNull(jobs.signatureUrl)
            )
          )
          .returning();

        if (captured) {
          await emitEventWithExecutor(tx, "job.updated", {
            companyId: actor.companyId,
            actorId: actor.userId,
            actorType: "user",
            entityType: "job",
            entityId: captured.id,
            jobId: captured.id,
            customerId: captured.customerId,
            summary: `Captured customer signature on job ${captured.jobNumber}`,
            // Never put the internal storage reference on the event bus.
            payload: isJobSignatureObjectRef(captured.signatureUrl)
              ? { signatureAttachmentId: operation.payload.attachmentId ?? null }
              : { signatureUrl: captured.signatureUrl }
          });
        }

        return captured;
      });

      if (!updated) {
        return buildFieldWorkSyncVersionConflict(liveVersion, "Job signature changed concurrently");
      }

      return {
        outcome: "applied",
        resultPayload: {
          entityId: updated.id,
          recordVersion: buildRecordVersionV1("job", updated.id, updated.updatedAt)
        }
      };
    }
    case "job.media.register": {
      const photoInput = {
        url: operation.payload.url,
        photoType: operation.payload.photoType ?? "general",
        ...(operation.payload.caption !== undefined ? { caption: operation.payload.caption } : {})
      };
      const photo = await addPhoto(actor.companyId, actor.userId, operation.jobId, photoInput);

      return {
        outcome: "applied",
        resultPayload: {
          entityId: photo.id,
          message: "Media metadata registered"
        }
      };
    }
    default: {
      return { outcome: "rejected", resultPayload: { message: "Unsupported operation type" } };
    }
  }
}

export async function submitFieldWorkSyncBatch(
  actor: FieldWorkSyncActor,
  input: SubmitFieldWorkSyncBatchBody
): Promise<SubmitFieldWorkSyncBatchResponse> {
  const sortedOperations = [...input.operations].sort((left, right) => left.sequence - right.sequence);
  const batch = await resolveBatch(actor, input);
  const results: SubmitFieldWorkSyncBatchResponse["results"] = [];
  let lastAcknowledgedSequence = batch.lastAcknowledgedSequence;

  for (const operation of sortedOperations) {
    const existing = await findExistingOperation(actor.companyId, operation.clientOperationId);
    if (existing) {
      const storedHash = existing.payloadHash;
      const incomingHash = hashPayload(operation);
      const replay = resolveFieldWorkSyncClientOperationReplay({
        storedPayloadHash: storedHash,
        incomingPayloadHash: incomingHash,
        storedOutcome: existing.outcome as FieldWorkSyncOperationOutcome
      });

      if (replay.action === "reject") {
        results.push({
          clientOperationId: operation.clientOperationId,
          sequence: operation.sequence,
          outcome: "rejected",
          serverOperationId: existing.id,
          message: replay.message
        });
        continue;
      }

      const outcome = replay.action === "duplicate" ? "duplicate" : replay.outcome;
      const mapped = toOperationResult(existing);
      results.push({ ...mapped, outcome });
      lastAcknowledgedSequence = Math.max(lastAcknowledgedSequence, operation.sequence);
      continue;
    }

    let applyResult: { outcome: FieldWorkSyncOperationOutcome; resultPayload: Record<string, unknown> };
    try {
      applyResult = await applyOperation(actor, operation);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        applyResult = {
          outcome: error.code === ErrorCode.FORBIDDEN || error.code === ErrorCode.NOT_FOUND ? "rejected" : "rejected",
          resultPayload: { message: error.message }
        };
      } else {
        throw error;
      }
    }

    const inserted = await db
      .insert(fieldSyncOperations)
      .values({
        companyId: actor.companyId,
        batchId: batch.id,
        sequence: operation.sequence,
        clientOperationId: operation.clientOperationId,
        jobId: operation.jobId,
        operationType: operation.type,
        requestPayload: operation,
        outcome: applyResult.outcome,
        resultPayload: applyResult.resultPayload,
        payloadHash: hashPayload(operation)
      })
      .returning();

    const stored = inserted[0];
    if (!stored) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to persist sync operation");
    }

    results.push(toOperationResult(stored));
    if (applyResult.outcome === "applied" || applyResult.outcome === "duplicate") {
      lastAcknowledgedSequence = Math.max(lastAcknowledgedSequence, operation.sequence);
    }
  }

  const ackRows = await db
    .select()
    .from(fieldSyncOperations)
    .where(and(eq(fieldSyncOperations.batchId, batch.id), isNull(fieldSyncOperations.deletedAt)));

  lastAcknowledgedSequence = ackRows.reduce((maxSequence, row) => {
    if (row.outcome === "applied" || row.outcome === "duplicate") {
      return Math.max(maxSequence, row.sequence);
    }
    return maxSequence;
  }, lastAcknowledgedSequence);

  await db
    .update(fieldSyncBatches)
    .set({
      lastAcknowledgedSequence,
      status: "open",
      updatedAt: new Date()
    })
    .where(eq(fieldSyncBatches.id, batch.id));

  return {
    contractVersion: FIELD_WORK_SYNC_CONTRACT_VERSION,
    batchId: batch.id,
    deviceId: input.deviceId,
    batchClientId: input.batchClientId,
    lastAcknowledgedSequence,
    results
  };
}
