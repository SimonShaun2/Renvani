import { z } from "zod";

import { revenueOutcomesQuerySchema } from "@fsm/types";

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

const str = { type: "string" } as const;
const int = { type: "integer" } as const;
const nullableNumber = { type: ["number", "null"] } as const;
const registryEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "label", "definition"],
  properties: { key: str, label: str, definition: str }
} as const;
const outcomeSegmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["segment", "label", "confirmedJobs", "completedJobs", "completedRevenue"],
  properties: { segment: str, label: str, confirmedJobs: int, completedJobs: int, completedRevenue: str }
} as const;

export const revenueOutcomesValidation = withZodValidation({
  query: revenueOutcomesQuerySchema
});

export const revenueOutcomesRouteSchema = {
  tags: ["reporting"],
  summary:
    "FS-22 revenue outcomes (owner/admin): inquiry -> qualified -> estimate -> confirmed/completed job -> repeat revenue, new vs repeat and agent-assisted splits, materials contribution profit, agent guardrails. Aggregates and definitions only; max 366-day range.",
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["startDate", "endDate"],
    properties: { startDate: str, endDate: str }
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["period", "funnel", "revenue", "segments", "profit", "guardrails", "attribution", "definitions"],
      properties: {
        period: {
          type: "object",
          additionalProperties: false,
          required: ["startDate", "endDate", "timeZone", "dateInterpretation"],
          properties: { startDate: str, endDate: str, timeZone: str, dateInterpretation: str }
        },
        funnel: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["stage", "label", "count"],
            properties: { stage: str, label: str, count: int }
          }
        },
        revenue: {
          type: "object",
          additionalProperties: false,
          required: ["completedRevenue", "newCustomerRevenue", "repeatCustomerRevenue", "repeatRevenueSharePercent"],
          properties: {
            completedRevenue: str,
            newCustomerRevenue: str,
            repeatCustomerRevenue: str,
            repeatRevenueSharePercent: { type: "number" }
          }
        },
        segments: {
          type: "object",
          additionalProperties: false,
          required: ["customerType", "agentAssistance"],
          properties: {
            customerType: { type: "array", items: outcomeSegmentSchema },
            agentAssistance: { type: "array", items: outcomeSegmentSchema }
          }
        },
        profit: {
          type: "object",
          additionalProperties: false,
          required: [
            "costBasis",
            "completedJobCount",
            "completedRevenue",
            "materialCost",
            "contributionProfit",
            "contributionProfitPerCompletedJob",
            "jobsWithIncompleteCostData"
          ],
          properties: {
            costBasis: str,
            completedJobCount: int,
            completedRevenue: str,
            materialCost: str,
            contributionProfit: str,
            contributionProfitPerCompletedJob: { type: ["string", "null"] },
            jobsWithIncompleteCostData: int
          }
        },
        guardrails: {
          type: "object",
          additionalProperties: false,
          required: [
            "agentProposals",
            "accepted",
            "rejected",
            "escalated",
            "failed",
            "edited",
            "acceptanceRatePercent",
            "overrideRatePercent",
            "errorRatePercent"
          ],
          properties: {
            agentProposals: int,
            accepted: int,
            rejected: int,
            escalated: int,
            failed: int,
            edited: int,
            acceptanceRatePercent: nullableNumber,
            overrideRatePercent: nullableNumber,
            errorRatePercent: nullableNumber
          }
        },
        attribution: {
          type: "object",
          additionalProperties: false,
          required: ["unknownSourceJobCount", "unknownSourceDefinition"],
          properties: { unknownSourceJobCount: int, unknownSourceDefinition: str }
        },
        definitions: { type: "array", items: registryEntrySchema }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema
  }
} as const;
