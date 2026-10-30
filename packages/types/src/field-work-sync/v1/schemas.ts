import { z } from "zod";

import { RecordVersionV1Schema } from "../../agent-control-plane/v1/zod-shared.js";
import {
  FIELD_WORK_SYNC_CONTRACT_VERSION,
  FIELD_WORK_SYNC_OPERATION_TYPES
} from "./constants.js";

export const FieldWorkSyncContractVersionSchema = z.literal(FIELD_WORK_SYNC_CONTRACT_VERSION);

const JobStatusSchema = z.enum([
  "lead",
  "estimate_requested",
  "estimate_sent",
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
  "closed"
]);

const JobTaskStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);

const JobPhotoTypeSchema = z.enum(["before", "after", "general"]);

export const DeviceIdSchema = z.string().min(1).max(128);
export const BatchClientIdSchema = z.string().min(1).max(128);
export const ClientOperationIdSchema = z.string().min(1).max(128);

const JobStatusUpdatePayloadSchema = z.object({
  toStatus: JobStatusSchema,
  reason: z.string().max(2000).optional()
});

const JobNoteAppendPayloadSchema = z.object({
  content: z.string().min(1).max(10000),
  isInternal: z.boolean().optional()
});

const JobTaskUpdatePayloadSchema = z.object({
  taskId: z.string().uuid(),
  status: JobTaskStatusSchema.optional(),
  notes: z.string().max(5000).optional()
});

/**
 * Exactly one of `attachmentId` (preferred: an image attachment already uploaded
 * to the same job) or legacy `signatureUrl` must be provided.
 */
const JobSignatureCapturePayloadSchema = z
  .object({
    attachmentId: z.string().uuid().optional(),
    signatureUrl: z.string().url().max(2048).optional(),
    signedByName: z.string().trim().min(1).max(255)
  })
  .refine((payload) => (payload.attachmentId === undefined) !== (payload.signatureUrl === undefined), {
    message: "Provide exactly one of attachmentId or signatureUrl",
    path: ["attachmentId"]
  });

const JobMediaRegisterPayloadSchema = z.object({
  url: z.string().url().max(2048),
  photoType: JobPhotoTypeSchema.optional(),
  caption: z.string().max(500).optional(),
  localCapturedAt: z.string().datetime({ offset: true }).optional()
});

export const FieldWorkSyncOperationSchema = z.discriminatedUnion("type", [
  z.object({
    sequence: z.number().int().min(1).max(10_000),
    clientOperationId: ClientOperationIdSchema,
    jobId: z.string().uuid(),
    type: z.literal("job.status.update"),
    baseRecordVersion: RecordVersionV1Schema,
    payload: JobStatusUpdatePayloadSchema
  }),
  z.object({
    sequence: z.number().int().min(1).max(10_000),
    clientOperationId: ClientOperationIdSchema,
    jobId: z.string().uuid(),
    type: z.literal("job.note.append"),
    payload: JobNoteAppendPayloadSchema
  }),
  z.object({
    sequence: z.number().int().min(1).max(10_000),
    clientOperationId: ClientOperationIdSchema,
    jobId: z.string().uuid(),
    type: z.literal("job.task.update"),
    baseRecordVersion: RecordVersionV1Schema,
    payload: JobTaskUpdatePayloadSchema
  }),
  z.object({
    sequence: z.number().int().min(1).max(10_000),
    clientOperationId: ClientOperationIdSchema,
    jobId: z.string().uuid(),
    type: z.literal("job.signature.capture"),
    baseRecordVersion: RecordVersionV1Schema,
    payload: JobSignatureCapturePayloadSchema
  }),
  z.object({
    sequence: z.number().int().min(1).max(10_000),
    clientOperationId: ClientOperationIdSchema,
    jobId: z.string().uuid(),
    type: z.literal("job.media.register"),
    payload: JobMediaRegisterPayloadSchema
  })
]);

export const SubmitFieldWorkSyncBatchBodySchema = z
  .object({
    contractVersion: FieldWorkSyncContractVersionSchema,
    deviceId: DeviceIdSchema,
    batchClientId: BatchClientIdSchema,
    resumeBatchId: z.string().uuid().optional(),
    operations: z.array(FieldWorkSyncOperationSchema).min(1).max(200)
  })
  .strict();

export type SubmitFieldWorkSyncBatchBody = z.infer<typeof SubmitFieldWorkSyncBatchBodySchema>;
export type FieldWorkSyncOperationInput = z.infer<typeof FieldWorkSyncOperationSchema>;

export const FieldWorkSyncOperationResultSchema = z.object({
  clientOperationId: ClientOperationIdSchema,
  sequence: z.number().int(),
  outcome: z.enum(["applied", "duplicate", "conflict", "rejected"]),
  serverOperationId: z.string().uuid().optional(),
  recordVersion: RecordVersionV1Schema.optional(),
  entityId: z.string().uuid().optional(),
  message: z.string().optional(),
  /** Machine-readable reason for a rejected operation (additive; e.g. SIGNATURE_ATTACHMENT_INVALID). */
  code: z.string().optional(),
  conflict: z
    .object({
      liveRecordVersion: RecordVersionV1Schema,
      reason: z.string()
    })
    .optional()
});

export const SubmitFieldWorkSyncBatchResponseSchema = z.object({
  contractVersion: FieldWorkSyncContractVersionSchema,
  batchId: z.string().uuid(),
  deviceId: DeviceIdSchema,
  batchClientId: BatchClientIdSchema,
  lastAcknowledgedSequence: z.number().int(),
  results: z.array(FieldWorkSyncOperationResultSchema)
});

export type SubmitFieldWorkSyncBatchResponse = z.infer<typeof SubmitFieldWorkSyncBatchResponseSchema>;

export function isFieldWorkSyncOperationType(value: string): value is (typeof FIELD_WORK_SYNC_OPERATION_TYPES)[number] {
  return (FIELD_WORK_SYNC_OPERATION_TYPES as readonly string[]).includes(value);
}
