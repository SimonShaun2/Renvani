import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const dateTimeSchema = z.string().datetime({ offset: true });
const jobStatusSchema = z.enum([
  "lead",
  "estimate_requested",
  "estimate_sent",
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
  "closed"
]);
const jobTypeSchema = z.enum([
  "service_call",
  "maintenance",
  "installation",
  "inspection",
  "estimate_only",
  "warranty",
  "callback",
  "emergency"
]);
const jobPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
const photoTypeSchema = z.enum(["before", "after", "general"]);
const taskStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);
const productCategorySchema = z.enum(["service", "labor", "material", "equipment", "fee", "bundle"]);

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const nullableDateTimeSchema = {
  anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
} as const;

const nullableDateSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
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
  required: ["id", "firstName", "lastName", "phone"],
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
        state: { type: "string" },
        zip: { type: "string" },
        accessNotes: nullableStringSchema
      }
    },
    { type: "null" }
  ]
} as const;

const technicianSummarySchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "firstName", "lastName", "phone", "calendarColor"],
      properties: {
        id: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        phone: nullableStringSchema,
        calendarColor: nullableStringSchema
      }
    },
    { type: "null" }
  ]
} as const;

const assetSummarySchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "assetType", "brand", "model", "installDate", "lastServiceDate"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        assetType: { type: "string" },
        brand: nullableStringSchema,
        model: nullableStringSchema,
        installDate: nullableDateSchema,
        lastServiceDate: nullableDateSchema
      }
    },
    { type: "null" }
  ]
} as const;

const jobListItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "jobNumber",
    "title",
    "type",
    "priority",
    "status",
    "scheduledStart",
    "scheduledEnd",
    "customer",
    "property",
    "technician",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    jobNumber: { type: "string" },
    title: { type: "string" },
    type: { type: "string" },
    priority: { type: "string" },
    status: { type: "string" },
    scheduledStart: nullableDateTimeSchema,
    scheduledEnd: nullableDateTimeSchema,
    customer: customerSummarySchema,
    property: propertySummarySchema,
    technician: technicianSummarySchema,
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const jobDetailSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "jobNumber",
    "customerId",
    "propertyId",
    "assetId",
    "technicianId",
    "assignedById",
    "type",
    "priority",
    "status",
    "leadSource",
    "title",
    "description",
    "scheduledStart",
    "scheduledEnd",
    "scheduledDurationMinutes",
    "actualStart",
    "actualEnd",
    "techNotes",
    "completionNotes",
    "signatureUrl",
    "signedAt",
    "signedByName",
    "estimateTotal",
    "invoiceTotal",
    "amountPaid",
    "maintenancePlanId",
    "parentJobId",
    "tags",
    "customer",
    "property",
    "asset",
    "technician",
    "availableTransitions",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    crewId: { type: ["string", "null"] },
    id: { type: "string" },
    companyId: { type: "string" },
    jobNumber: { type: "string" },
    customerId: { type: "string" },
    propertyId: nullableStringSchema,
    assetId: nullableStringSchema,
    technicianId: nullableStringSchema,
    assignedById: nullableStringSchema,
    type: { type: "string" },
    priority: { type: "string" },
    status: { type: "string" },
    leadSource: nullableStringSchema,
    title: { type: "string" },
    description: nullableStringSchema,
    scheduledStart: nullableDateTimeSchema,
    scheduledEnd: nullableDateTimeSchema,
    scheduledDurationMinutes: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    actualStart: nullableDateTimeSchema,
    actualEnd: nullableDateTimeSchema,
    techNotes: nullableStringSchema,
    completionNotes: nullableStringSchema,
    signatureUrl: nullableStringSchema,
    signedAt: nullableDateTimeSchema,
    signedByName: nullableStringSchema,
    estimateTotal: nullableStringSchema,
    invoiceTotal: nullableStringSchema,
    amountPaid: nullableStringSchema,
    maintenancePlanId: nullableStringSchema,
    parentJobId: nullableStringSchema,
    tags: { type: "array", items: { type: "string" } },
    customer: customerSummarySchema,
    property: propertySummarySchema,
    asset: assetSummarySchema,
    technician: technicianSummarySchema,
    availableTransitions: {
      type: "array",
      items: { type: "string" }
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const noteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "jobId", "authorId", "content", "isInternal", "createdAt", "updatedAt", "deletedAt"],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    jobId: { type: "string" },
    authorId: nullableStringSchema,
    content: { type: "string" },
    isInternal: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const photoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "jobId",
    "uploadedById",
    "url",
    "thumbnailUrl",
    "caption",
    "takenAt",
    "photoType",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    jobId: { type: "string" },
    uploadedById: nullableStringSchema,
    url: { type: "string" },
    thumbnailUrl: nullableStringSchema,
    caption: nullableStringSchema,
    takenAt: nullableDateTimeSchema,
    photoType: nullableStringSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const taskSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "jobId",
    "assignedToId",
    "title",
    "description",
    "status",
    "isRequired",
    "completedAt",
    "completedById",
    "estimatedMinutes",
    "actualMinutes",
    "sortOrder",
    "notes",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    jobId: { type: "string" },
    assignedToId: nullableStringSchema,
    title: { type: "string" },
    description: nullableStringSchema,
    status: { type: "string", enum: ["pending", "in_progress", "completed", "skipped"] },
    isRequired: { type: "boolean" },
    completedAt: nullableDateTimeSchema,
    completedById: nullableStringSchema,
    estimatedMinutes: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    actualMinutes: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    sortOrder: { type: "integer" },
    notes: nullableStringSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const jobProductSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "jobId",
    "productCatalogId",
    "name",
    "description",
    "category",
    "quantity",
    "unitPrice",
    "total",
    "isTaxable",
    "addedById",
    "isUpsell",
    "upsellApproved",
    "upsellApprovedAt",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    jobId: { type: "string" },
    productCatalogId: nullableStringSchema,
    name: { type: "string" },
    description: nullableStringSchema,
    category: { type: "string", enum: ["service", "labor", "material", "equipment", "fee", "bundle"] },
    quantity: { type: "string" },
    unitPrice: { type: "string" },
    total: { type: "string" },
    isTaxable: {
      anyOf: [{ type: "boolean" }, { type: "null" }]
    },
    addedById: nullableStringSchema,
    isUpsell: { type: "boolean" },
    upsellApproved: { type: "boolean" },
    upsellApprovedAt: nullableDateTimeSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const activityEventSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "eventType",
    "actorId",
    "actorType",
    "actorName",
    "entityType",
    "entityId",
    "customerId",
    "jobId",
    "estimateId",
    "invoiceId",
    "payload",
    "summary",
    "occurredAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    eventType: { type: "string" },
    actorId: nullableStringSchema,
    actorType: nullableStringSchema,
    actorName: nullableStringSchema,
    entityType: { type: "string" },
    entityId: { type: "string" },
    customerId: nullableStringSchema,
    jobId: nullableStringSchema,
    estimateId: nullableStringSchema,
    invoiceId: nullableStringSchema,
    payload: {},
    summary: { type: "string" },
    occurredAt: { type: "string", format: "date-time" }
  }
} as const;

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === "string"
        ? entry
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
        : []
    );
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return undefined;
}

function parseStatusQuery(value: unknown): string | string[] | undefined {
  const values = parseStringArray(value);

  if (!values || values.length === 0) {
    return undefined;
  }

  return values.length === 1 ? values[0] : values;
}

function buildUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .strict()
    .refine((input) => Object.keys(input).length > 0, {
      message: "At least one field is required"
    });
}

export const JobIdParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

/** Line-item description cap (create, preview, add product). */
export const JOB_LINE_ITEM_DESCRIPTION_MAX = 2000;

