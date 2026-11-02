import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError, ErrorCode, type AttachmentEntityType, type JobPhotoType } from "@fsm/types";

import {
  createAttachmentUploadUrl,
  deleteAttachment,
  listAttachments,
  mintAttachmentDownloadUrl,
  uploadAttachment
} from "../../services/attachment.service.js";
import type {
  AttachmentIdParams,
  AttachmentListQuery,
  CreateAttachmentUploadUrlBody
} from "./schemas.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toAttachmentResponse(attachment: Awaited<ReturnType<typeof uploadAttachment>>) {
  return {
    id: attachment.id,
    companyId: attachment.companyId,
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    jobId: attachment.jobId,
    customerId: attachment.customerId,
    uploadedById: attachment.uploadedById,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    thumbnailUrl: attachment.thumbnailUrl,
    mimeType: attachment.mimeType,
    fileSizeBytes: attachment.fileSizeBytes,
    fileType: attachment.fileType,
    caption: attachment.caption,
    photoType: attachment.photoType,
    takenAt: toIsoString(attachment.takenAt),
    createdAt: attachment.createdAt.toISOString(),
    updatedAt: attachment.updatedAt.toISOString(),
    deletedAt: toIsoString(attachment.deletedAt)
  };
}

function readMultipartField(
  fields: Record<string, { value?: unknown } | Array<{ value?: unknown }>>,
  name: string
): string | undefined {
  const field = fields[name];

  if (!field) {
    return undefined;
  }

  if (Array.isArray(field)) {
    const firstValue = field[0]?.value;
    return typeof firstValue === "string" ? firstValue : undefined;
  }

  return typeof field.value === "string" ? field.value : undefined;
}

export async function uploadAttachmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const file = await request.file();

  if (!file) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "file is required");
  }

  const fileBuffer = await file.toBuffer();
  const entityType = readMultipartField(file.fields as Record<string, { value?: unknown }>, "entityType");
  const entityId = readMultipartField(file.fields as Record<string, { value?: unknown }>, "entityId");

  if (!entityType || !entityId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "entityType and entityId are required");
  }

  const caption = readMultipartField(file.fields as Record<string, { value?: unknown }>, "caption");
  const photoType = readMultipartField(
    file.fields as Record<string, { value?: unknown }>,
    "photoType"
  ) as JobPhotoType | undefined;
  const takenAt = readMultipartField(file.fields as Record<string, { value?: unknown }>, "takenAt");
  const attachment = await uploadAttachment(request.company.id, request.user.id, {
    entityType: entityType as AttachmentEntityType,
    entityId,
    fileName: file.filename,
    mimeType: file.mimetype,
    fileBuffer,
    ...(caption !== undefined ? { caption } : {}),
    ...(photoType !== undefined ? { photoType } : {}),
    ...(takenAt !== undefined ? { takenAt } : {})
  });

  return reply.status(201).send({
    attachment: toAttachmentResponse(attachment)
  });
}

export async function listAttachmentsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await listAttachments(
    request.company.id,
    request.user.id,
    request.query as AttachmentListQuery
  );

  return reply.send({
    data: result.data.map((attachment) => toAttachmentResponse(attachment)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}

export async function mintAttachmentDownloadUrlHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as AttachmentIdParams;
  const signed = await mintAttachmentDownloadUrl(request.company.id, request.user.id, params.id);

  return reply.send({
    download: signed
  });
}

export async function createAttachmentUploadUrlHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const body = request.body as CreateAttachmentUploadUrlBody;
  const signed = await createAttachmentUploadUrl(request.company.id, request.user.id, body);

  return reply.status(201).send({
    upload: signed
  });
}

export async function deleteAttachmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as AttachmentIdParams;
  await deleteAttachment(request.company.id, request.user.id, params.id);

  return reply.send({
    success: true
  });
}
