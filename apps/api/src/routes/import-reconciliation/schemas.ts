import type { FastifySchema } from "fastify";
import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();

export const ImportReconciliationParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const importReconciliationParamsValidation = withZodValidation({
  params: ImportReconciliationParamsSchema
});

const reasonSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "label", "count"],
  properties: {
    code: {
      type: "string",
      enum: ["validation_error", "duplicate_skipped", "chunk_commit_failed", "other_skipped"]
    },
    label: { type: "string" },
    count: { type: "integer", minimum: 0 }
  }
} as const;

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "importSessionId",
    "entityType",
    "fileName",
    "status",
    "sourceRowCount",
    "committedRowCount",
    "skippedRowCount",
    "failedRowCount",
    "reasonSummaries",
    "skippedRowsCsvObjectKey",
    "computedAt"
  ],
  properties: {
    version: { type: "integer", enum: [1] },
    importSessionId: { type: "string", format: "uuid" },
    entityType: { type: "string" },
    fileName: { type: "string" },
    status: { type: "string" },
    sourceRowCount: { type: "integer", minimum: 0 },
    committedRowCount: { type: "integer", minimum: 0 },
    skippedRowCount: { type: "integer", minimum: 0 },
    failedRowCount: { type: "integer", minimum: 0 },
    reasonSummaries: {
      type: "array",
      items: reasonSummarySchema
    },
    skippedRowsCsvObjectKey: {
      anyOf: [{ type: "string", minLength: 1 }, { type: "null" }]
    },
    computedAt: { type: "string", format: "date-time" }
  }
} as const;

export const getImportReconciliationRouteSchema: FastifySchema = {
  params: {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" }
    }
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["report", "skippedRowsDownloadUrl"],
      properties: {
        report: reportSchema,
        skippedRowsDownloadUrl: {
          anyOf: [{ type: "string", format: "uri" }, { type: "null" }]
        }
      }
    }
  }
};