const jobLineItemInputSchema = z
  .object({
    productCatalogId: uuidSchema.optional(),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(JOB_LINE_ITEM_DESCRIPTION_MAX).optional(),
    category: productCategorySchema.optional().default("service"),
    quantity: z.coerce.number().positive().optional().default(1),
    unitPrice: z.coerce.number().positive().optional(),
    isTaxable: z.boolean().optional().default(true),
    isUpsell: z.boolean().optional().default(false)
  })
  .strict()
  .refine((input) => input.productCatalogId !== undefined || (input.name !== undefined && input.unitPrice !== undefined), {
    message: "name and unitPrice are required when productCatalogId is not provided",
    path: ["name"]
  });

export const MAX_JOB_LINE_ITEMS_AT_CREATE = 50;

export const JobCreatePreviewSchema = z
  .object({
    customerId: uuidSchema.optional(),
    products: z.array(jobLineItemInputSchema).max(MAX_JOB_LINE_ITEMS_AT_CREATE).optional()
  })
  .strict();

export const CreateJobSchema = z
  .object({
    products: z.array(jobLineItemInputSchema).max(MAX_JOB_LINE_ITEMS_AT_CREATE).optional(),
    crewId: uuidSchema.optional(),
    customerId: uuidSchema,
    propertyId: uuidSchema.optional(),
    assetId: uuidSchema.optional(),
    technicianId: uuidSchema.optional(),
    type: jobTypeSchema.optional().default("service_call"),
    priority: jobPrioritySchema.optional().default("normal"),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
    leadSource: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    scheduledStart: dateTimeSchema.optional(),
    scheduledEnd: dateTimeSchema.optional()
  })
  .strict()
  .refine((input) => {
    return (input.scheduledStart === undefined && input.scheduledEnd === undefined) ||
      (input.scheduledStart !== undefined && input.scheduledEnd !== undefined);
  }, {
    message: "scheduledStart and scheduledEnd must be provided together",
    path: ["scheduledEnd"]
  })
  .refine((input) => {
    if (!input.scheduledStart || !input.scheduledEnd) {
      return true;
    }

    return new Date(input.scheduledEnd).getTime() > new Date(input.scheduledStart).getTime();
  }, {
    message: "scheduledEnd must be after scheduledStart",
    path: ["scheduledEnd"]
  });

export const UpdateJobSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional(),
    type: jobTypeSchema.optional(),
    priority: jobPrioritySchema.optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    techNotes: z.string().trim().optional(),
    technicianId: uuidSchema.optional(),
    scheduledStart: dateTimeSchema.optional(),
    scheduledEnd: dateTimeSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required"
  })
  .refine((input) => {
    return (input.scheduledStart === undefined && input.scheduledEnd === undefined) ||
      (input.scheduledStart !== undefined && input.scheduledEnd !== undefined);
  }, {
    message: "scheduledStart and scheduledEnd must be provided together",
    path: ["scheduledEnd"]
  })
  .refine((input) => {
    if (!input.scheduledStart || !input.scheduledEnd) {
      return true;
    }

    return new Date(input.scheduledEnd).getTime() > new Date(input.scheduledStart).getTime();
  }, {
    message: "scheduledEnd must be after scheduledStart",
    path: ["scheduledEnd"]
  });

export const TransitionStatusSchema = z
  .object({
    status: jobStatusSchema,
    reason: z.string().trim().optional()
  })
  .strict();

export const AssignTechnicianSchema = z
  .object({
    technicianId: uuidSchema
  })
  .strict();

export const ScheduleJobSchema = z
  .object({
    scheduledStart: dateTimeSchema,
    scheduledEnd: dateTimeSchema
  })
  .strict()
  .refine((input) => new Date(input.scheduledEnd).getTime() > new Date(input.scheduledStart).getTime(), {
    message: "scheduledEnd must be after scheduledStart",
    path: ["scheduledEnd"]
  });

export const CompleteJobSchema = z
  .object({
    completionNotes: z.string().trim().optional(),
    signatureUrl: z.string().trim().url().optional(),
    signedByName: z.string().trim().max(255).optional(),
    signedAt: dateTimeSchema.optional()
  })
  .strict();

