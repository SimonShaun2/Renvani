import { z } from "zod";

import { AppError, ErrorCode } from "@fsm/types";

const CustomerPortalTokenSchema = z.string().min(16).max(2048);

/** Missing or malformed portal token header → 401 (never 400, so probing reveals nothing). */
export function parseCustomerPortalToken(value: string | string[] | undefined): string {
  const parsed = CustomerPortalTokenSchema.safeParse(Array.isArray(value) ? value[0] : value);
  if (!parsed.success) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired portal link");
  }
  return parsed.data;
}

const nullableString = { type: ["string", "null"] } as const;
const errorResponseSchema = {
  type: "object",
  additionalProperties: true,
  properties: { error: { type: "object", additionalProperties: true } }
} as const;
const errors = { 400: errorResponseSchema, 401: errorResponseSchema } as const;

export const getCustomerPortalAccountSchema = {
  tags: ["public", "customer-portal"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["account"],
      properties: {
        account: {
          type: "object",
          additionalProperties: false,
          required: ["customer", "company"],
          properties: {
            customer: {
              type: "object",
              additionalProperties: false,
              required: ["id", "firstName", "lastName", "displayName", "email", "phone"],
              properties: {
                id: { type: "string" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                displayName: nullableString,
                email: nullableString,
                phone: nullableString
              }
            },
            company: {
              type: "object",
              additionalProperties: false,
              required: ["name"],
              properties: { name: { type: "string" } }
            }
          }
        }
      }
    },
    ...errors
  }
} as const;

const visitSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "jobNumber", "title", "status", "scheduledStart", "scheduledEnd", "completedAt"],
  properties: {
    id: { type: "string" },
    jobNumber: { type: "string" },
    title: { type: "string" },
    status: { type: "string" },
    scheduledStart: nullableString,
    scheduledEnd: nullableString,
    completedAt: nullableString
  }
} as const;

export const listCustomerPortalVisitsSchema = {
  tags: ["public", "customer-portal"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["visits"],
      properties: {
        visits: {
          type: "object",
          additionalProperties: false,
          required: ["upcoming", "past"],
          properties: {
            upcoming: { type: "array", items: visitSchema },
            past: { type: "array", items: visitSchema }
          }
        }
      }
    },
    ...errors
  }
} as const;

export const listCustomerPortalEstimatesSchema = {
  tags: ["public", "customer-portal"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["estimates"],
      properties: {
        estimates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "estimateNumber", "title", "status", "total", "createdAt", "approvalToken"],
            properties: {
              id: { type: "string" },
              estimateNumber: { type: "string" },
              title: nullableString,
              status: { type: "string" },
              total: { type: "string" },
              createdAt: { type: "string" },
              approvalToken: nullableString
            }
          }
        }
      }
    },
    ...errors
  }
} as const;

export const listCustomerPortalInvoicesSchema = {
  tags: ["public", "customer-portal"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["invoices"],
      properties: {
        invoices: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "invoiceNumber",
              "status",
              "total",
              "amountPaid",
              "balanceDue",
              "issuedAt",
              "dueAt",
              "paidAt",
              "paymentToken"
            ],
            properties: {
              id: { type: "string" },
              invoiceNumber: { type: "string" },
              status: { type: "string" },
              total: { type: "string" },
              amountPaid: { type: "string" },
              balanceDue: { type: "string" },
              issuedAt: nullableString,
              dueAt: nullableString,
              paidAt: nullableString,
              paymentToken: nullableString
            }
          }
        }
      }
    },
    ...errors
  }
} as const;

/** Portal sections: payloads are validated by the explicit zod allowlist schemas in @fsm/types. */
const sectionKeyParams = {
  type: "object",
  required: ["key"],
  properties: { key: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-z][a-z0-9_-]*$" } }
} as const;

export const listCustomerPortalSectionsSchema = {
  tags: ["public", "customer-portal"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["sections"],
      properties: { sections: { type: "array", items: { type: "string" } } }
    },
    ...errors
  }
} as const;

export const getCustomerPortalSectionSchema = {
  tags: ["public", "customer-portal"],
  params: sectionKeyParams,
  response: { ...errors, 404: errorResponseSchema }
} as const;

export const getCustomerPortalNamedSectionSchema = {
  tags: ["public", "customer-portal"],
  response: { ...errors }
} as const;
