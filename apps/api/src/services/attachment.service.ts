import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";
import sharp from "sharp";

import {
  assets,
  companies,
  customers,
  db,
  fileAttachments,
  jobs,
  technicians,
  properties,
  users,
  estimates,
  invoices
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type AttachmentEntityType,
  type AttachmentListResult,
  type FileAttachment,
  type JobPhotoType,
  type ListAttachmentsQuery
} from "@fsm/types";

import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  getFileKeyFromUrl,
  getMediaSignedUrlTtlSeconds,
  uploadFile
} from "../lib/storage.js";

type FileAttachmentRow = typeof fileAttachments.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

interface UploadAttachmentInput {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  caption?: string;
  photoType?: JobPhotoType;
  takenAt?: string;
}

const logger = pino({
  name: "attachment-service"
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/quicktime"
]);

const ALLOWED_MIME_TYPES = ALLOWED_ATTACHMENT_MIME_TYPES;

export const MAX_ATTACHMENT_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;

export function sanitizeAttachmentFileName(fileName: string): string {
  const trimmedValue = fileName.trim();
  const sanitizedValue = trimmedValue.replace(/[^a-zA-Z0-9._-]+/gu, "-");
  return sanitizedValue.length > 0 ? sanitizedValue : "attachment";
}

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function toFileAttachment(row: FileAttachmentRow): FileAttachment {
  return {
    ...row,
    entityType: row.entityType as FileAttachment["entityType"],
    fileType: (row.fileType ?? "photo") as FileAttachment["fileType"],
    photoType: (row.photoType ?? "general") as FileAttachment["photoType"]
  };
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  if (!actor) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  }

  return actor;
}

async function assertJobUploadAccess(
  companyId: string,
  actor: UserRow,
  entityType: AttachmentEntityType,
  jobId: string | null,
  executor: SelectExecutor
): Promise<void> {
  if ((entityType !== "job" && entityType !== "work_order") || actor.role !== "technician") {
    return;
  }

  await assertTechnicianJobAccess(companyId, actor, jobId, executor, "upload");
}

type TechnicianJobAccessMode = "read" | "upload" | "delete";

async function assertTechnicianJobAccess(
  companyId: string,
  actor: UserRow,
  jobId: string | null,
  executor: SelectExecutor,
  mode: TechnicianJobAccessMode
): Promise<void> {
  if (actor.role !== "technician" || !jobId) {
    return;
  }

  const [technician] = await executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.userId, actor.id), isNull(technicians.deletedAt)))
    .limit(1);
  const [job] = jobId
    ? await executor.select().from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt))).limit(1)
    : [];

  if (!technician || !job || job.technicianId !== technician.id) {
    if (mode === "read") {
      throw new AppError(ErrorCode.NOT_FOUND, "Attachment not found");
    }

    const message = mode === "upload"
      ? "You are not authorized to upload to this job"
      : "You are not authorized to modify this job attachment";
    throw new AppError(ErrorCode.FORBIDDEN, message);
  }
}

async function resolveAttachmentContext(
  companyId: string,
  entityType: AttachmentEntityType,
  entityId: string,
  executor: SelectExecutor
): Promise<{ jobId: string | null; customerId: string | null }> {
  if (entityType === "company") {
    const [company] = await executor
      .select()
      .from(companies)
      .where(and(eq(companies.id, entityId), eq(companies.id, companyId), isNull(companies.deletedAt)))
      .limit(1);

    if (!company) {
      throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
    }

    return { jobId: null, customerId: null };
  }

  if (entityType === "job" || entityType === "work_order") {
    const [job] = await executor
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, entityId), isNull(jobs.deletedAt)))
      .limit(1);

    if (!job) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    return { jobId: job.id, customerId: job.customerId };
  }

  if (entityType === "customer") {
    const [customer] = await executor
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, entityId), isNull(customers.deletedAt)))
      .limit(1);

    if (!customer) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }

    return { jobId: null, customerId: customer.id };
  }

  if (entityType === "property") {
    const [property] = await executor
      .select()
      .from(properties)
      .where(and(eq(properties.companyId, companyId), eq(properties.id, entityId), isNull(properties.deletedAt)))
      .limit(1);

    if (!property) {
      throw new AppError(ErrorCode.NOT_FOUND, "Property not found");
    }

    return { jobId: null, customerId: property.customerId };
  }

  if (entityType === "asset") {
    const [asset] = await executor
      .select()
      .from(assets)
      .where(and(eq(assets.companyId, companyId), eq(assets.id, entityId), isNull(assets.deletedAt)))
      .limit(1);

    if (!asset) {
      throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
    }

    return { jobId: null, customerId: asset.customerId };
  }

  if (entityType === "estimate") {
    const [estimate] = await executor
      .select()
      .from(estimates)
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, entityId), isNull(estimates.deletedAt)))
      .limit(1);

    if (!estimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    return { jobId: estimate.jobId, customerId: estimate.customerId };
  }

  const [invoice] = await executor
    .select()
    .from(invoices)
    .where(and(eq(invoices.companyId, companyId), eq(invoices.id, entityId), isNull(invoices.deletedAt)))
    .limit(1);

  if (!invoice) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invoice not found");
  }

  return { jobId: invoice.jobId, customerId: invoice.customerId };
}