export const AddNoteSchema = z
  .object({
    content: z.string().trim().min(1),
    isInternal: z.boolean().optional().default(true),
    noteKind: z.enum(["internal", "field"]).optional()
  })
  .strict();

export const AddPhotoSchema = z
  .object({
    url: z.string().trim().url(),
    thumbnailUrl: z.string().trim().url().optional(),
    caption: z.string().trim().optional(),
    photoType: photoTypeSchema.optional().default("general"),
    takenAt: dateTimeSchema.optional()
  })
  .strict();

export const TaskIdParamsSchema = z
  .object({
    id: uuidSchema,
    taskId: uuidSchema
  })
  .strict();

export const JobProductIdParamsSchema = z
  .object({
    id: uuidSchema,
    productId: uuidSchema
  })
  .strict();

export const CreateTaskSchema = z
  .object({
    assignedToId: uuidSchema.optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
    isRequired: z.boolean().optional().default(false),
    estimatedMinutes: z.coerce.number().int().min(1).optional(),
    actualMinutes: z.coerce.number().int().min(0).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().optional()
  })
  .strict();

export const UpdateTaskSchema = buildUpdateSchema({
  assignedToId: z.union([uuidSchema, z.null()]).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  status: taskStatusSchema.optional(),
  isRequired: z.boolean().optional(),
  estimatedMinutes: z.coerce.number().int().min(1).optional(),
  actualMinutes: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().optional()
});

export const ReorderTasksSchema = z
  .object({
    orderedIds: z.array(uuidSchema).min(1)
  })
  .strict();

export const AddJobProductSchema = jobLineItemInputSchema;

export const UpdateJobProductSchema = buildUpdateSchema({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  category: productCategorySchema.optional(),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().positive().optional(),
  isTaxable: z.boolean().optional(),
  isUpsell: z.boolean().optional()
});

export const ListJobsQuerySchema = z
  .object({
    status: z.preprocess(
      parseStatusQuery,
      z.union([jobStatusSchema, z.array(jobStatusSchema)]).optional()
    ),
    technicianId: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    propertyId: uuidSchema.optional(),
    assetId: uuidSchema.optional(),
    type: jobTypeSchema.optional(),
    priority: jobPrioritySchema.optional(),
    scheduledAfter: dateTimeSchema.optional(),
    scheduledBefore: dateTimeSchema.optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["scheduledStart", "createdAt", "priority", "status"]).default("scheduledStart"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export type JobIdParams = z.infer<typeof JobIdParamsSchema>;
export type TransitionStatusBody = z.infer<typeof TransitionStatusSchema>;
export type AssignTechnicianBody = z.infer<typeof AssignTechnicianSchema>;
export type TaskIdParams = z.infer<typeof TaskIdParamsSchema>;
export type JobProductIdParams = z.infer<typeof JobProductIdParamsSchema>;
export type ReorderTasksBody = z.infer<typeof ReorderTasksSchema>;

export const listJobsValidation = withZodValidation({ query: ListJobsQuerySchema });
export const createJobValidation = withZodValidation({ body: CreateJobSchema });
export const jobCreatePreviewValidation = withZodValidation({ body: JobCreatePreviewSchema });
export const jobIdValidation = withZodValidation({ params: JobIdParamsSchema });
export const updateJobValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: UpdateJobSchema
});
export const transitionStatusValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: TransitionStatusSchema
});
export const assignTechnicianValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: AssignTechnicianSchema
});
export const scheduleJobValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: ScheduleJobSchema
});
export const completeJobValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: CompleteJobSchema
});
export const addNoteValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: AddNoteSchema
});
export const addPhotoValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: AddPhotoSchema
});
export const listTasksValidation = withZodValidation({ params: JobIdParamsSchema });
export const createTaskValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: CreateTaskSchema
});
export const updateTaskValidation = withZodValidation({
  params: TaskIdParamsSchema,
  body: UpdateTaskSchema
});
export const completeTaskValidation = withZodValidation({ params: TaskIdParamsSchema });
export const deleteTaskValidation = withZodValidation({ params: TaskIdParamsSchema });
export const reorderTasksValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: ReorderTasksSchema
});
export const listJobProductsValidation = withZodValidation({ params: JobIdParamsSchema });
export const addJobProductValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: AddJobProductSchema
});
export const updateJobProductValidation = withZodValidation({
  params: JobProductIdParamsSchema,
  body: UpdateJobProductSchema
});
export const removeJobProductValidation = withZodValidation({ params: JobProductIdParamsSchema });
export const approveUpsellValidation = withZodValidation({ params: JobProductIdParamsSchema });
export const notesQueryValidation = withZodValidation({ params: JobIdParamsSchema });
export const photosQueryValidation = withZodValidation({ params: JobIdParamsSchema });
export const activityQueryValidation = withZodValidation({ params: JobIdParamsSchema });

