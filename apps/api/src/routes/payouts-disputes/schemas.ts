import type { FastifySchema } from "fastify";
import { z } from "zod";

import { DisputeStatusFilterSchema, PAYOUTS_DISPUTES_PAGE_MAX } from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const stripePayoutIdSchema = z.string().regex(/^po_[A-Za-z0-9]{1,64}$/);

export const listPayoutsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(PAYOUTS_DISPUTES_PAGE_MAX).optional(),
    startingAfter: stripePayoutIdSchema.optional()
  })
  .strict();
export const payoutIdParamsSchema = z.object({ payoutId: stripePayoutIdSchema }).strict();
export const listDisputesQuerySchema = z
  .object({
    status: DisputeStatusFilterSchema.optional(),
    limit: z.coerce.number().int().min(1).max(PAYOUTS_DISPUTES_PAGE_MAX).optional(),
    cursor: z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).optional()
  })
  .strict();
export const disputeIdParamsSchema = z.object({ disputeId: z.string().uuid() }).strict();

export type ListPayoutsQuery = z.infer<typeof listPayoutsQuerySchema>;
export type PayoutIdParams = z.infer<typeof payoutIdParamsSchema>;
export type ListDisputesQuery = z.infer<typeof listDisputesQuerySchema>;
export type DisputeIdParams = z.infer<typeof disputeIdParamsSchema>;

export const listPayoutsValidation = withZodValidation({ query: listPayoutsQuerySchema });
export const getPayoutValidation = withZodValidation({ params: payoutIdParamsSchema });
export const listDisputesValidation = withZodValidation({ query: listDisputesQuerySchema });
export const getDisputeValidation = withZodValidation({ params: disputeIdParamsSchema });

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

const payoutSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "amount", "currency", "status", "arrivalDate", "createdAt"],
  properties: {
    id: { type: "string" },
    amount: { type: "string" },
    currency: { type: "string" },
    status: { type: "string" },
    arrivalDate: nullableString,
    createdAt: { type: "string" },
    method: nullableString,
    type: nullableString,
    description: nullableString,
    failureCode: nullableString
  }
} as const;

const disputeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "stripeDisputeId", "amount", "currency", "status", "open", "reason", "disputedAt", "updatedAt"],
  properties: {
    id: { type: "string" },
    stripeDisputeId: { type: "string" },
    stripeChargeId: nullableString,
    stripePaymentIntentId: nullableString,
    paymentId: nullableString,
    invoiceId: nullableString,
    amount: { type: "string" },
    currency: { type: "string" },
    status: { type: "string" },
    open: { type: "boolean" },
    reason: { type: "string" },
    evidenceDueBy: nullableString,
    disputedAt: { type: "string" },
    updatedAt: { type: "string" }
  }
} as const;

export const listPayoutsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["connected", "data", "hasMore"],
      properties: { connected: { type: "boolean" }, data: { type: "array", items: payoutSchema }, hasMore: { type: "boolean" } }
    }
  }
};
export const getPayoutRouteSchema: FastifySchema = {
  response: { 200: { type: "object", additionalProperties: false, required: ["data"], properties: { data: payoutSchema } } }
};
export const listDisputesRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "nextCursor"],
      properties: { data: { type: "array", items: disputeSchema }, nextCursor: nullableString }
    }
  }
};
export const getDisputeRouteSchema: FastifySchema = {
  response: { 200: { type: "object", additionalProperties: false, required: ["data"], properties: { data: disputeSchema } } }
};
