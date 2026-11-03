import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const dateTimeSchema = z.string().datetime({ offset: true });
const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "void",
  "written_off"
]);
const paymentMethodSchema = z.enum(["card", "ach", "cash", "check", "financing", "other"]);
const manualPaymentMethodSchema = z.enum(["cash", "check", "other"]);
const paymentStatusSchema = z.enum(["pending", "succeeded", "failed", "refunded", "disputed"]);
const invoiceItemTypeSchema = z.enum(["service", "labor", "material", "fee"]);

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

const invoiceItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "invoiceId",
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
    invoiceId: { type: "string" },
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

const paymentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "invoiceId",
    "customerId",
    "collectedById",
    "amount",
    "method",
    "status",
    "stripePaymentIntentId",
    "stripeChargeId",
    "checkNumber",
    "referenceNumber",
    "notes",
    "paidAt",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    invoiceId: { type: "string" },
    customerId: { type: "string" },
    collectedById: nullableStringSchema,
    amount: { type: "string" },
    serviceFeeAmount: { type: "string" },
    bookingFeeAmount: { type: "string" },
    feeRefundable: { type: "boolean" },
    amountRefunded: { type: "string" },
    refundableAmount: { type: "string" },
    method: { type: "string" },
    status: { type: "string" },
    stripePaymentIntentId: nullableStringSchema,
    stripeChargeId: nullableStringSchema,
    checkNumber: nullableStringSchema,
    referenceNumber: nullableStringSchema,
    notes: nullableStringSchema,
    paidAt: nullableDateTimeSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const invoicePaymentSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "amount", "method", "status", "paidAt", "stripePaymentIntentId"],
  properties: {
    id: { type: "string" },
    amount: { type: "string" },
    method: { type: "string" },
    status: { type: "string" },
    paidAt: nullableDateTimeSchema,
    stripePaymentIntentId: nullableStringSchema,
    serviceFeeAmount: { type: "string" },
    bookingFeeAmount: { type: "string" },
    feeRefundable: { type: "boolean" }
  }
} as const;

const invoiceListItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "invoiceNumber",
    "title",
    "status",
    "total",
    "amountPaid",
    "balanceDue",
    "dueAt",
    "paidAt",
    "customer",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    invoiceNumber: { type: "string" },
    title: nullableStringSchema,
    status: { type: "string" },
    total: { type: "string" },
    amountPaid: { type: "string" },
    balanceDue: { type: "string" },
    serviceFeeAmount: { type: "string" },
    bookingFeeAmount: { type: "string" },
    dueAt: nullableDateTimeSchema,
    paidAt: nullableDateTimeSchema,
    customer: {
      type: "object",
      additionalProperties: false,
      required: ["id", "firstName", "lastName"],
      properties: {
        id: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" }
      }
    },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const invoiceDetailSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "invoiceNumber",
    "title",
    "status",
    "subtotal",
    "taxRate",
    "taxAmount",
    "discountAmount",
    "total",
    "amountPaid",
    "balanceDue",
    "issuedAt",
    "sentAt",
    "dueAt",
    "paidAt",
    "stripePaymentLinkUrl",
    "paymentToken",
    "messageToCustomer",
    "customer",
    "job",
    "items",
    "payments",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    invoiceNumber: { type: "string" },
    title: nullableStringSchema,
    status: { type: "string" },
    subtotal: { type: "string" },
    taxRate: nullableStringSchema,
    taxAmount: nullableStringSchema,
    discountAmount: nullableStringSchema,
    total: { type: "string" },
    amountPaid: { type: "string" },
    balanceDue: { type: "string" },
    serviceFeeAmount: { type: "string" },
    bookingFeeAmount: { type: "string" },
    issuedAt: nullableDateTimeSchema,
    sentAt: nullableDateTimeSchema,
    dueAt: nullableDateTimeSchema,
    paidAt: nullableDateTimeSchema,
    stripePaymentLinkUrl: nullableStringSchema,
    paymentToken: nullableStringSchema,
    messageToCustomer: nullableStringSchema,
    customer: customerSummarySchema,
    job: jobSummarySchema,
    items: {
      type: "array",
      items: invoiceItemSchema
    },
    payments: {
      type: "array",
      items: invoicePaymentSummarySchema
    },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

function buildUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .strict()
    .refine((input) => Object.keys(input).length > 0, {
      message: "At least one field is required"
    });
}

function buildInvoiceSuccessSchema(fieldName: string, statusCode: 200 | 201, payloadSchema: object) {
  return {
    tags: ["invoices"],
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

export const InvoiceIdParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const InvoiceItemIdParamsSchema = z
  .object({
    id: uuidSchema,
    itemId: uuidSchema
  })
  .strict();

export const CreateInvoiceItemSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
    itemType: invoiceItemTypeSchema.optional().default("service"),
    quantity: z.number().min(0.001),
    unitPrice: z.number().min(0),
    isTaxable: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
    priceBookItemId: uuidSchema.optional()
  })
  .strict();

export const UpdateInvoiceItemSchema = buildUpdateSchema({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  itemType: invoiceItemTypeSchema.optional(),
  quantity: z.number().min(0.001).optional(),
  unitPrice: z.number().min(0).optional(),
  isTaxable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  priceBookItemId: uuidSchema.nullable().optional()
});