export const listJobsSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: jobListItemSchema
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

export const createJobSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["job"],
      properties: {
        job: jobDetailSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const getJobSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["job"],
      properties: {
        job: jobDetailSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const updateJobSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["job"],
      properties: {
        job: jobDetailSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const transitionStatusRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["job"],
      properties: {
        job: jobDetailSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const assignTechnicianRouteSchema = transitionStatusRouteSchema;
export const scheduleJobRouteSchema = transitionStatusRouteSchema;
export const completeJobRouteSchema = transitionStatusRouteSchema;

export const addNoteRouteSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["note"],
      properties: {
        note: noteSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

// Params are validated by jobIdValidation (zod); a zod object here is not valid JSON Schema.
export const getJobServiceBriefRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["brief"],
      properties: {
        brief: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              // Unknown keys are dropped by the serializer (no additionalProperties:false inside anyOf, which would fail the branch match instead of stripping).
              required: ["contractVersion", "jobId", "companyId", "resourceVersion", "sections", "checklistSummary"],
              properties: {
                contractVersion: { type: "string" },
                jobId: { type: "string", format: "uuid" },
                companyId: { type: "string", format: "uuid" },
                resourceVersion: { type: "string" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "title", "body", "sourceKind"],
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      body: { type: "string" },
                      sourceKind: { type: "string" },
                      confidence: { type: "number" },
                      policyRef: { type: "string" }
                    }
                  }
                },
                checklistSummary: {
                  type: "object",
                  required: ["total", "requiredPending"],
                  properties: {
                    total: { type: "integer" },
                    requiredPending: { type: "integer" }
                  }
                }
              }
            }
          ]
        }
      }
    }
  }
};

// Params are validated by jobIdValidation (zod); a zod object here is not valid JSON Schema.
export const getJobPreparationStatusRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["preparation"],
      properties: {
        preparation: {
          type: "object",
          additionalProperties: false,
          required: ["readyForField", "blockers"],
          properties: {
            readyForField: { type: "boolean" },
            blockers: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  }
};

export const getNotesSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["notes"],
      properties: {
        notes: {
          type: "array",
          items: noteSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const addPhotoRouteSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["photo"],
      properties: {
        photo: photoSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const listTasksSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["tasks"],
      properties: {
        tasks: {
          type: "array",
          items: taskSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const createTaskRouteSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["task"],
      properties: {
        task: taskSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const updateTaskRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["task"],
      properties: {
        task: taskSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const deleteTaskRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["success"],
      properties: {
        success: { type: "boolean" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const reorderTasksRouteSchema = deleteTaskRouteSchema;

export const listJobProductsSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["products"],
      properties: {
        products: {
          type: "array",
          items: jobProductSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const addJobProductRouteSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["product"],
      properties: {
        product: jobProductSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const updateJobProductRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["product"],
      properties: {
        product: jobProductSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const removeJobProductRouteSchema = deleteTaskRouteSchema;
export const approveUpsellRouteSchema = updateJobProductRouteSchema;

export const getPhotosSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["photos"],
      properties: {
        photos: {
          type: "array",
          items: photoSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const getActivitySchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["activity"],
      properties: {
        activity: {
          type: "array",
          items: activityEventSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
