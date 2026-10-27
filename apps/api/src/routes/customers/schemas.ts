import { z } from "zod";

import { listCustomerHistoryTimelineQuerySchema } from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const currentYear = new Date().getFullYear();
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidSchema = z.string().uuid();

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const nullableNumberSchema = {
  anyOf: [{ type: "number" }, { type: "null" }]
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

const customerListItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "firstName",
    "lastName",
    "displayName",
    "email",
    "phone",
    "tags",
    "lifetimeValue",
    "totalJobs",
    "lastServiceDate",
    "doNotContact",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    displayName: nullableStringSchema,
    email: nullableStringSchema,
    phone: nullableStringSchema,
    tags: { type: "array", items: { type: "string" } },
    lifetimeValue: { type: "string" },
    totalJobs: { type: "integer" },
    lastServiceDate: nullableStringSchema,
    doNotContact: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const assetResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "propertyId",
    "customerId",
    "name",
    "assetType",
    "brand",
    "model",
    "serialNumber",
    "installDate",
    "warrantyExpiration",
    "lastServiceDate",
    "nextServiceDate",
    "condition",
    "conditionNotes",
    "conditionScore",
    "replacementProbability",
    "photoUrls",
    "notes",
    "isActive",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    propertyId: { type: "string" },
    customerId: { type: "string" },
    name: { type: "string" },
    assetType: { type: "string" },
    brand: nullableStringSchema,
    model: nullableStringSchema,
    serialNumber: nullableStringSchema,
    installDate: nullableStringSchema,
    warrantyExpiration: nullableStringSchema,
    lastServiceDate: nullableStringSchema,
    nextServiceDate: nullableStringSchema,
    condition: {
      anyOf: [
        { type: "string", enum: ["excellent", "good", "fair", "poor", "failed"] },
        { type: "null" }
      ]
    },
    conditionNotes: nullableStringSchema,
    conditionScore: nullableIntegerSchema,
    replacementProbability: nullableStringSchema,
    photoUrls: { type: "array", items: { type: "string" } },
    notes: nullableStringSchema,
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const propertyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "customerId",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "zip",
    "country",
    "lat",
    "lng",
    "type",
    "sqft",
    "yearBuilt",
    "accessNotes",
    "notes",
    "isPrimary",
    "isActive",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    customerId: { type: "string" },
    addressLine1: { type: "string" },
    addressLine2: nullableStringSchema,
    city: { type: "string" },
    state: { type: "string" },
    zip: { type: "string" },
    country: nullableStringSchema,
    lat: nullableStringSchema,
    lng: nullableStringSchema,
    type: { type: "string", enum: ["residential", "commercial", "industrial", "multi_family"] },
    sqft: nullableIntegerSchema,
    yearBuilt: nullableIntegerSchema,
    accessNotes: nullableStringSchema,
    notes: nullableStringSchema,
    isPrimary: { type: "boolean" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const propertyWithAssetsResponseSchema = {
  ...propertyResponseSchema,
  required: [...propertyResponseSchema.required, "assets"],
  properties: {
    ...propertyResponseSchema.properties,
    assets: {
      type: "array",
      items: assetResponseSchema
    }
  }
} as const;

const customerResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "firstName",
    "lastName",
    "displayName",
    "email",
    "phone",
    "altPhone",
    "leadSource",
    "referredBy",
    "tags",
    "internalNotes",
    "lifetimeValue",
    "totalJobs",
    "lastServiceDate",
    "firstServiceDate",
    "prefersSms",
    "prefersEmail",
    "doNotContact",
    "stripeCustomerId",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    displayName: nullableStringSchema,
    email: nullableStringSchema,
    phone: nullableStringSchema,
    altPhone: nullableStringSchema,
    leadSource: nullableStringSchema,
    referredBy: nullableStringSchema,
    tags: { type: "array", items: { type: "string" } },
    internalNotes: nullableStringSchema,
    lifetimeValue: { type: "string" },
    totalJobs: { type: "integer" },
    lastServiceDate: nullableStringSchema,
    firstServiceDate: nullableStringSchema,
    prefersSms: { type: "boolean" },
    prefersEmail: { type: "boolean" },
    doNotContact: { type: "boolean" },
    stripeCustomerId: nullableStringSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const customerWithGraphResponseSchema = {
  ...customerResponseSchema,
  required: [...customerResponseSchema.required, "properties"],
  properties: {
    ...customerResponseSchema.properties,
    properties: {
      type: "array",
      items: propertyWithAssetsResponseSchema
    }
  }
} as const;

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return undefined;
}

function parseTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === "string"
        ? entry
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : []
    );
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return undefined;
}

function buildUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .strict()
    .refine((input) => Object.keys(input).length > 0, {
      message: "At least one field is required"
    });
}

export const CustomerIdParamsSchema = z
  .object({
    id: uuidSchema
  })
  .strict();

export const PropertyIdParamsSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema
  })
  .strict();

export const AssetIdParamsSchema = z
  .object({
    id: uuidSchema,
    propertyId: uuidSchema,
    assetId: uuidSchema
  })
  .strict();

export const CreateCustomerSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    displayName: z.string().trim().max(255).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).optional(),
    altPhone: z.string().trim().min(1).optional(),
    leadSource: z.string().trim().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    internalNotes: z.string().trim().min(1).optional(),
    prefersSms: z.boolean().optional().default(true),
    prefersEmail: z.boolean().optional().default(true),
    doNotContact: z.boolean().optional().default(false)
  })
  .strict();

export const UpdateCustomerSchema = buildUpdateSchema({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().max(255).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  altPhone: z.string().trim().min(1).optional(),
  leadSource: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  internalNotes: z.string().trim().min(1).optional(),
  prefersSms: z.boolean().optional(),
  prefersEmail: z.boolean().optional(),
  doNotContact: z.boolean().optional()
});

export const ListCustomersQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    tags: z.preprocess(parseTags, z.array(z.string().trim().min(1)).optional()),
    status: z.enum(["active", "dormant"]).optional(),
    hasActiveMaintenancePlan: z.preprocess(parseBoolean, z.boolean().optional()),
    hasOverdueInvoice: z.preprocess(parseBoolean, z.boolean().optional()),
    sortBy: z.enum(["lastName", "lastServiceDate", "lifetimeValue", "createdAt"]).default("lastName"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export const SearchCustomersQuerySchema = z
  .object({
    q: z.string().trim().min(1)
  })
  .strict();

export const CreatePropertySchema = z
  .object({
    addressLine1: z.string().trim().min(1).max(255),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(50),
    zip: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).default("US"),
    type: z.enum(["residential", "commercial", "industrial", "multi_family"]).default("residential"),
    sqft: z.coerce.number().int().positive().optional(),
    yearBuilt: z.coerce.number().int().min(1800).max(currentYear).optional(),
    accessNotes: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional(),
    isPrimary: z.boolean().default(false)
  })
  .strict();

export const UpdatePropertySchema = buildUpdateSchema({
  addressLine1: z.string().trim().min(1).max(255).optional(),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().min(1).max(50).optional(),
  zip: z.string().trim().min(1).max(20).optional(),
  country: z.string().trim().min(1).optional(),
  type: z.enum(["residential", "commercial", "industrial", "multi_family"]).optional(),
  sqft: z.coerce.number().int().positive().optional(),
  yearBuilt: z.coerce.number().int().min(1800).max(currentYear).optional(),
  accessNotes: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  isPrimary: z.boolean().optional()
});

export const CreateAssetSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    assetType: z.string().trim().min(1).max(100),
    brand: z.string().trim().max(100).optional(),
    model: z.string().trim().max(100).optional(),
    serialNumber: z.string().trim().max(100).optional(),
    installDate: z.string().regex(isoDatePattern, "Invalid ISO date").optional(),
    warrantyExpiration: z.string().regex(isoDatePattern, "Invalid ISO date").optional(),
    condition: z.enum(["excellent", "good", "fair", "poor", "failed"]).optional(),
    conditionNotes: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional()
  })
  .strict();

export const UpdateAssetSchema = buildUpdateSchema({
  name: z.string().trim().min(1).max(255).optional(),
  assetType: z.string().trim().min(1).max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  installDate: z.string().regex(isoDatePattern, "Invalid ISO date").optional(),
  warrantyExpiration: z.string().regex(isoDatePattern, "Invalid ISO date").optional(),
  condition: z.enum(["excellent", "good", "fair", "poor", "failed"]).optional(),
  conditionNotes: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  lastServiceDate: z.string().regex(isoDatePattern, "Invalid ISO date").optional(),
  nextServiceDate: z.string().regex(isoDatePattern, "Invalid ISO date").optional(),
  photoUrls: z.array(z.string().trim().min(1)).optional()
});

