import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const isoDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "must be a valid ISO date or date-time"
  });

export const jobSourceReportingQuerySchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  includeJobIds: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
});

export const jobSourceReportingValidation = withZodValidation({
  query: jobSourceReportingQuerySchema
});

const channelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["channel", "label", "bookedJobCount", "revenue", "shareOfBookedJobs"],
  properties: {
    channel: {
      type: "string",
      enum: ["own_website", "booking", "referrals", "repeat_customers", "imported_or_other"]
    },
    label: { type: "string" },
    bookedJobCount: { type: "integer" },
    revenue: { type: "string" },
    shareOfBookedJobs: { type: "number" },
    jobIds: {
      type: "array",
      items: { type: "string" }
    },
    jobIdsTruncated: { type: "boolean" }
  }
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

export const jobSourceReportingRouteSchema = {
  tags: ["reporting"],
  summary:
    "Job source reporting summary. Calendar dates (YYYY-MM-DD) use the company IANA timezone; full ISO date-times are interpreted as UTC instants. Date range is inclusive and cannot exceed 366 days; startDate must be on or before endDate.",
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["startDate", "endDate"],
    properties: {
      startDate: { type: "string" },
      endDate: { type: "string" },
      includeJobIds: {
        type: "string",
        enum: ["true", "false"],
        description: "When true, include up to 25 jobIds per channel for drill-down."
      }
    }
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["period", "totals", "channels"],
      properties: {
        period: {
          type: "object",
          additionalProperties: false,
          required: ["startDate", "endDate", "timeZone", "dateInterpretation"],
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" },
            timeZone: { type: "string" },
            dateInterpretation: {
              type: "string",
              enum: ["company_local_days", "utc_instant"]
            }
          }
        },
        totals: {
          type: "object",
          additionalProperties: false,
          required: [
            "bookedJobCount",
            "revenue",
            "unknownAttributionCount",
            "unknownAttributionDefinition"
          ],
          properties: {
            bookedJobCount: { type: "integer" },
            revenue: { type: "string" },
            unknownAttributionCount: {
              type: "integer",
              description:
                "Count of booked jobs in the period with no attributable lead source on the job or customer."
            },
            unknownAttributionDefinition: { type: "string" }
          }
        },
        channels: {
          type: "array",
          items: channelSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema
  }
} as const;

export const directDemandQuerySchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema
});

export const directDemandValidation = withZodValidation({
  query: directDemandQuerySchema
});

export const directDemandRouteSchema = {
  tags: ["reporting"],
  summary:
    "Direct demand (Growth source tracking): booked jobs with captured lead attribution in the period, by source (utm_source, else referrer host), with paid invoice revenue via invoices.job_id. Same date rules as job-sources.",
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["startDate", "endDate"],
    properties: {
      startDate: { type: "string" },
      endDate: { type: "string" }
    }
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["period", "totals", "sources"],
      properties: {
        period: {
          type: "object",
          additionalProperties: false,
          required: ["startDate", "endDate", "timeZone"],
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" },
            timeZone: { type: "string" }
          }
        },
        totals: {
          type: "object",
          additionalProperties: false,
          required: ["jobCount", "paidRevenue"],
          properties: {
            jobCount: { type: "integer" },
            paidRevenue: { type: "string" }
          }
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["source", "jobCount", "paidRevenue"],
            properties: {
              source: { type: "string" },
              jobCount: { type: "integer" },
              paidRevenue: { type: "string" }
            }
          }
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema
  }
} as const;
