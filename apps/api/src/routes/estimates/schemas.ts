import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const dateTimeSchema = z.string().datetime({ offset: true });
const estimateStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "approved",
  "declined",
  "expired",
  "converted",
  "revised"
]);
const estimateItemTypeSchema = z.enum(["service", "labor", "material", "fee"]);

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

const customerSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "firstName", "lastName"],
  properties: {
    id: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    phone: nullableStringSchema,
    email: nullableStringSchema
  }
} as const;

const propertySummarySchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "addressLine1", "city", "state"],
      properties: {
        id: { type: "string" },
        addressLine1: { type: "string" },
        city: { type: "string" },
        state: { type: "string" }
      }
    },
    { type: "null" }
  ]
} as const;

const jobSummarySchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "jobNumber", "title"],
      properties: {
        id: { type: "string" },
        jobNumber: { type: "string" },
        title: { type: "string" }
      }
    },
    { type: "null" }
  ]
} as const;

const estimateItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "estimateId",
    "companyId",
    "name",
    "description",
    "itemType",
    "quantity",
    "unitPrice",
    "total",
    "isTaxable",
    "sortOrder",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    estimateId: { type: "string" },
    companyId: { type: "string" },
    priceBookItemId: nullableStringSchema,
    name: { type: "string" },
    description: nullableStringSchema,
    itemType: { type: "string" },
    quantity: { type: "string" },
    unitPrice: { type: "string" },
    total: { type: "string" },
    isTaxable: {
      anyOf: [{ type: "boolean" }, { type: "null" }]
    },
    sortOrder: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const estimateListItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "estimateNumber",
    "title",
    "status",
    "tierLabel",
    "tierGroupId",
    "total",
    "subtotal",
    "customer",
    "sentAt",
    "expiresAt",
    "approvedAt",
    "declinedAt",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    estimateNumber: { type: "string" },
    title: nullableStringSchema,
    status: { type: "string" },
    tierLabel: nullableStringSchema,
    tierGroupId: nullableStringSchema,
    total: { type: "string" },
    subtotal: { type: "string" },
    customer: customerSummarySchema,
    sentAt: nullableDateTimeSchema,
    expiresAt: nullableDateTimeSchema,
    approvedAt: nullableDateTimeSchema,
    declinedAt: nullableDateTimeSchema,
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const estimateDetailSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "estimateNumber",
    "jobId",
    "customerId",
    "propertyId",
    "createdById",
    "status",
    "tierLabel",
    "tierGroupId",
    "isSelectedTier",
    "subtotal",
    "taxRate",
    "taxAmount",
    "discountAmount",
    "total",
    "title",
    "messageToCustomer",
    "internalNotes",
    "approvalToken",
    "approvedAt",
    "approvedByName",
    "approvedSignatureUrl",
    "declinedAt",
    "declineReason",
    "expiresAt",
    "sentAt",
    "viewedAt",
    "followUpSentAt",
    "financingOffered",
    "customer",
    "property",
    "job",
    "items",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    estimateNumber: { type: "string" },
    jobId: nullableStringSchema,
    customerId: { type: "string" },
    propertyId: nullableStringSchema,
    createdById: nullableStringSchema,
    status: { type: "string" },
    tierLabel: nullableStringSchema,
    tierGroupId: nullableStringSchema,
    isSelectedTier: {
      anyOf: [{ type: "boolean" }, { type: "null" }]
    },
    subtotal: { type: "string" },
    taxRate: nullableStringSchema,
    taxAmount: nullableStringSchema,
    discountAmount: nullableStringSchema,
    total: { type: "string" },
    title: nullableStringSchema,
    messageToCustomer: nullableStringSchema,
    internalNotes: nullableStringSchema,
    approvalToken: nullableStringSchema,
    approvedAt: nullableDateTimeSchema,
    approvedByName: nullableStringSchema,
    approvedSignatureUrl: nullableStringSchema,
    declinedAt: nullableDateTimeSchema,
    declineReason: nullableStringSchema,
    expiresAt: nullableDateTimeSchema,
    sentAt: nullableDateTimeSchema,
    viewedAt: nullableDateTimeSchema,
    followUpSentAt: nullableDateTimeSchema,
    financingOffered: {
      anyOf: [{ type: "boolean" }, { type: "null" }]
    },
    customer: customerSummarySchema,
    property: propertySummarySchema,
    job: jobSummarySchema,
    items: {
      type: "array",
      items: estimateItemSchema
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const minimalJobSchema = {
  type: "object",
  additionalProperties: true
} as const;

function buildUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .strict()
    .refine((input) => Object.keys(input).length > 0, {
      message: "At least one field is required"
    });
}

function buildSuccessSchema(fieldName: string, statusCode: 200 | 201, payloadSchema: object) {
  return {
    tags: ["estimates"],
    response: {
      [statusCode]: {
        type: "object",
        additionalProperties: false,
        required: [fieldName],
        properties: {
          [fieldName]: payloadSchema
        }
      },
      400: errorResponseSchema,
      401: errorResponseSchema,
      404: errorResponseSchema,
      409: errorResponseSchema
    }
  } as const;
}

