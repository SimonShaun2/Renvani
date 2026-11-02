import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

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
  type CaptureJobSignatureBody,
  type SignerRole,
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

import {
  addNoteInTransaction,
  addPhotoInTransaction,
  transitionStatusInTransaction
} from "./job.service.js";
import { updateTaskInTransaction } from "./job-tasks.service.js";

type BatchRow = typeof fieldSyncBatches.$inferSelect;
type OperationRow = typeof fieldSyncOperations.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type FieldSyncTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type SignatureCaptureTransactionResult =
  | { kind: "captured"; job: JobRow; signedAt: Date }
  | { kind: "already_captured"; job: JobRow; recordVersion: string }
  | { kind: "conflict"; recordVersion: string; reason: string }
  | { kind: "rejected"; message: string };

export interface FieldWorkSyncActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

export const SIGNATURE_ATTACHMENT_INVALID = "SIGNATURE_ATTACHMENT_INVALID";
const SIGNATURE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Signatures are small line drawings; anything larger is not a signature pad export. */
const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;
const operationLockTails = new Map<string, Promise<void>>();

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

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
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
    ...(typeof resultPayload.signedAt === "string" ? { signedAt: resultPayload.signedAt } : {}),
    ...(resultPayload.signerRole === "customer" || resultPayload.signerRole === "technician"
      ? { signerRole: resultPayload.signerRole as "customer" | "technician" }
      : {}),
    conflict:
      resultPayload.conflict && typeof resultPayload.conflict === "object"
        ? (resultPayload.conflict as { liveRecordVersion: string; reason: string })
        : undefined
  };
}

export async function assertJobFieldAccess(
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
  executor: Pick<FieldSyncTransaction, "select">,
  companyId: string,
  clientOperationId: string
): Promise<OperationRow | null> {
  const [row] = await executor
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

async function withSerializedOperation<T>(
  companyId: string,
  clientOperationId: string,
  callback: (tx: FieldSyncTransaction) => Promise<T>
): Promise<T> {
  const lockKey = `${companyId}:${clientOperationId}`;
  const previous = operationLockTails.get(lockKey) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  operationLockTails.set(lockKey, tail);
  await previous;

  try {
    return await db.transaction(async (tx) => {
      // The in-process tail avoids duplicate work within one API instance. The
      // transaction-scoped advisory lock provides the same boundary across Render
      // instances without creating another persistence model or schema migration.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      return callback(tx);
    });
  } finally {
    release?.();
    if (operationLockTails.get(lockKey) === tail) {
      operationLockTails.delete(lockKey);
    }
  }
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

  let inserted: BatchRow[];
  try {
    inserted = await db
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
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;

    // A concurrent retry can win the unique (company, device, batchClientId) insert.
    // PostgreSQL waits for the winner before surfacing 23505, so the committed row is
    // visible to this read under READ COMMITTED and is safe to reuse.
    const [raced] = await db
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

    if (raced) return raced;
    throw error;
  }

  const batch = inserted[0];
  if (!batch) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create sync batch");
  }

  return batch;
}