function getAttachmentFileType(mimeType: string): FileAttachment["fileType"] {
  if (mimeType.startsWith("image/")) {
    return "photo";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  return "document";
}

async function buildThumbnail(fileBuffer: Buffer): Promise<Buffer> {
  return sharp(fileBuffer)
    .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function uploadAttachment(
  companyId: string,
  actorId: string,
  input: UploadAttachmentInput
): Promise<FileAttachment> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "This file type is not supported");
  }

  if (input.fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Files must be 50MB or smaller");
  }

  const sanitizedFileName = sanitizeAttachmentFileName(input.fileName);
  const timestamp = Date.now();
  const fileKey = `attachments/${companyId}/${timestamp}-${sanitizedFileName}`;
  const actor = await getActor(companyId, actorId, db);
  const attachmentContext = await resolveAttachmentContext(companyId, input.entityType, input.entityId, db);
  await assertJobUploadAccess(companyId, actor, input.entityType, attachmentContext.jobId, db);
  const uploadedFile = await uploadFile(fileKey, input.fileBuffer, input.mimeType);
  let thumbnailUrl: string | null = null;

  if (IMAGE_MIME_TYPES.has(input.mimeType)) {
    const thumbnailBuffer = await buildThumbnail(input.fileBuffer);
    const uploadedThumbnail = await uploadFile(
      `attachments/${companyId}/${timestamp}-thumb-${sanitizedFileName}.webp`,
      thumbnailBuffer,
      "image/webp"
    );
    thumbnailUrl = uploadedThumbnail.url;
  }

  return db.transaction(async (tx: TransactionExecutor) => {
    const insertedRows = await tx
      .insert(fileAttachments)
      .values({
        companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        jobId: attachmentContext.jobId,
        customerId: attachmentContext.customerId,
        uploadedById: actorId,
        fileName: sanitizedFileName,
        fileUrl: uploadedFile.url,
        thumbnailUrl,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileBuffer.byteLength,
        fileType: getAttachmentFileType(input.mimeType),
        caption: normalizeOptionalString(input.caption) ?? null,
        photoType: input.photoType ?? "general",
        takenAt: input.takenAt ? new Date(input.takenAt) : null
      })
      .returning();
    const attachment = insertedRows[0];

    if (!attachment) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create attachment");
    }

    logger.info(
      { companyId, entityType: input.entityType, entityId: input.entityId, attachmentId: attachment.id },
      "Attachment uploaded"
    );

    return toFileAttachment(attachment);
  });
}

async function signAttachmentMediaReference(
  companyId: string,
  reference: string | null
): Promise<string | null> {
  if (!reference) {
    return null;
  }

  try {
    const objectKey = getFileKeyFromUrl(reference);
    assertObjectKeyBelongsToCompany(objectKey, companyId);
    const signed = await createSignedDownloadUrl(objectKey, getMediaSignedUrlTtlSeconds());
    return signed.url;
  } catch (error) {
    logger.warn(
      { companyId, err: error instanceof Error ? error.message : "unknown" },
      "Attachment media reference could not be signed"
    );
    return null;
  }
}

async function withSignedMediaUrls(
  companyId: string,
  attachment: FileAttachment
): Promise<FileAttachment | null> {
  const [fileUrl, thumbnailUrl] = await Promise.all([
    signAttachmentMediaReference(companyId, attachment.fileUrl),
    signAttachmentMediaReference(companyId, attachment.thumbnailUrl)
  ]);

  // Fail closed: never return the raw stored reference when signing fails
  // (including keys outside the tenant prefix). Unsignable rows are omitted.
  if (!fileUrl) {
    return null;
  }

  return {
    ...attachment,
    fileUrl,
    thumbnailUrl
  };
}

export async function listAttachments(
  companyId: string,
  actorId: string,
  query: ListAttachmentsQuery
): Promise<AttachmentListResult> {
  const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, MAX_LIMIT) : DEFAULT_LIMIT;
  const actor = await getActor(companyId, actorId, db);
  const attachmentContext = await resolveAttachmentContext(companyId, query.entityType, query.entityId, db);
  await assertTechnicianJobAccess(companyId, actor, attachmentContext.jobId, db, "read");

  const rows = await db
    .select()
    .from(fileAttachments)
    .where(
      and(
        eq(fileAttachments.companyId, companyId),
        eq(fileAttachments.entityType, query.entityType),
        eq(fileAttachments.entityId, query.entityId),
        isNull(fileAttachments.deletedAt)
      )
    );

  const scopedJobIds = new Set(
    rows
      .map((row) => row.jobId)
      .filter((jobId): jobId is string => jobId !== null)
  );
  for (const jobId of scopedJobIds) {
    await assertTechnicianJobAccess(companyId, actor, jobId, db, "read");
  }

  const sortedRows = rows.slice().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const total = sortedRows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const pageRows = sortedRows.slice(startIndex, startIndex + limit).map((row) => toFileAttachment(row));
  const data = (
    await Promise.all(pageRows.map((attachment) => withSignedMediaUrls(companyId, attachment)))
  ).filter((attachment): attachment is FileAttachment => attachment !== null);

  return {
    data,
    total,
    page,
    limit,
    totalPages
  };
}

