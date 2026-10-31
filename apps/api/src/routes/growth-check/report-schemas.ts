import {
  growthCheckReportDeliveryBodySchema,
  growthCheckReportDraftApproveBodySchema,
  growthCheckReportDraftCreateBodySchema,
  growthCheckReportDraftEditBodySchema,
  growthCheckReportExportQuerySchema,
  growthCheckReportShareCreateBodySchema,
  growthCheckReportShareRevokeBodySchema
} from "@fsm/types";
import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

// FS-57 owner report. Body/query schemas live in @fsm/types so the web client shares them.
const scanParams = z.object({ scanId: z.string().uuid() }).strict();
const draftParams = z.object({ draftId: z.string().uuid() }).strict();
const shareParams = z.object({ shareId: z.string().uuid() }).strict();
const emptyQuery = z.object({}).strict();

export const createReportDraftValidation = withZodValidation({ params: scanParams, body: growthCheckReportDraftCreateBodySchema });
export const getScanReportDraftValidation = withZodValidation({ params: scanParams, query: emptyQuery });
export const getReportDraftValidation = withZodValidation({ params: draftParams, query: emptyQuery });
export const editReportDraftValidation = withZodValidation({ params: draftParams, body: growthCheckReportDraftEditBodySchema });
export const approveReportDraftValidation = withZodValidation({ params: draftParams, body: growthCheckReportDraftApproveBodySchema });
export const exportReportDraftValidation = withZodValidation({ params: draftParams, query: growthCheckReportExportQuerySchema });
export const createReportShareValidation = withZodValidation({ params: draftParams, body: growthCheckReportShareCreateBodySchema });
export const revokeReportShareValidation = withZodValidation({ params: shareParams, body: growthCheckReportShareRevokeBodySchema.optional() });
export const reportDeliveryValidation = withZodValidation({ params: shareParams, body: growthCheckReportDeliveryBodySchema });