async function applyOperation(
  tx: FieldSyncTransaction,
  actor: FieldWorkSyncActor,
  operation: FieldWorkSyncOperationInput
): Promise<{
  outcome: FieldWorkSyncOperationOutcome;
  resultPayload: Record<string, unknown>;
}> {
  await assertJobFieldAccess(actor.companyId, actor.userId, actor.role, operation.jobId);

  switch (operation.type) {
    case "job.note.append": {
      const note = await addNoteInTransaction(tx, actor.companyId, actor.userId, operation.jobId, {
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
      const [job] = await tx
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

      const updated = await transitionStatusInTransaction(
        tx,
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

      const [task] = await tx
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
      const updated = await updateTaskInTransaction(
        tx,
        actor.companyId,
        operation.jobId,
        operation.payload.taskId,
        taskUpdateInput
      );

      return {
        outcome: "applied",
        resultPayload: {
          entityId: updated.id,
          recordVersion: buildRecordVersionV1("job_task", updated.id, updated.updatedAt)
        }
      };
    }
    case "job.signature.capture": {
      const resolvedSignature = await resolveSignatureCaptureValue(actor.companyId, operation.jobId, operation.payload);
      if (!resolvedSignature.ok) {
        return {
          outcome: "rejected",
          resultPayload: { code: SIGNATURE_ATTACHMENT_INVALID, message: resolvedSignature.message }
        };
      }
      const signatureValue = resolvedSignature.value;

      const captureResult: SignatureCaptureTransactionResult = await (async () => {
        // PostgreSQL defaultNow() retains microseconds while the JS Date used in recordVersion tokens has
        // millisecond precision. Lock and revalidate the token instead of comparing updated_at to a rounded Date.
        const [currentJob] = await tx
          .select()
          .from(jobs)
          .where(
            and(eq(jobs.companyId, actor.companyId), eq(jobs.id, operation.jobId), isNull(jobs.deletedAt))
          )
          .for("update")
          .limit(1);

        if (!currentJob) {
          return { kind: "rejected", message: "Job not found" };
        }

        if (actor.role === "technician") {
          const [technician] = await tx
            .select()
            .from(technicians)
            .where(
              and(
                eq(technicians.companyId, actor.companyId),
                eq(technicians.userId, actor.userId),
                isNull(technicians.deletedAt)
              )
            )
            .limit(1);

          if (!technician || currentJob.technicianId !== technician.id) {
            return { kind: "rejected", message: "You are not authorized to sync work for this job" };
          }
        }

        const currentVersion = buildRecordVersionV1("job", currentJob.id, currentJob.updatedAt);
        // A same-signature retry is safe even when another request won the race after our attachment lookup.
        if (currentJob.signatureUrl === signatureValue) {
          return { kind: "already_captured", job: currentJob, recordVersion: currentVersion };
        }
        if (currentJob.signatureUrl) {
          return {
            kind: "conflict",
            recordVersion: currentVersion,
            reason: "Job already has a different signature on file"
          };
        }
        if (isStaleRecordVersion(operation.baseRecordVersion, currentVersion)) {
          return { kind: "conflict", recordVersion: currentVersion, reason: "Job recordVersion is stale" };
        }

        const signedAt = new Date();
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

        if (!captured) {
          return { kind: "conflict", recordVersion: currentVersion, reason: "Job changed concurrently" };
        }

        await emitEventWithExecutor(tx, "job.updated", {
          companyId: actor.companyId,
          actorId: actor.userId,
          actorType: "user",
          entityType: "job",
          entityId: captured.id,
          jobId: captured.id,
          customerId: captured.customerId,
          summary: `Captured ${operation.payload.signerRole === "technician" ? "technician" : "customer"} signature on job ${captured.jobNumber}`,
          // Never put the internal storage reference on the event bus.
          payload: isJobSignatureObjectRef(captured.signatureUrl)
            ? { signatureAttachmentId: operation.payload.attachmentId ?? null }
            : { signatureSource: "legacy_https_url" }
        });

        return { kind: "captured", job: captured, signedAt };
      })();

      if (captureResult.kind === "rejected") {
        return { outcome: "rejected", resultPayload: { message: captureResult.message } };
      }
      if (captureResult.kind === "conflict") {
        return buildFieldWorkSyncVersionConflict(captureResult.recordVersion, captureResult.reason);
      }
      if (captureResult.kind === "already_captured") {
        return {
          outcome: "applied",
          resultPayload: {
            entityId: captureResult.job.id,
            recordVersion: captureResult.recordVersion,
            message: SIGNATURE_ALREADY_CAPTURED_MESSAGE,
            ...(captureResult.job.signedAt ? { signedAt: captureResult.job.signedAt.toISOString() } : {})
          }
        };
      }

      return {
        outcome: "applied",
        resultPayload: {
          entityId: captureResult.job.id,
          recordVersion: buildRecordVersionV1("job", captureResult.job.id, captureResult.job.updatedAt),
          signedAt: captureResult.signedAt.toISOString(),
          // Signer role is persisted on the stored operation result (no jobs column / migration).
          signerRole: operation.payload.signerRole ?? "customer"
        }
      };
    }
    case "job.media.register": {
      const photoInput = {
        url: operation.payload.url,
        photoType: operation.payload.photoType ?? "general",
        ...(operation.payload.caption !== undefined ? { caption: operation.payload.caption } : {})
      };
      const photo = await addPhotoInTransaction(tx, actor.companyId, actor.userId, operation.jobId, photoInput);

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
    const processed = await withSerializedOperation(
      actor.companyId,
      operation.clientOperationId,
      async (tx) => {
        const existing = await findExistingOperation(tx, actor.companyId, operation.clientOperationId);
        if (existing) {
          const replay = resolveFieldWorkSyncClientOperationReplay({
            storedPayloadHash: existing.payloadHash,
            incomingPayloadHash: hashPayload(operation),
            storedOutcome: existing.outcome as FieldWorkSyncOperationOutcome
          });

          if (replay.action === "reject") {
            return {
              acknowledged: false,
              result: {
                clientOperationId: operation.clientOperationId,
                sequence: operation.sequence,
                outcome: "rejected" as const,
                serverOperationId: existing.id,
                message: replay.message
              }
            };
          }

          const mapped = toOperationResult(existing);
          return {
            acknowledged: true,
            result: {
              ...mapped,
              outcome: replay.action === "duplicate" ? ("duplicate" as const) : replay.outcome
            }
          };
        }

        let applyResult: { outcome: FieldWorkSyncOperationOutcome; resultPayload: Record<string, unknown> };
        try {
          applyResult = await applyOperation(tx, actor, operation);
        } catch (error: unknown) {
          if (error instanceof AppError) {
            applyResult = { outcome: "rejected", resultPayload: { message: error.message } };
          } else {
            throw error;
          }
        }

        const inserted = await tx
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

        return {
          acknowledged: applyResult.outcome === "applied" || applyResult.outcome === "duplicate",
          result: toOperationResult(stored)
        };
      }
    );

    results.push(processed.result);
    if (processed.acknowledged) {
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

const SIGNATURE_ALREADY_CAPTURED_MESSAGE = "Signature already captured";

export interface CapturedJobSignature {
  /** true only when this request stored a new signature (route answers 201); replays / already-captured answer 200. */
  created: boolean;
  jobId: string;
  outcome: "applied" | "duplicate";
  signedAt: string | null;
  signedByName: string | null;
  signerRole: SignerRole | null;
  recordVersion: string | null;
}

/**
 * Dedicated signature capture (POST /field-work/jobs/:jobId/signature). Runs as a one-operation sync batch so it
 * shares validation, technician scope, idempotency (clientOperationId) and the stored-ref rules with the
 * `job.signature.capture` sync path used by #314 (that path is unchanged). Real status codes, existing error shape:
 * 201 newly captured, 200 replay or same signature already on file, 400 invalid body / rejected signature,
 * 401 unauthenticated, 403 role or unassigned technician, 404 job not in this company, 409 stale recordVersion or a
 * different signature already on file. No other codes (429 only from the global per-IP rate limit).
 */
export async function captureJobSignature(
  actor: FieldWorkSyncActor,
  jobId: string,
  body: CaptureJobSignatureBody
): Promise<CapturedJobSignature> {
  await assertJobFieldAccess(actor.companyId, actor.userId, actor.role, jobId);
  const payload = {
    signedByName: body.signedByName,
    signerRole: body.signerRole,
    ...(body.attachmentId !== undefined ? { attachmentId: body.attachmentId } : {}),
    ...(body.signatureUrl !== undefined ? { signatureUrl: body.signatureUrl } : {})
  };
  const response = await submitFieldWorkSyncBatch(actor, {
    contractVersion: FIELD_WORK_SYNC_CONTRACT_VERSION,
    deviceId: "signature-endpoint",
    batchClientId: `signature-${createHash("sha256").update(body.clientOperationId).digest("hex").slice(0, 40)}`,
    operations: [
      {
        sequence: 1,
        clientOperationId: body.clientOperationId,
        jobId,
        type: "job.signature.capture",
        baseRecordVersion: body.baseRecordVersion,
        payload
      }
    ]
  } as SubmitFieldWorkSyncBatchBody);
  const result = response.results[0];
  if (!result) throw new AppError(ErrorCode.INTERNAL_ERROR, "Signature capture returned no result");
  if (result.outcome === "conflict") {
    throw new AppError(ErrorCode.CONFLICT, result.conflict?.reason ?? result.message ?? "Job recordVersion is stale", {
      ...(result.conflict?.liveRecordVersion ? { liveRecordVersion: result.conflict.liveRecordVersion } : {})
    });
  }
  if (result.outcome === "rejected") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, result.message ?? "Signature rejected", {
      ...(result.code ? { code: result.code } : {})
    });
  }
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, actor.companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);
  return {
    created: result.outcome === "applied" && result.message !== SIGNATURE_ALREADY_CAPTURED_MESSAGE,
    jobId,
    outcome: result.outcome,
    signedAt: job?.signedAt ? job.signedAt.toISOString() : (result.signedAt ?? null),
    signedByName: job?.signedByName ?? null,
    signerRole: result.signerRole ?? null,
    recordVersion: job ? buildRecordVersionV1("job", job.id, job.updatedAt) : (result.recordVersion ?? null)
  };
}
