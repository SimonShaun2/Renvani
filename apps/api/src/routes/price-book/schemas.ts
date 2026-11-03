import type { FastifySchema } from "fastify";
import { z } from "zod";

import { priceBookItemSearchQuerySchema } from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" }
  }
} as const;

export const searchPriceBookItemsValidation = withZodValidation({
  query: priceBookItemSearchQuerySchema
});

export type SearchPriceBookItemsQuery = z.infer<typeof priceBookItemSearchQuerySchema>;

const priceBookItemPickerSeedSchema = {
  type: "object",
  additionalProperties: false,
  required: ["priceBookItemId", "name", "description", "unitPrice", "isTaxable", "itemType"],
  properties: {
    priceBookItemId: { type: "string", format: "uuid" },
    name: { type: "string" },
    description: { anyOf: [{ type: "string" }, { type: "null" }] },
    unitPrice: { type: "string" },
    isTaxable: { type: "boolean" },
    itemType: { type: "string", enum: ["service", "labor", "material", "fee"] }
  }
} as const;

export const searchPriceBookItemsRouteSchema = {
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: priceBookItemPickerSeedSchema
        }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} satisfies FastifySchema;
