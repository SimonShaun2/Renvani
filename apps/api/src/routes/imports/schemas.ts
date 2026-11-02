import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const importSessionStatusSchema = z.enum([
  "uploaded",
  "mapping",
  "preview",
  "importing",
  "completed",
  "failed",
  "rolled_back"
]);
/** Entity types a file upload can start (worker has a writer or a registered chunk committer for each). */
export const UPLOADABLE_IMPORT_ENTITY_TYPES = [
  "customers",
  "properties",
  "jobs",
  "estimates",
  "invoices",
  "price_book",
  "notes",
  "communications",
  "service_agreements"
] as const;

const importEntityTypeSchema = z.enum([
  "customers",
  "properties",
  "jobs",
  "estimates",
  "invoices",
  "price_book",
  "notes",
  "communications",
  "service_agreements"
]);

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

const importSessionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "status",
    "entityType",
    "fileName",
    "totalRows",
    "validRows",
    "errorRows",
    "importedRows",
    "skippedRows",
    "duplicateRows",
    "columnMappings",
    "completedAt",
    "rolledBackAt",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    status: { type: "string" },
    entityType: { type: "string" },
    fileName: { type: "string" },
    totalRows: { anyOf: [{ type: "integer" }, { type: "null" }] },
    validRows: { anyOf: [{ type: "integer" }, { type: "null" }] },
    errorRows: { anyOf: [{ type: "integer" }, { type: "null" }] },
    importedRows: { anyOf: [{ type: "integer" }, { type: "null" }] },
    skippedRows: { anyOf: [{ type: "integer" }, { type: "null" }] },
    duplicateRows: { anyOf: [{ type: "integer" }, { type: "null" }] },
    columnMappings: {
      type: "object",
      additionalProperties: {
        anyOf: [{ type: "string" }, { type: "null" }]
      }
    },
    completedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
    },
    rolledBackAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
    },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const validationErrorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["row", "field", "message", "value"],
  properties: {
    row: { type: "integer" },
    field: { type: "string" },
    message: { type: "string" },
    value: { type: "string" }
  }
} as const;

export const ImportSessionIdParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const ImportFileBatchParamsSchema = z
  .object({
    id: uuidSchema,
    batchIndex: z.coerce.number().int().nonnegative()
  })
  .strict();

export const ConfirmMappingSchema = z
  .object({
    mappingOverrides: z.record(z.string(), z.string().trim().min(1).nullable()).optional().default({})
  })
  .strict();

export const StartImportSchema = z
  .object({
    duplicateActions: z
      .record(z.string(), z.enum(["skip", "update_existing", "import_new"]))
      .optional()
      .default({})
  })
  .strict()
  .default({
    duplicateActions: {}
  });

export const ListImportsQuerySchema = z
  .object({
    status: importSessionStatusSchema.optional(),
    entityType: importEntityTypeSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10)
  })
  .strict();

export type ConfirmMappingBody = z.infer<typeof ConfirmMappingSchema>;
export type ImportSessionIdParams = z.infer<typeof ImportSessionIdParamsSchema>;
export type StartImportBody = z.infer<typeof StartImportSchema>;

export const confirmMappingValidation = withZodValidation({
  params: ImportSessionIdParamsSchema,
  body: ConfirmMappingSchema
});
export const importSessionIdValidation = withZodValidation({
  params: ImportSessionIdParamsSchema
});
export const importFileBatchValidation = withZodValidation({
  params: ImportFileBatchParamsSchema
});
export const startImportValidation = withZodValidation({
  params: ImportSessionIdParamsSchema,
  body: StartImportSchema
});
export const listImportsValidation = withZodValidation({
  query: ListImportsQuerySchema
});

export const createImportRouteSchema = {
  tags: ["imports"],
  consumes: ["multipart/form-data"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["importSession"],
      properties: {
        importSession: importSessionSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema
  }
} as const;

export const listImportsRouteSchema = {
  tags: ["imports"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: importSessionSchema
        },
        total: { type: "integer" },
        page: { type: "integer" },
        limit: { type: "integer" },
        totalPages: { type: "integer" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema
  }
} as const;

const importIngestStatusSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "importSessionId",
    "entityType",
    "fileName",
    "status",
    "chunkProgress",
    "priceBookLineSeeds",
    "importedRows"
  ],
  properties: {
    importSessionId: { type: "string" },
    entityType: { type: "string" },
    fileName: { type: "string" },
    status: { type: "string" },
    chunkProgress: {
      anyOf: [
        {
          type: "object",
          additionalProperties: true
        },
        { type: "null" }
      ]
    },
    priceBookLineSeeds: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    importedRows: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    }
  }
} as const;

const importSessionDetailResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["importSession", "ingest"],
  properties: {
    importSession: importSessionSchema,
    ingest: importIngestStatusSchema
  }
} as const;

export const getImportRouteSchema = {
  tags: ["imports"],
  response: {
    200: importSessionDetailResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

const importMutationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["importSession"],
  properties: {
    importSession: importSessionSchema
  }
} as const;

export const confirmMappingRouteSchema = {
  tags: ["imports"],
  response: {
    200: importMutationResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const startImportRouteSchema = confirmMappingRouteSchema;
export const rollbackImportRouteSchema = confirmMappingRouteSchema;

export const getImportIngestStatusRouteSchema = {
  tags: ["imports"],
  response: {
    200: importIngestStatusSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const migrateFileBatchStatusRouteSchema = {
  tags: ["imports"],
  response: {
    200: {
      type: "object",
      additionalProperties: true
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const migrateFileBatchRetryRouteSchema = {
  tags: ["imports"],
  response: {
    200: {
      type: "object",
      additionalProperties: true
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const importErrorsRouteSchema = {
  tags: ["imports"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["errors"],
      properties: {
        errors: {
          type: "array",
          items: validationErrorSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const importIngestProgressRouteSchema = {
  tags: ["imports"],
  response: {
    200: {
      type: "object",
      additionalProperties: true
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
