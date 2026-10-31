import {
  CaptureJobSignatureBodySchema,
  CaptureJobSignatureParamsSchema,
  SubmitFieldWorkSyncBatchBodySchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

export const submitFieldWorkSyncBatchValidation = withZodValidation({
  body: SubmitFieldWorkSyncBatchBodySchema
});

export const captureJobSignatureValidation = withZodValidation({
  params: CaptureJobSignatureParamsSchema,
  body: CaptureJobSignatureBodySchema
});

const signatureErrorSchema = {
  type: "object",
  additionalProperties: true,
  required: ["error", "message"],
  properties: { error: { type: "string" }, message: { type: "string" } }
} as const;

const capturedSignatureSchema = {
  type: "object",
  additionalProperties: false,
  required: ["signature"],
  properties: {
    signature: {
      type: "object",
      additionalProperties: false,
      required: ["created", "jobId", "outcome", "signedAt", "signedByName", "signerRole", "recordVersion"],
      properties: {
        created: { type: "boolean" },
        jobId: { type: "string" },
        outcome: { type: "string", enum: ["applied", "duplicate"] },
        signedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
        signedByName: { anyOf: [{ type: "string" }, { type: "null" }] },
        signerRole: { anyOf: [{ type: "string", enum: ["customer", "technician"] }, { type: "null" }] },
        recordVersion: { anyOf: [{ type: "string" }, { type: "null" }] }
      }
    }
  }
} as const;

/**
 * POST /field-work/jobs/:jobId/signature: only the codes this route actually returns.
 * 201 new signature stored; 200 idempotent replay or same signature already on file; 400 invalid body/params or
 * rejected signature; 401 unauthenticated; 403 role not allowed or technician not assigned; 404 job not found in
 * this company; 409 stale baseRecordVersion or a different signature already on file. 429 can come only from the
 * global per-IP limit (FS-66), which covers this route exactly like the sibling sync route.
 */
export const captureJobSignatureRouteSchema = {
  tags: ["field-work"],
  response: {
    200: capturedSignatureSchema,
    201: capturedSignatureSchema,
    400: signatureErrorSchema,
    401: signatureErrorSchema,
    403: signatureErrorSchema,
    404: signatureErrorSchema,
    409: signatureErrorSchema
  }
} as const;