export type CustomerIdParams = z.infer<typeof CustomerIdParamsSchema>;
export type PropertyIdParams = z.infer<typeof PropertyIdParamsSchema>;
export type AssetIdParams = z.infer<typeof AssetIdParamsSchema>;
export type CustomerListQuery = z.infer<typeof ListCustomersQuerySchema>;
export type SearchCustomersQuery = z.infer<typeof SearchCustomersQuerySchema>;

export const listCustomersValidation = withZodValidation({ query: ListCustomersQuerySchema });
export const searchCustomersValidation = withZodValidation({ query: SearchCustomersQuerySchema });
export const createCustomerValidation = withZodValidation({ body: CreateCustomerSchema });
export const customerIdValidation = withZodValidation({ params: CustomerIdParamsSchema });
export const CreateCustomerNoteSchema = z
  .object({
    content: z.string().trim().min(1).max(10_000),
    isInternal: z.boolean().optional(),
    notedAt: z.string().datetime({ offset: true }).optional()
  })
  .strict();
export type CreateCustomerNoteBody = z.infer<typeof CreateCustomerNoteSchema>;
export const createCustomerNoteValidation = withZodValidation({
  params: CustomerIdParamsSchema,
  body: CreateCustomerNoteSchema
});
export const updateCustomerValidation = withZodValidation({
  params: CustomerIdParamsSchema,
  body: UpdateCustomerSchema
});
export const propertyListValidation = withZodValidation({ params: CustomerIdParamsSchema });
export const createPropertyValidation = withZodValidation({
  params: CustomerIdParamsSchema,
  body: CreatePropertySchema
});
export const propertyIdValidation = withZodValidation({ params: PropertyIdParamsSchema });
export const updatePropertyValidation = withZodValidation({
  params: PropertyIdParamsSchema,
  body: UpdatePropertySchema
});
export const createAssetValidation = withZodValidation({
  params: PropertyIdParamsSchema,
  body: CreateAssetSchema
});
export const assetIdValidation = withZodValidation({ params: AssetIdParamsSchema });
export const updateAssetValidation = withZodValidation({
  params: AssetIdParamsSchema,
  body: UpdateAssetSchema
});

export const listCustomersRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: customerListItemSchema
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

export const searchCustomersRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["customers"],
      properties: {
        customers: {
          type: "array",
          items: customerListItemSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const createCustomerRouteSchema = {
  tags: ["customers"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["customer"],
      properties: {
        customer: customerResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;

export const getCustomerRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["customer"],
      properties: {
        customer: customerWithGraphResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const updateCustomerRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["customer"],
      properties: {
        customer: customerResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const deleteCustomerRouteSchema = {
  tags: ["customers"],
  response: {
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const listPropertiesRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["properties"],
      properties: {
        properties: {
          type: "array",
          items: propertyResponseSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const createPropertyRouteSchema = {
  tags: ["customers"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["property"],
      properties: {
        property: propertyResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const getPropertyRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["property"],
      properties: {
        property: propertyWithAssetsResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const updatePropertyRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["property"],
      properties: {
        property: propertyResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const deletePropertyRouteSchema = {
  tags: ["customers"],
  response: {
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const createAssetRouteSchema = {
  tags: ["customers"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["asset"],
      properties: {
        asset: assetResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const getAssetRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["asset"],
      properties: {
        asset: {
          ...assetResponseSchema,
          required: [...assetResponseSchema.required, "jobCount"],
          properties: {
            ...assetResponseSchema.properties,
            jobCount: { type: "integer" }
          }
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const updateAssetRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["asset"],
      properties: {
        asset: assetResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const deleteAssetRouteSchema = {
  tags: ["customers"],
  response: {
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

const customerNoteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "customerId", "authorId", "content", "isInternal", "notedAt", "createdAt", "updatedAt", "deletedAt"],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    customerId: { type: "string" },
    authorId: nullableStringSchema,
    content: { type: "string" },
    isInternal: { type: "boolean" },
    notedAt: nullableDateTimeSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

export const createCustomerNoteRouteSchema = {
  tags: ["customers"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["note"],
      properties: {
        note: customerNoteSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const getCustomerImportedHistoryRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: true
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const listCustomerHistoryTimelineValidation = withZodValidation({
  params: CustomerIdParamsSchema,
  query: listCustomerHistoryTimelineQuerySchema
});

export const getCustomerHistoryTimelineRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: true
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const getCustomerNotesRouteSchema = {
  tags: ["customers"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["notes"],
      properties: {
        notes: {
          type: "array",
          items: customerNoteSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
