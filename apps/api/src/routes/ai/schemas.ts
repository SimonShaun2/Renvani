import { z } from "zod";
import { GenerateRevenueProposalsBodySchema } from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const recommendationTypeSchema = z.enum([
  "reactivation",
  "aging_asset",
  "maintenance_due",
  "unsold_estimate",
  "unpaid_invoice",
  "upsell_opportunity",
  "seasonal_campaign",
  "maintenance_plan_offer"
]);
const recommendationStatusSchema = z.enum([
  "pending",
  "actioned",
  "dismissed",
  "snoozed",
  "expired"
]);

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const nullableIntegerSchema = {
  anyOf: [{ type: "integer" }, { type: "null" }]
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

const recommendationDetailSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "type",
    "status",
    "headline",
    "body",
    "suggestedAction",
    "suggestedMessage",
    "estimatedRevenue",
    "urgencyScore",
    "confidenceScore",
    "customer",
    "asset",
    "job",
    "estimate",
    "invoice",
    "actionedAt",
    "dismissedAt",
    "snoozedUntil",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    type: { type: "string" },
    status: { type: "string" },
    headline: { type: "string" },
    body: { type: "string" },
    suggestedAction: nullableStringSchema,
    suggestedMessage: nullableStringSchema,
    estimatedRevenue: nullableStringSchema,
    urgencyScore: nullableIntegerSchema,
    confidenceScore: nullableIntegerSchema,
    customer: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "firstName", "lastName", "phone"],
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: nullableStringSchema
          }
        },
        { type: "null" }
      ]
    },
    asset: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "assetType", "installDate"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            assetType: { type: "string" },
            installDate: nullableStringSchema
          }
        },
        { type: "null" }
      ]
    },
    job: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "jobNumber"],
          properties: {
            id: { type: "string" },
            jobNumber: { type: "string" }
          }
        },
        { type: "null" }
      ]
    },
    estimate: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "estimateNumber", "total"],
          properties: {
            id: { type: "string" },
            estimateNumber: { type: "string" },
            total: { type: "string" }
          }
        },
        { type: "null" }
      ]
    },
    invoice: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "invoiceNumber", "balanceDue"],
          properties: {
            id: { type: "string" },
            invoiceNumber: { type: "string" },
            balanceDue: { type: "string" }
          }
        },
        { type: "null" }
      ]
    },
    actionedAt: nullableDateTimeSchema,
    dismissedAt: nullableDateTimeSchema,
    snoozedUntil: nullableDateTimeSchema,
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const revenueSummaryTopRecommendationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "headline", "urgencyScore"],
  properties: {
    id: { type: "string" },
    headline: { type: "string" },
    urgencyScore: nullableIntegerSchema
  }
} as const;

const revenueSummaryCountBucketSchema = {
  type: "object",
  additionalProperties: false,
  required: ["count", "estimatedRevenue", "topRecommendations"],
  properties: {
    count: { type: "integer" },
    estimatedRevenue: { type: "string" },
    topRecommendations: {
      type: "array",
      items: revenueSummaryTopRecommendationSchema
    }
  }
} as const;

const revenueSummaryValueBucketSchema = {
  type: "object",
  additionalProperties: false,
  required: ["count", "totalValue", "topRecommendations"],
  properties: {
    count: { type: "integer" },
    totalValue: { type: "string" },
    topRecommendations: {
      type: "array",
      items: revenueSummaryTopRecommendationSchema
    }
  }
} as const;

