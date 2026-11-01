import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const entityTypeSchema = z.enum(["company", "job", "customer", "property", "asset", "estimate", "invoice", "work_order"]);

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const nullableDateTimeSchema = {
  anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
} as const;

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
    fields: {
      anyOf: [
        {
          type: "object",
          additionalProperties: { type: "string" }
        },
        { type: "null" }
      ]
    }
  }
} as const;

const attachmentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "entityType",
    "entityId",
    "jobId",
    "customerId",
    "uploadedById",
    "fileName",
    "fileUrl",
    "thumbnailUrl",
    "mimeType",
    "fileSizeBytes",
    "fileType",
    "caption",
    "photoType",
    "takenAt",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    entityType: { type: "string" },
    entityId: { type: "string" },
    jobId: nullableStringSchema,
    customerId: nullableStringSchema,
    uploadedById: nullableStringSchema,
    fileName: { type: "string" },
    fileUrl: { type: "string" },
    thumbnailUrl: nullableStringSchema,
    mimeType: nullableStringSchema,
    fileSizeBytes: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    fileType: { type: "string" },
    caption: nullableStringSchema,
    photoType: nullableStringSchema,
    takenAt: nullableDateTimeSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

export const AttachmentListQuerySchema = z.object({
  entityType: entityTypeSchema,
  entityId: uuidSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

export const AttachmentIdParamsSchema = z.object({
  id: uuidSchema
}).strict();

export const CreateAttachmentUploadUrlBodySchema = z
  .object({
    entityType: entityTypeSchema,
    entityId: uuidSchema,
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(100),
    fileSizeBytes: z.number().int().positive().max(50 * 1024 * 1024)
  })
  .strict();

export type AttachmentListQuery = z.infer<typeof AttachmentListQuerySchema>;
export type AttachmentIdParams = z.infer<typeof AttachmentIdParamsSchema>;
export type CreateAttachmentUploadUrlBody = z.infer<typeof CreateAttachmentUploadUrlBodySchema>;

export const attachmentListValidation = withZodValidation({
  query: AttachmentListQuerySchema
});
export const attachmentIdValidation = withZodValidation({
  params: AttachmentIdParamsSchema
});

export const createAttachmentUploadUrlValidation = withZodValidation({
  body: CreateAttachmentUploadUrlBodySchema
});

const signedUrlSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url", "expiresAt", "objectKey"],
  properties: {
    url: { type: "string" },
    expiresAt: { type: "string", format: "date-time" },
    objectKey: { type: "string" }
  }
} as const;

export const uploadAttachmentRouteSchema = {
  tags: ["attachments"],
  consumes: ["multipart/form-data"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["attachment"],
      properties: {
        attachment: attachmentSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const listAttachmentsRouteSchema = {
  tags: ["attachments"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: attachmentSchema
        },
        total: { type: "integer" },
        page: { type: "integer" },
        limit: { type: "integer" },
        totalPages: { type: "integer" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const mintAttachmentDownloadUrlRouteSchema = {
  tags: ["attachments"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["download"],
      properties: {
        download: signedUrlSchema
      }
    },
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const createAttachmentUploadUrlRouteSchema = {
  tags: ["attachments"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["entityType", "entityId", "fileName", "mimeType", "fileSizeBytes"],
    properties: {
      entityType: { type: "string" },
      entityId: { type: "string" },
      fileName: { type: "string" },
      mimeType: { type: "string" },
      fileSizeBytes: { type: "integer" }
    }
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["upload"],
      properties: {
        upload: signedUrlSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const deleteAttachmentRouteSchema = {
  tags: ["attachments"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["success"],
      properties: {
        success: { type: "boolean" }
      }
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
