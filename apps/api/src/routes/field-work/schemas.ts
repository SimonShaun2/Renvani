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