export const CreateInvoiceSchema = z
  .object({
    customerId: uuidSchema,
    jobId: uuidSchema.optional(),
    estimateId: uuidSchema.optional(),
    fromJobId: uuidSchema.optional(),
    fromEstimateId: uuidSchema.optional(),
    title: z.string().trim().min(1).max(255).optional(),
    messageToCustomer: z.string().trim().optional(),
    internalNotes: z.string().trim().optional(),
    taxRate: z.number().min(0).max(1).optional().default(0),
    discountAmount: z.number().min(0).optional().default(0),
    dueAt: dateTimeSchema.optional(),
    items: z.array(CreateInvoiceItemSchema).optional()
  })
  .strict();

export const UpdateInvoiceSchema = buildUpdateSchema({
  customerId: uuidSchema.optional(),
  jobId: uuidSchema.optional(),
  estimateId: uuidSchema.optional(),
  title: z.string().trim().min(1).max(255).optional(),
  messageToCustomer: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  discountAmount: z.number().min(0).optional(),
  dueAt: dateTimeSchema.optional()
});

export const RecordPaymentSchema = z
  .object({
    amount: z.number().min(0.01),
    method: manualPaymentMethodSchema,
    checkNumber: z.string().trim().optional(),
    referenceNumber: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    paidAt: dateTimeSchema.optional()
  })
  .strict();

export const VoidInvoiceSchema = z
  .object({
    reason: z.string().trim().min(1)
  })
  .strict();

export const ListInvoicesQuerySchema = z
  .object({
    status: invoiceStatusSchema.optional(),
    customerId: uuidSchema.optional(),
    jobId: uuidSchema.optional(),
    search: z.string().trim().optional(),
    dueBefore: dateTimeSchema.optional(),
    dueAfter: dateTimeSchema.optional(),
    createdAfter: dateTimeSchema.optional(),
    createdBefore: dateTimeSchema.optional(),
    sortBy: z.enum(["createdAt", "dueAt", "total", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export const ListPaymentsQuerySchema = z
  .object({
    invoiceId: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    method: paymentMethodSchema.optional(),
    status: paymentStatusSchema.optional(),
    createdAfter: dateTimeSchema.optional(),
    createdBefore: dateTimeSchema.optional(),
    sortBy: z.enum(["createdAt", "amount"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export type InvoiceIdParams = z.infer<typeof InvoiceIdParamsSchema>;
export type InvoiceItemIdParams = z.infer<typeof InvoiceItemIdParamsSchema>;
export type VoidInvoiceBody = z.infer<typeof VoidInvoiceSchema>;

export const listInvoicesValidation = withZodValidation({ query: ListInvoicesQuerySchema });
export const createInvoiceValidation = withZodValidation({ body: CreateInvoiceSchema });
export const invoiceIdValidation = withZodValidation({ params: InvoiceIdParamsSchema });
export const updateInvoiceValidation = withZodValidation({
  params: InvoiceIdParamsSchema,
  body: UpdateInvoiceSchema
});
export const recordPaymentValidation = withZodValidation({
  params: InvoiceIdParamsSchema,
  body: RecordPaymentSchema
});
export const voidInvoiceValidation = withZodValidation({
  params: InvoiceIdParamsSchema,
  body: VoidInvoiceSchema
});
export const addInvoiceItemValidation = withZodValidation({
  params: InvoiceIdParamsSchema,
  body: CreateInvoiceItemSchema
});
export const updateInvoiceItemValidation = withZodValidation({
  params: InvoiceItemIdParamsSchema,
  body: UpdateInvoiceItemSchema
});
export const invoiceItemIdValidation = withZodValidation({ params: InvoiceItemIdParamsSchema });
export const listPaymentsValidation = withZodValidation({ query: ListPaymentsQuerySchema });

export const listInvoicesSchema = {
  tags: ["invoices"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: invoiceListItemSchema
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

export const createInvoiceSchema = buildInvoiceSuccessSchema("invoice", 201, invoiceDetailSchema);
export const getInvoiceSchema = buildInvoiceSuccessSchema("invoice", 200, invoiceDetailSchema);
export const updateInvoiceSchema = buildInvoiceSuccessSchema("invoice", 200, invoiceDetailSchema);
export const sendInvoiceSchema = buildInvoiceSuccessSchema("invoice", 200, invoiceDetailSchema);
export const resendInvoiceReminderSchema = buildInvoiceSuccessSchema("invoice", 200, invoiceDetailSchema);
export const voidInvoiceRouteSchema = buildInvoiceSuccessSchema("invoice", 200, invoiceDetailSchema);

export const recordPaymentSchema = {
  tags: ["invoices"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["payment", "invoice"],
      properties: {
        payment: paymentSchema,
        invoice: invoiceDetailSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const addInvoiceItemSchema = {
  tags: ["invoices"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["item"],
      properties: {
        item: invoiceItemSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const updateInvoiceItemRouteSchema = {
  tags: ["invoices"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["item"],
      properties: {
        item: invoiceItemSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const deleteInvoiceItemSchema = {
  tags: ["invoices"],
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

export const listInvoicePaymentsSchema = {
  tags: ["invoices"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["payments"],
      properties: {
        payments: {
          type: "array",
          items: invoicePaymentSummarySchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const listPaymentsSchema = {
  tags: ["payments"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: paymentSchema
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