function buildTenantAttachmentObjectKey(companyId: string, sanitizedFileName: string): string {
  return `attachments/${companyId}/${Date.now()}-${sanitizedFileName}`;
}

function assertObjectKeyBelongsToCompany(objectKey: string, companyId: string): void {
  const attachmentPrefix = `attachments/${companyId}/`;
  const importBundlePrefix = `${companyId}/imports/`;
  if (!objectKey.startsWith(attachmentPrefix) && !objectKey.startsWith(importBundlePrefix)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Object key is outside tenant scope");
  }
}

async function getAttachmentForCompany(
  companyId: string,
  attachmentId: string,
  executor: SelectExecutor
): Promise<FileAttachmentRow> {
  const [attachment] = await executor
    .select()
    .from(fileAttachments)
    .where(
      and(
        eq(fileAttachments.companyId, companyId),
        eq(fileAttachments.id, attachmentId),
        isNull(fileAttachments.deletedAt)
      )
    )
    .limit(1);

  if (!attachment) {
    throw new AppError(ErrorCode.NOT_FOUND, "Attachment not found");
  }

  return attachment;
}

export interface AttachmentSignedUrlResult {
  url: string;
  expiresAt: string;
  objectKey: string;
}

export interface CreateAttachmentUploadUrlInput {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

export async function mintAttachmentDownloadUrl(
  companyId: string,
  actorId: string,
  attachmentId: string
): Promise<AttachmentSignedUrlResult> {
  const actor = await getActor(companyId, actorId, db);
  const attachment = await getAttachmentForCompany(companyId, attachmentId, db);
  const attachmentContext = await resolveAttachmentContext(
    companyId,
    attachment.entityType as AttachmentEntityType,
    attachment.entityId,
    db
  );
  await assertTechnicianJobAccess(
    companyId,
    actor,
    attachment.jobId ?? attachmentContext.jobId,
    db,
    "read"
  );
  const objectKey = getFileKeyFromUrl(attachment.fileUrl);
  assertObjectKeyBelongsToCompany(objectKey, companyId);
  const signed = await createSignedDownloadUrl(objectKey);

  logger.info(
    {
      companyId,
      attachmentId,
      expiresAt: signed.expiresAt.toISOString()
    },
    "Attachment download URL minted"
  );

  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
    objectKey: signed.objectKey
  };
}

export async function createAttachmentUploadUrl(
  companyId: string,
  actorId: string,
  input: CreateAttachmentUploadUrlInput
): Promise<AttachmentSignedUrlResult> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "This file type is not supported");
  }

  if (input.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Files must be 50MB or smaller");
  }

  const sanitizedFileName = sanitizeAttachmentFileName(input.fileName);
  const actor = await getActor(companyId, actorId, db);
  const attachmentContext = await resolveAttachmentContext(companyId, input.entityType, input.entityId, db);
  await assertJobUploadAccess(companyId, actor, input.entityType, attachmentContext.jobId, db);
  const objectKey = buildTenantAttachmentObjectKey(companyId, sanitizedFileName);
  const signed = await createSignedUploadUrl(objectKey, input.mimeType, getMediaSignedUrlTtlSeconds());

  logger.info(
    {
      companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      expiresAt: signed.expiresAt.toISOString()
    },
    "Attachment upload URL minted"
  );

  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
    objectKey: signed.objectKey
  };
}

export async function deleteAttachment(companyId: string, actorId: string, attachmentId: string): Promise<void> {
  await db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const [attachment] = await tx
      .select()
      .from(fileAttachments)
      .where(
        and(
          eq(fileAttachments.companyId, companyId),
          eq(fileAttachments.id, attachmentId),
          isNull(fileAttachments.deletedAt)
        )
      )
      .limit(1);

    if (!attachment) {
      throw new AppError(ErrorCode.NOT_FOUND, "Attachment not found");
    }

    const attachmentContext = await resolveAttachmentContext(
      companyId,
      attachment.entityType as AttachmentEntityType,
      attachment.entityId,
      tx
    );
    await assertTechnicianJobAccess(
      companyId,
      actor,
      attachment.jobId ?? attachmentContext.jobId,
      tx,
      "delete"
    );

    await tx
      .update(fileAttachments)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(fileAttachments.companyId, companyId),
          eq(fileAttachments.id, attachmentId),
          isNull(fileAttachments.deletedAt)
        )
      );
  });
}