export const RecommendationIdParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const ListRecommendationsQuerySchema = z
  .object({
    type: recommendationTypeSchema.optional(),
    status: recommendationStatusSchema.optional().default("pending"),
    customerId: uuidSchema.optional(),
    assetId: uuidSchema.optional(),
    sortBy: z.enum(["urgencyScore", "estimatedRevenue", "createdAt"]).optional().default("urgencyScore"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export const ActionRecommendationSchema = z
  .object({
    actionTaken: z.string().trim().min(1).max(255),
    notes: z.string().trim().max(1000).optional()
  })
  .strict();

export const DismissRecommendationSchema = z
  .object({
    reason: z.string().trim().max(1000).optional()
  })
  .strict();

export const SnoozeRecommendationSchema = z
  .object({
    snoozedUntil: z
      .string()
      .datetime()
      .refine((value) => new Date(value).getTime() > Date.now(), {
        message: "snoozedUntil must be in the future"
      })
  })
  .strict();

export const LabelPhotoSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    assetName: z.string().trim().max(255).optional(),
    jobTitle: z.string().trim().max(255).optional(),
    photoType: z.enum(["before", "after", "general", "document"]).optional()
  })
  .strict();

export type RecommendationIdParams = z.infer<typeof RecommendationIdParamsSchema>;
export type ListRecommendationsQueryInput = z.infer<typeof ListRecommendationsQuerySchema>;
export type ActionRecommendationBody = z.infer<typeof ActionRecommendationSchema>;
export type DismissRecommendationBody = z.infer<typeof DismissRecommendationSchema>;
export type SnoozeRecommendationBody = z.infer<typeof SnoozeRecommendationSchema>;
export type LabelPhotoBody = z.infer<typeof LabelPhotoSchema>;

export const recommendationIdValidation = withZodValidation({
  params: RecommendationIdParamsSchema
});

export const listRecommendationsValidation = withZodValidation({
  query: ListRecommendationsQuerySchema
});

export const actionRecommendationValidation = withZodValidation({
  params: RecommendationIdParamsSchema,
  body: ActionRecommendationSchema
});

export const dismissRecommendationValidation = withZodValidation({
  params: RecommendationIdParamsSchema,
  body: DismissRecommendationSchema
});

export const snoozeRecommendationValidation = withZodValidation({
  params: RecommendationIdParamsSchema,
  body: SnoozeRecommendationSchema
});

export const labelPhotoValidation = withZodValidation({
  body: LabelPhotoSchema
});

export const revenueSummaryRouteSchema = {
  tags: ["ai"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: [
        "dormantCustomers",
        "unsoldEstimates",
        "unpaidInvoices",
        "agingAssets",
        "maintenancePlanOpportunities",
        "totalOpportunityValue",
        "generatedAt",
        "fromCache"
      ],
      properties: {
        dormantCustomers: revenueSummaryCountBucketSchema,
        unsoldEstimates: revenueSummaryValueBucketSchema,
        unpaidInvoices: revenueSummaryValueBucketSchema,
        agingAssets: revenueSummaryCountBucketSchema,
        maintenancePlanOpportunities: revenueSummaryCountBucketSchema,
        totalOpportunityValue: { type: "string" },
        generatedAt: { type: "string", format: "date-time" },
        fromCache: { type: "boolean" }
      }
    },
    401: errorResponseSchema,
    403: errorResponseSchema
  }
} as const;

export const listRecommendationsRouteSchema = {
  tags: ["ai"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: recommendationDetailSchema
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

export const getRecommendationRouteSchema = {
  tags: ["ai"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["recommendation"],
      properties: {
        recommendation: recommendationDetailSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const mutateRecommendationRouteSchema = getRecommendationRouteSchema;

export const labelPhotoRouteSchema = {
  tags: ["ai"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["label", "caption"],
      properties: {
        label: { type: "string" },
        caption: { type: "string" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

// Revenue Agent proposals (recommendation → agent action). Bodies are strict allowlists.
export const proposeRecommendationValidation = withZodValidation({
  params: RecommendationIdParamsSchema
});

export const generateRevenueProposalsValidation = withZodValidation({
  body: GenerateRevenueProposalsBodySchema.default({})
});

const revenueProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "actionType", "state", "requiresApproval", "recommendationId", "headline",
    "estimatedRevenue", "proposedContent", "expiresAt", "createdAt"
  ],
  properties: {
    id: { type: "string" },
    actionType: { type: "string" },
    state: { type: "string" },
    requiresApproval: { type: "boolean" },
    recommendationId: { type: "string" },
    headline: { type: "string" },
    estimatedRevenue: { type: ["string", "null"] },
    proposedContent: {
      type: "object",
      additionalProperties: false,
      required: ["channel", "subject", "body"],
      properties: {
        channel: { type: "string" },
        subject: { type: ["string", "null"] },
        body: { type: "string" }
      }
    },
    expiresAt: { type: "string" },
    createdAt: { type: "string" }
  }
} as const;

export const proposeRecommendationRouteSchema = {
  tags: ["ai"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["proposal", "created"],
      properties: { proposal: revenueProposalJsonSchema, created: { type: "boolean" } }
    }
  }
};

export const generateRevenueProposalsRouteSchema = {
  tags: ["ai"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["created", "existing", "skipped", "proposals"],
      properties: {
        created: { type: "integer" },
        existing: { type: "integer" },
        skipped: { type: "integer" },
        proposals: { type: "array", items: revenueProposalJsonSchema }
      }
    }
  }
};