export const EstimateIdParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const EstimateItemIdParamsSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema
  })
  .strict();

export const CreateEstimateItemSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
    itemType: estimateItemTypeSchema.optional().default("service"),
    quantity: z.number().min(0.001),
    unitPrice: z.number().min(0),
    isTaxable: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
    priceBookItemId: uuidSchema.optional()
  })
  .strict();

export const UpdateEstimateItemSchema = buildUpdateSchema({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  itemType: estimateItemTypeSchema.optional(),
  quantity: z.number().min(0.001).optional(),
  unitPrice: z.number().min(0).optional(),
  isTaxable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  priceBookItemId: uuidSchema.nullable().optional()
});

export const CreateEstimateSchema = z
  .object({
    customerId: uuidSchema,
    jobId: uuidSchema.optional(),
    propertyId: uuidSchema.optional(),
    title: z.string().trim().min(1).max(255).optional(),
    messageToCustomer: z.string().trim().optional(),
    internalNotes: z.string().trim().optional(),
    taxRate: z.number().min(0).max(1).optional().default(0),
    discountAmount: z.number().min(0).optional().default(0),
    financingOffered: z.boolean().optional().default(false),
    tierLabel: z.string().trim().max(255).optional(),
    tierGroupId: uuidSchema.optional(),
    items: z.array(CreateEstimateItemSchema).optional()
  })
  .strict();

export const UpdateEstimateSchema = buildUpdateSchema({
  customerId: uuidSchema.optional(),
  jobId: uuidSchema.optional(),
  propertyId: uuidSchema.optional(),
  title: z.string().trim().min(1).max(255).optional(),
  messageToCustomer: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  discountAmount: z.number().min(0).optional(),
  financingOffered: z.boolean().optional(),
  tierLabel: z.string().trim().max(255).optional(),
  tierGroupId: uuidSchema.optional()
});

export const DeclineEstimateSchema = z
  .object({
    reason: z.string().trim().optional()
  })
  .strict();

export const ListEstimatesQuerySchema = z
  .object({
    status: estimateStatusSchema.optional(),
    customerId: uuidSchema.optional(),
    jobId: uuidSchema.optional(),
    tierGroupId: uuidSchema.optional(),
    search: z.string().trim().optional(),
    createdAfter: dateTimeSchema.optional(),
    createdBefore: dateTimeSchema.optional(),
    sortBy: z.enum(["createdAt", "total", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export type EstimateIdParams = z.infer<typeof EstimateIdParamsSchema>;
export type EstimateItemIdParams = z.infer<typeof EstimateItemIdParamsSchema>;
export type DeclineEstimateBody = z.infer<typeof DeclineEstimateSchema>;

export const listEstimatesValidation = withZodValidation({ query: ListEstimatesQuerySchema });
export const createEstimateValidation = withZodValidation({ body: CreateEstimateSchema });
export const estimateIdValidation = withZodValidation({ params: EstimateIdParamsSchema });
export const updateEstimateValidation = withZodValidation({
  params: EstimateIdParamsSchema,
  body: UpdateEstimateSchema
});
export const declineEstimateValidation = withZodValidation({
  params: EstimateIdParamsSchema,
  body: DeclineEstimateSchema
});
export const addEstimateItemValidation = withZodValidation({
  params: EstimateIdParamsSchema,
  body: CreateEstimateItemSchema
});
export const updateEstimateItemValidation = withZodValidation({
  params: EstimateItemIdParamsSchema,
  body: UpdateEstimateItemSchema
});
export const estimateItemIdValidation = withZodValidation({ params: EstimateItemIdParamsSchema });

export const listEstimatesSchema = {
  tags: ["estimates"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: estimateListItemSchema
        },
        total: { type: "integer" },
        page: { type: "integer" },
        limit: { type: "integer" },
        totalPages: { type: "integer" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const createEstimateSchema = buildSuccessSchema("estimate", 201, estimateDetailSchema);
export const getEstimateSchema = buildSuccessSchema("estimate", 200, estimateDetailSchema);
export const updateEstimateSchema = buildSuccessSchema("estimate", 200, estimateDetailSchema);

export const deleteEstimateSchema = {
  tags: ["estimates"],
  response: {
    204: {
      type: "null"
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const sendEstimateSchema = buildSuccessSchema("estimate", 200, estimateDetailSchema);
export const approveEstimateSchema = buildSuccessSchema("estimate", 200, estimateDetailSchema);
export const declineEstimateRouteSchema = buildSuccessSchema("estimate", 200, estimateDetailSchema);
export const reviseEstimateSchema = buildSuccessSchema("estimate", 200, estimateDetailSchema);

export const convertEstimateSchema = {
  tags: ["estimates"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["job"],
      properties: {
        job: minimalJobSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const listEstimateItemsSchema = {
  tags: ["estimates"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: estimateItemSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const addEstimateItemSchema = {
  tags: ["estimates"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["item"],
      properties: {
        item: estimateItemSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const updateEstimateItemRouteSchema = {
  tags: ["estimates"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["item"],
      properties: {
        item: estimateItemSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const deleteEstimateItemSchema = {
  tags: ["estimates"],
  response: {
    204: {
      type: "null"
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;
